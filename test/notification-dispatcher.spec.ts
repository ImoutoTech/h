import { describe, expect, it, vi } from 'vitest';
import { NotificationDispatcher } from '../src/module/notification/dispatcher.service';

function dispatcher() {
  const instance = Object.create(
    NotificationDispatcher.prototype,
  ) as NotificationDispatcher;
  const execute = vi.fn(async () => ({ affected: 1 }));
  const builder: any = {
    update: vi.fn(() => builder),
    set: vi.fn(() => builder),
    where: vi.fn(() => builder),
    andWhere: vi.fn(() => builder),
    execute,
  };
  (instance as any).workerId = 'worker';
  (instance as any).deliveries = {
    createQueryBuilder: vi.fn(() => builder),
  };
  (instance as any).notifications = { query: vi.fn(async () => undefined) };
  (instance as any).logger = { log: vi.fn() };
  (instance as any).aggregate = vi.fn(async () => undefined);
  return instance;
}

function delivery(overrides: Record<string, any> = {}) {
  return {
    id: 'delivery-1',
    notification: { id: 'notification-1' },
    status: 'processing',
    attempts: 0,
    createdAt: new Date(),
    leaseOwner: 'worker',
    leaseExpiresAt: new Date(),
    ...overrides,
  };
}

describe('notification dispatcher retries', () => {
  it('requeues a transient error using backoff', async () => {
    const instance = dispatcher();
    const item = delivery();
    await (instance as any).finish(item, {
      accepted: false,
      retryable: true,
      errorClass: 'smtp_transient',
    });
    expect(item.status).toBe('pending');
    expect(item.attempts).toBe(1);
    expect(item.nextAttemptAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('fails a permanent error immediately and a transient error after 5 attempts', async () => {
    const permanent = delivery();
    await (dispatcher() as any).finish(permanent, {
      accepted: false,
      retryable: false,
      errorClass: 'recipient_rejected',
    });
    expect(permanent.status).toBe('failed');
    expect(permanent.errorClass).toBe('recipient_rejected');

    const exhausted = delivery({ attempts: 4 });
    await (dispatcher() as any).finish(exhausted, {
      accepted: false,
      retryable: true,
      errorClass: 'smtp_transient',
    });
    expect(exhausted.status).toBe('failed');
    expect(exhausted.errorClass).toBe('retry_exhausted');
  });

  it('does not consume SMTP attempts while a channel is disabled', async () => {
    const item = delivery();
    await (dispatcher() as any).finish(item, {
      accepted: false,
      retryable: true,
      errorClass: 'channel_unavailable',
    });
    expect(item.status).toBe('pending');
    expect(item.attempts).toBe(0);
    expect(item.nextAttemptAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('expires a channel-unavailable delivery after 24 hours', async () => {
    const item = delivery({
      createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000 - 1),
    });
    await (dispatcher() as any).finish(item, {
      accepted: false,
      retryable: true,
      errorClass: 'channel_unavailable',
    });
    expect(item.status).toBe('failed');
    expect(item.errorClass).toBe('retry_exhausted');
  });

  it('does not let a stale worker finish a delivery reclaimed by another worker', async () => {
    const instance = dispatcher();
    const builder = (instance as any).deliveries.createQueryBuilder();
    builder.execute.mockResolvedValueOnce({ affected: 0 });
    const item = delivery();
    await (instance as any).finish(item, { accepted: true });
    expect((instance as any).aggregate).not.toHaveBeenCalled();
    expect((instance as any).logger.log).not.toHaveBeenCalled();
  });

  it('recomputes aggregate state in one database statement', async () => {
    const instance = dispatcher();
    await NotificationDispatcher.prototype.aggregate.call(
      instance,
      'notification-1',
    );
    expect((instance as any).notifications.query).toHaveBeenCalledOnce();
    const [sql, parameters] = (instance as any).notifications.query.mock
      .calls[0];
    expect(sql).toContain('UPDATE notifications');
    expect(parameters).toEqual(['notification-1', 'notification-1']);
  });

  it('fails an expired delivery without contacting its adapter', async () => {
    const instance = dispatcher();
    const item = delivery({
      createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000 - 1),
    });
    (instance as any).deliveries.findOne = vi.fn(async () => item);
    (instance as any).finish = vi.fn(async () => undefined);
    (instance as any).registry = { resolve: vi.fn() };
    await (instance as any).deliver(item.id);
    expect((instance as any).registry.resolve).not.toHaveBeenCalled();
    expect((instance as any).finish).toHaveBeenCalledWith(item, {
      accepted: false,
      retryable: false,
      errorClass: 'retry_exhausted',
    });
  });
});
