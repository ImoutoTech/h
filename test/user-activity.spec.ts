import { describe, expect, it, vi } from 'vitest';
import { ValidationPipe } from '@nestjs/common';
import { UserRole } from '@reus-able/types';
import { ActivityQueryDto } from '../src/dto/activity/activity-query.dto';
import { ActivityController } from '../src/module/activity/activity.controller';
import { ActivityWriterService } from '../src/module/activity/activity-writer.service';
import {
  ActivityCleanupService,
  DEFAULT_ACTIVITY_RETENTION_DAYS,
} from '../src/module/activity/activity-cleanup.service';
import { ActivityQueryService } from '../src/module/activity/activity-query.service';
import { UserActivityOverview1788192000000 } from '../src/database/migrations/1788192000000-UserActivityOverview';

function writerFixture() {
  const persisted = new Map<string, any>();
  const events = {
    create: vi.fn((value) => value),
    insert: vi.fn(async (value) => {
      const key = value.dedupeKey || `event-${persisted.size}`;
      if (persisted.has(key)) throw { code: 'ER_DUP_ENTRY' };
      persisted.set(key, value);
    }),
  };
  const service = new ActivityWriterService();
  Object.assign(service, {
    events,
    apps: {
      findOne: vi.fn(async () => ({
        id: 'app-1',
        name: 'Example App',
        owner: { id: 9 },
      })),
    },
    logger: { warn: vi.fn() },
  });
  return { service, events, persisted };
}

describe('user activity writer', () => {
  it('uses a digest dedupe key and persists only whitelisted OIDC metadata', async () => {
    const { service, persisted } = writerFixture();
    const command = {
      kind: 'oidc.login' as const,
      actorUserId: 7,
      appId: 'app-1',
      scopes: ['email', 'openid', 'unknown', 'email'],
      authorizationCodeJti: 'raw-code-jti-never-persisted',
      accessToken: 'must-not-persist',
    };
    await service.record(command);
    await service.record(command);

    expect(persisted.size).toBe(1);
    const event = [...persisted.values()][0];
    expect(event).toMatchObject({
      actorUserId: 7,
      ownerUserId: 9,
      appId: 'app-1',
      targetName: 'Example App',
      category: 'oidc',
      action: 'login_succeeded',
      outcome: 'success',
      metadata: { scopes: ['email', 'openid'] },
    });
    expect(event.dedupeKey).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(event)).not.toContain('raw-code-jti-never-persisted');
    expect(JSON.stringify(event)).not.toContain('must-not-persist');
  });

  it('degrades safely when persistence fails', async () => {
    const { service, events } = writerFixture();
    events.insert.mockRejectedValueOnce(new Error('database unavailable'));
    await expect(
      service.record({
        kind: 'account.login',
        actorUserId: 1,
        method: 'password',
        outcome: 'success',
      }),
    ).resolves.toBeUndefined();
    expect((service as any).logger.warn).toHaveBeenCalledWith(
      '用户活动事件写入失败，主业务结果不受影响',
      ActivityWriterService.name,
    );
  });
});

