import { spawnSync } from 'child_process';
import { describe, expect, it } from 'vitest';

describe('ExternalIdentityService identity resolution', () => {
  it('preserves login and binding behavior without creating unbound accounts', () => {
    const script = `
      require('reflect-metadata');
      const assert = require('node:assert/strict');
      const { ExternalIdentity, User } = require('./src/entity');
      const { ExternalIdentityService } = require('./src/module/identity/external-identity.service');

      const profile = {
        providerUserId: 'provider-user',
        email: 'verified@example.com',
        emailVerified: true,
        displayName: 'Verified User',
        avatarUrl: 'https://images.example/avatar.png',
      };
      const makeUser = (id) => {
        const user = new User();
        Object.assign(user, {
          id,
          nickname: 'user-' + id,
          role: 1,
          email: 'user-' + id + '@example.com',
          avatar: null,
        });
        return user;
      };
      const tracked = (implementation) => {
        const fn = (...args) => {
          fn.calls.push(args);
          return implementation?.(...args);
        };
        fn.calls = [];
        return fn;
      };
      const makeService = ({ transaction, consume, issueSession } = {}) => {
        const service = new ExternalIdentityService(
          {},
          {},
          { transaction: transaction || tracked(async (work) => work({})) },
          { issueSession: issueSession || tracked(() => ({ token: 'token', refresh: 'refresh', user: {} })) },
          { consume: consume || tracked(async () => ({ provider: 'github' })) },
        );
        service.logger = { warn() {} };
        return service;
      };
      const managerFor = (identities, users) => ({
        getRepository: (entity) => entity === ExternalIdentity ? identities : users,
      });

      (async () => {
        {
          const identities = {
            findOne: tracked(async () => null),
            create: tracked((value) => value),
            save: tracked(async () => undefined),
          };
          const users = {
            findOneBy: tracked(async () => null),
            create: tracked((value) => value),
            save: tracked(async () => undefined),
          };
          const transaction = tracked(async (work) => work(managerFor(identities, users)));
          const service = makeService({ transaction });
          assert.deepEqual(await service.resolve('github', profile), { outcome: 'identity_not_bound' });
          assert.equal(users.findOneBy.calls.length, 0);
          assert.equal(users.create.calls.length, 0);
          assert.equal(users.save.calls.length, 0);
          assert.equal(identities.create.calls.length, 0);
          assert.equal(identities.save.calls.length, 0);
        }

        {
          const issueSession = tracked(() => undefined);
          const identities = {
            findOne: tracked(async () => null),
            create: tracked((value) => value),
            save: tracked(async () => undefined),
          };
          const users = {
            findOneBy: tracked(async () => null),
            create: tracked((value) => value),
            save: tracked(async () => undefined),
          };
          const transaction = tracked(async (work) => work(managerFor(identities, users)));
          const service = makeService({ transaction, issueSession });
          const cacheWrite = tracked(async () => undefined);
          service.cache = { jsonSet: cacheWrite };
          service.githubProfile = async () => profile;
          assert.deepEqual(await service.callback('github', 'code', 'state'), {
            outcome: 'identity_not_bound',
          });
          assert.equal(users.findOneBy.calls.length, 0);
          assert.equal(users.create.calls.length, 0);
          assert.equal(users.save.calls.length, 0);
          assert.equal(identities.create.calls.length, 0);
          assert.equal(identities.save.calls.length, 0);
          assert.equal(issueSession.calls.length, 0);
          assert.equal(cacheWrite.calls.length, 0);
        }

        {
          const existingUser = makeUser(7);
          const loadedUser = Object.assign(makeUser(7), { roles: [] });
          const issueSession = tracked(() => ({
            token: 'local-token',
            refresh: 'local-refresh',
            user: loadedUser.getData(),
          }));
          const identities = { findOne: tracked(async () => ({ user: existingUser })) };
          const transaction = tracked(async (work) => work(managerFor(identities, {})));
          const service = makeService({ transaction, issueSession });
          service.identityRepo = { findOne: tracked(async () => null) };
          service.userRepo = { findOne: tracked(async () => loadedUser) };
          service.githubProfile = async () => profile;
          const result = await service.callback('github', 'code', 'state');
          assert.equal(result.outcome, 'authenticated');
          assert.equal(result.token, 'local-token');
          assert.deepEqual(service.userRepo.findOne.calls[0][0], {
            where: { id: 7 },
            relations: ['roles'],
          });
          assert.equal(issueSession.calls[0][0], loadedUser);
        }

        {
          const user = makeUser(12);
          const identities = {
            findOne: tracked(async () => null),
            create: tracked((value) => value),
            save: tracked(async () => undefined),
          };
          const users = { findOneBy: tracked(async () => user) };
          const transaction = tracked(async (work) => work(managerFor(identities, users)));
          const service = makeService({ transaction });
          const result = await service.resolve('google', profile, 12);
          assert.equal(result.outcome, 'bound');
          assert.equal(result.user.id, 12);
          assert.equal(identities.save.calls[0][0].provider, 'google');
          assert.equal(identities.save.calls[0][0].user, user);
        }

        {
          const user = makeUser(13);
          const identities = { findOne: tracked(async () => ({ user })) };
          const transaction = tracked(async (work) => work(managerFor(identities, {})));
          const service = makeService({ transaction });
          assert.deepEqual(await service.resolve('google', profile, 13), {
            outcome: 'bound',
            user: user.getData(),
          });
        }

        {
          const issueSession = tracked(() => undefined);
          const service = makeService({ issueSession });
          service.identityRepo = { findOne: tracked(async () => null) };
          service.userRepo = { findOne: tracked(async () => null) };
          service.githubProfile = async () => profile;
          service.resolve = async () => { throw { code: 'ER_DUP_ENTRY' }; };
          assert.deepEqual(await service.callback('github', 'code', 'state'), {
            outcome: 'identity_not_bound',
          });
          assert.equal(service.userRepo.findOne.calls.length, 0);
          assert.equal(issueSession.calls.length, 0);
        }

        {
          const service = makeService({
            consume: tracked(async () => ({ provider: 'github', bindUserId: 21 })),
          });
          service.identityRepo = { findOne: tracked(async () => ({ user: makeUser(22) })) };
          service.githubProfile = async () => profile;
          service.resolve = async () => { throw { driverError: { code: 'ER_DUP_ENTRY' } }; };
          await assert.rejects(
            service.callback('github', 'code', 'state'),
            /外部身份已被其他账号绑定/,
          );
        }

        {
          const user = makeUser(23);
          const issueSession = tracked(() => undefined);
          const service = makeService({
            consume: tracked(async () => ({ provider: 'github', bindUserId: 23 })),
            issueSession,
          });
          service.identityRepo = { findOne: tracked(async () => ({ user })) };
          service.githubProfile = async () => profile;
          service.resolve = async () => { throw { code: 'ER_DUP_ENTRY' }; };
          assert.deepEqual(await service.callback('github', 'code', 'state'), {
            outcome: 'bound',
            user: user.getData(),
          });
          assert.equal(issueSession.calls.length, 0);
        }

        {
          const loadedUser = Object.assign(makeUser(31), { roles: [] });
          const consume = tracked(async () => ({ provider: 'github', profile }));
          const issueSession = tracked(() => ({
            token: 'bound-token',
            refresh: 'bound-refresh',
            user: loadedUser.getData(),
          }));
          const service = makeService({ consume, issueSession });
          service.resolve = tracked(async () => ({ outcome: 'bound', user: loadedUser.getData() }));
          service.userRepo = { findOne: tracked(async () => loadedUser) };
          const result = await service.bind(31, 'legacy-binding-token');
          assert.equal(result.outcome, 'bound');
          assert.equal(result.token, 'bound-token');
          assert.equal(consume.calls[0][0], 'external-binding:legacy-binding-token');
          assert.equal(service.resolve.calls[0][2], 31);
          assert.equal(issueSession.calls[0][0], loadedUser);
        }

        process.stdout.write('identity resolution regressions passed\\n');
      })().catch((error) => { console.error(error); process.exit(1); });
    `;
    const result = spawnSync(
      process.execPath,
      ['-r', 'ts-node/register', '-r', 'tsconfig-paths/register', '-e', script],
      { cwd: process.cwd(), encoding: 'utf8' },
    );
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain('identity resolution regressions passed');
  });
});
