import 'reflect-metadata';
import * as assert from 'node:assert/strict';
import { EmailVerificationChallenge, User } from '../../src/entity';
import { digestEmailOtp } from '../../src/module/user/email-verification-code';
import { EmailVerificationService } from '../../src/module/user/email-verification.service';
import { UserService } from '../../src/module/user/user.service';

const pepper = 'test-only-pepper-with-enough-entropy';
const tracked = <T extends (...args: any[]) => any>(implementation?: T) => {
  const fn = (...args: Parameters<T>) => {
    fn.calls.push(args);
    return implementation?.(...args);
  };
  fn.calls = [] as Array<Parameters<T>>;
  return fn;
};
const config = (values: Record<string, unknown> = {}) => ({
  get(name: string, fallback?: unknown) {
    if (name === 'EMAIL_VERIFICATION_PEPPER') return pepper;
    return values[name] ?? fallback;
  },
});
const makeChallenge = (overrides: Partial<EmailVerificationChallenge> = {}) =>
  Object.assign(new EmailVerificationChallenge(), {
    id: '0198b0d0-0000-7000-8000-000000000001',
    purpose: 'register' as const,
    userId: null,
    normalizedEmail: 'owner@example.com',
    activeKey: 'active-key',
    codeHash: digestEmailOtp(
      pepper,
      '0198b0d0-0000-7000-8000-000000000001',
      'register',
      'owner@example.com',
      '123456',
    ),
    expiresAt: new Date(Date.now() + 60_000),
    failedAttempts: 0,
    maxAttempts: 3,
    resendAvailableAt: new Date(Date.now() + 30_000),
    verifiedAt: null,
    consumedAt: null,
    invalidatedAt: null,
    notificationId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

function verificationHarness(item: EmailVerificationChallenge) {
  const repo = {
    findOne: tracked(async () => item),
    save: tracked(async (value: EmailVerificationChallenge) => value),
  };
  const manager = { getRepository: tracked(() => repo) };
  const dataSource = {
    transaction: tracked(async (work: (value: any) => any) => work(manager)),
  };
  const service = new EmailVerificationService(
    config() as any,
    dataSource as any,
    {} as any,
  );
  (service as any).logger = { log() {}, warn() {} };
  return { service, repo, manager };
}

async function challengeScenarios() {
  const item = makeChallenge();
  const { service, repo } = verificationHarness(item);
  await assert.rejects(service.verify(item.id, '654321'));
  assert.equal(item.failedAttempts, 1);
  assert.equal(repo.save.calls.length, 1);
  assert.deepEqual(await service.verify(item.id, '123456'), {
    challengeId: item.id,
    verified: true,
  });
  assert.ok(item.verifiedAt instanceof Date);

  const exhausted = makeChallenge({ failedAttempts: 3 });
  const exhaustedHarness = verificationHarness(exhausted);
  await assert.rejects(exhaustedHarness.service.verify(exhausted.id, '123456'));
  assert.equal(exhaustedHarness.repo.save.calls.length, 0);
  const expired = makeChallenge({ expiresAt: new Date(Date.now() - 1) });
  await assert.rejects(
    verificationHarness(expired).service.verify(expired.id, '123456'),
  );
  const pending = makeChallenge();
  const pendingHarness = verificationHarness(pending);
  await assert.rejects(
    pendingHarness.service.consume(pendingHarness.manager as any, pending.id, {
      purpose: 'register',
      normalizedEmail: pending.normalizedEmail,
    }),
  );

  const consumable = makeChallenge({ verifiedAt: new Date() });
  const concurrent = verificationHarness(consumable);
  let tail = Promise.resolve();
  const transaction = async <T>(work: () => Promise<T>): Promise<T> => {
    let release: () => void;
    const predecessor = tail;
    tail = new Promise<void>((resolve) => {
      release = resolve;
    });
    await predecessor;
    try {
      return await work();
    } finally {
      release!();
    }
  };
  const consume = () =>
    transaction(() =>
      concurrent.service.consume(concurrent.manager as any, consumable.id, {
        purpose: 'register',
        normalizedEmail: consumable.normalizedEmail,
      }),
    );
  const results = await Promise.allSettled([consume(), consume()]);
  assert.deepEqual(results.map((result) => result.status).sort(), [
    'fulfilled',
    'rejected',
  ]);
  assert.deepEqual((concurrent.repo.findOne.calls as any)[0][0], {
    where: { id: consumable.id },
    lock: { mode: 'pessimistic_write' },
  });
  await assert.rejects(consume());
}

async function creationScenarios() {
  const previous = makeChallenge();
  const notifier = { send: tracked(async () => 'notification-id') };
  const userRepo = { findOneBy: tracked(async () => null) };
  const blockedChallengeRepo = { find: tracked(async () => [previous]) };
  const blockedManager = {
    getRepository: tracked((entity: any) =>
      entity === User ? userRepo : blockedChallengeRepo,
    ),
  };
  const blocked = new EmailVerificationService(
    config() as any,
    {
      manager: blockedManager,
      transaction: (work: (manager: any) => any) => work(blockedManager),
    } as any,
    notifier as any,
  );
  await assert.rejects(blocked.requestRegistration('owner@example.com'));
  assert.equal(notifier.send.calls.length, 0);

  let stored: EmailVerificationChallenge;
  const challengeRepo = {
    find: tracked(async () => []),
    create: tracked((value: any) =>
      Object.assign(new EmailVerificationChallenge(), value),
    ),
    save: tracked(async (value: EmailVerificationChallenge) => {
      stored = value;
      return value;
    }),
    update: tracked(async () => undefined),
  };
  const manager = {
    getRepository: tracked((entity: any) =>
      entity === User ? userRepo : challengeRepo,
    ),
  };
  const service = new EmailVerificationService(
    config() as any,
    {
      manager,
      transaction: (work: (value: any) => any) => work(manager),
    } as any,
    notifier as any,
  );
  (service as any).logger = { log() {}, warn() {} };
  const result = await service.requestRegistration(' Owner@Example.COM ');
  const delivery = (notifier.send.calls as any)[0][0] as any;
  assert.ok(!Object.prototype.hasOwnProperty.call(result, 'code'));
  assert.equal(stored!.normalizedEmail, 'owner@example.com');
  assert.notEqual(stored!.codeHash, delivery.code);
  assert.ok(!stored!.codeHash.includes(delivery.code));
  assert.deepEqual(challengeRepo.update.calls[0], [
    { id: stored!.id },
    { notificationId: 'notification-id' },
  ]);
}

const userServiceHarness = () => {
  const service = new UserService(
    config({ PWD_SALT_ROUND: 4, TOKEN_SECRET: 'test-session-secret' }) as any,
    {
      getPermissionByRoles() {},
    } as any,
  );
  (service as any).logger = { log() {}, warn() {} };
  (service as any).cache = { jsonSet: async () => undefined };
  return service;
};

async function userScenarios() {
  const verifiedAt = new Date();
  const users = {
    findOneBy: tracked(async () => null),
    create: tracked((value: any) =>
      Object.assign(new User(), value, {
        id: 7,
        role: 1,
        avatar: null,
        created_at: new Date(),
        updated_at: new Date(),
      }),
    ),
    save: tracked(async (value: User) => value),
  };
  const manager = { getRepository: tracked(() => users) };
  const service = userServiceHarness();
  (service as any).dataSource = {
    transaction: (work: (value: any) => any) => work(manager),
  };
  const consume = tracked(async (receivedManager: any) => {
    assert.equal(receivedManager, manager);
    return makeChallenge({ verifiedAt });
  });
  (service as any).emailVerification = { consume };
  const result = await service.create({
    nickname: 'Owner',
    email: ' Owner@Example.COM ',
    password: 'md5-password',
    emailVerificationChallengeId: '0198b0d0-0000-7000-8000-000000000001',
  });
  assert.equal(result.email, 'owner@example.com');
  assert.equal(users.save.calls[0][0].emailVerifiedAt, verifiedAt);
  assert.equal(users.save.calls[0][0].emailVerificationSource, 'email_otp');
  assert.equal(consume.calls.length, 1);
  assert.equal(users.save.calls.length, 1);
  assert.ok(!Object.prototype.hasOwnProperty.call(result, 'emailVerifiedAt'));
  const savedUser = users.save.calls[0][0];
  savedUser.roles = [];
  (service as any).userRepo = { findOne: async () => savedUser };
  const session = await service.login({
    email: 'owner@example.com',
    password: 'md5-password',
  });
  assert.ok(session.token.startsWith('Bearer '));

  const blocked = userServiceHarness();
  (blocked as any).dataSource = {
    transaction: (work: (value: any) => any) => work(manager),
  };
  (blocked as any).emailVerification = {
    consume: async () => {
      throw new Error('unverified');
    },
  };
  await assert.rejects(
    blocked.create({
      nickname: 'Owner',
      email: 'owner@example.com',
      password: 'password',
      emailVerificationChallengeId: '0198b0d0-0000-7000-8000-000000000001',
    }),
  );
  await assert.rejects(
    blocked.update(7, { email: 'bypass@example.com' } as any),
  );

  const current = Object.assign(new User(), {
    id: 7,
    email: 'old@example.com',
    emailVerifiedAt: new Date(0),
    emailVerificationSource: 'legacy_migration',
    nickname: 'Owner',
    role: 1,
    avatar: null,
    created_at: new Date(),
    updated_at: new Date(),
  });
  const changeUsers = {
    findOne: tracked(async () => current),
    findOneBy: tracked(async () => null),
    save: tracked(async (value: User) => value),
  };
  const changeManager = { getRepository: tracked(() => changeUsers) };
  const changing = userServiceHarness();
  (changing as any).dataSource = {
    transaction: (work: (value: any) => any) => work(changeManager),
  };
  (changing as any).emailVerification = {
    consume: async (receivedManager: any, _id: string, expectation: any) => {
      assert.equal(receivedManager, changeManager);
      assert.deepEqual(expectation, { purpose: 'change_email', userId: 7 });
      return makeChallenge({
        purpose: 'change_email',
        userId: 7,
        normalizedEmail: 'new@example.com',
        verifiedAt,
      });
    },
  };
  const changed = await changing.changeEmail(
    7,
    '0198b0d0-0000-7000-8000-000000000001',
  );
  assert.equal(changed.email, 'new@example.com');
  assert.equal(current.emailVerifiedAt, verifiedAt);
  assert.equal(current.emailVerificationSource, 'email_otp');
  assert.equal(changeUsers.save.calls[0][0], current);
}

Promise.resolve()
  .then(challengeScenarios)
  .then(creationScenarios)
  .then(userScenarios)
  .then(() => process.stdout.write('email verification scenarios passed\n'))
  .catch((error) => {
    process.stderr.write(`${error?.stack || error}\n`);
    process.exit(1);
  });