describe('user activity query', () => {
  const principal = {
    id: 5,
    email: 'owner@example.com',
    role: UserRole.USER,
    roles: ['2'],
    refresh: false,
  };

  function queryFixture(permissionCodes: string[]) {
    const service = new ActivityQueryService();
    const user = {
      id: 5,
      email: 'owner@example.com',
      role: UserRole.USER,
      password: 'hash',
      emailVerifiedAt: new Date('2026-01-01T00:00:00Z'),
      created_at: new Date('2025-01-01T00:00:00Z'),
      updated_at: new Date('2026-01-01T00:00:00Z'),
      roles: [{ id: 2 }],
    };
    const events = {
      count: vi.fn(async () => 3),
      findAndCount: vi.fn(async () => [[], 0]),
    };
    Object.assign(service, {
      users: { findOne: vi.fn(async () => user) },
      identities: { find: vi.fn(async () => []) },
      apps: {
        find: vi.fn(async () => [
          { meta: { status: 1 } },
          { meta: { status: 0 } },
          { meta: { status: 2 } },
        ]),
      },
      events,
      permissions: {
        getPermissionByRoles: vi.fn(async () => permissionCodes),
      },
    });
    return { service, events };
  }

  it('returns apps=null without the existing view-app permission', async () => {
    const { service, events } = queryFixture([]);
    const result = await service.overview(principal);
    expect(result.apps).toBeNull();
    expect(events.count).not.toHaveBeenCalled();
  });

  it('returns status and fixed-window metrics with permission', async () => {
    const { service, events } = queryFixture(['PeqSazMt']);
    const result = await service.overview(principal);
    expect(result.windowDays).toBe(30);
    expect(result.apps).toEqual({
      total: 3,
      running: 1,
      closed: 1,
      banned: 1,
      loginSucceeded: 3,
      consentApproved: 3,
      consentDenied: 3,
    });
    for (const call of events.count.mock.calls) {
      expect(call[0].where.ownerUserId).toBe(5);
      expect(call[0].where.category).toBe('oidc');
      expect(call[0].where.occurredAt).toBeDefined();
    }
  });

  it('always scopes activity pages to the current actor', async () => {
    const { service, events } = queryFixture([]);
    await service.activity(5, { page: 2, size: 20, category: 'identity' });
    expect(events.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { actorUserId: 5, category: 'identity' },
        skip: 20,
        take: 20,
      }),
    );
  });
});

describe('user activity HTTP contract', () => {
  it('attaches access-token auth metadata to both route handlers', () => {
    expect(
      Reflect.getMetadata('roles', ActivityController.prototype.overview),
    ).toEqual(['user']);
    expect(
      Reflect.getMetadata('roles', ActivityController.prototype.activity),
    ).toEqual(['user']);
  });

  it('transforms page and size query strings before integer validation', async () => {
    const pipe = new ValidationPipe({
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    });
    await expect(
      pipe.transform(
        { page: '1', size: '20' },
        { type: 'query', metatype: ActivityQueryDto },
      ),
    ).resolves.toMatchObject({ page: 1, size: 20 });
  });
});

describe('user activity retention', () => {
  it('defaults invalid configuration to 90 days and deletes by occurredAt', async () => {
    const service = new ActivityCleanupService({
      get: vi.fn(() => 'invalid'),
    } as any);
    const remove = vi.fn(async () => undefined);
    Object.assign(service, {
      events: { delete: remove },
      logger: { warn: vi.fn() },
    });
    expect(service.retentionDays).toBe(DEFAULT_ACTIVITY_RETENTION_DAYS);
    const now = new Date('2026-09-01T00:00:00.000Z');
    await service.run(now);
    const operator = remove.mock.calls[0][0].occurredAt as any;
    expect(operator._value).toEqual(new Date('2026-06-03T00:00:00.000Z'));
  });

  it('accepts a bounded positive retention override', () => {
    const service = new ActivityCleanupService({
      get: vi.fn(() => '180'),
    } as any);
    expect(service.retentionDays).toBe(180);
  });
});

describe('user activity migration', () => {
  it('creates indexed event storage and provides a down migration', async () => {
    const statements: string[] = [];
    const migration = new UserActivityOverview1788192000000();
    const runner = {
      query: vi.fn(async (statement: string) => statements.push(statement)),
    };
    await migration.up(runner as any);
    expect(statements[0]).toContain('CREATE TABLE `user_activity_events`');
    expect(statements[0]).toContain('`idx_user_activity_actor_occurred`');
    expect(statements[0]).toContain('`uq_user_activity_dedupe`');
    await migration.down(runner as any);
    expect(statements[1]).toBe('DROP TABLE `user_activity_events`');
  });
});
