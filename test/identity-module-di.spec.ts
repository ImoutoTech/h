import { spawnSync } from 'child_process';
import { describe, expect, it } from 'vitest';

describe('IdentityModule dependency graph', () => {
  it('resolves providers without the unexported raw Redis token', () => {
    const script = `
      require('reflect-metadata');
      const { ConfigService } = require('@nestjs/config');
      const { getRepositoryToken } = require('@nestjs/typeorm');
      const { Test } = require('@nestjs/testing');
      const { DataSource } = require('typeorm');
      const { HLOGGER_TOKEN, RedisService } = require('@reus-able/nestjs');
      const { ExternalIdentity, ProviderConfig, User } = require('./src/entity');
      const { IdentityModule } = require('./src/module/identity/identity.module');
      const { ExternalIdentityService } = require('./src/module/identity/external-identity.service');
      const { OneTimeStateService } = require('./src/module/identity/one-time-state.service');
      const { UserModule } = require('./src/module/user/user.module');
      const { UserService } = require('./src/module/user/user.service');
      (async () => {
        let state = JSON.stringify({ provider: 'github' });
        const redisService = Object.create(RedisService.prototype);
        redisService.redisClient = { async getDel() { const value = state; state = null; return value; } };
        const imports = Reflect.getMetadata('imports', IdentityModule) || [];
        if (!imports.includes(UserModule)) throw new Error('IdentityModule does not import UserModule');
        const moduleRef = await Test.createTestingModule({
          controllers: Reflect.getMetadata('controllers', IdentityModule) || [],
          providers: [
            ...(Reflect.getMetadata('providers', IdentityModule) || []),
            { provide: getRepositoryToken(ExternalIdentity), useValue: {} },
            { provide: getRepositoryToken(ProviderConfig), useValue: {} },
            { provide: getRepositoryToken(User), useValue: {} },
            { provide: DataSource, useValue: {} },
            { provide: UserService, useValue: {} },
            { provide: RedisService, useValue: redisService },
            { provide: ConfigService, useValue: {} },
            { provide: HLOGGER_TOKEN, useValue: {} },
          ],
        }).compile();
        if (!moduleRef.get(ExternalIdentityService)) throw new Error('ExternalIdentityService unresolved');
        const oneTime = moduleRef.get(OneTimeStateService);
        const first = await oneTime.consume('state');
        const second = await oneTime.consume('state');
        if (first.provider !== 'github' || second !== undefined) throw new Error('GETDEL adapter failed');
        await moduleRef.close();
        process.stdout.write('identity module graph resolved\\n');
      })().catch((error) => { console.error(error); process.exit(1); });
    `;
    const result = spawnSync(
      process.execPath,
      ['-r', 'ts-node/register', '-r', 'tsconfig-paths/register', '-e', script],
      { cwd: process.cwd(), encoding: 'utf8' },
    );
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain('identity module graph resolved');
  });
});
