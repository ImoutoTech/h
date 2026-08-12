import { describe, expect, it, vi } from 'vitest';
import { NotificationRateLimiter } from '../src/module/notification/rate-limiter.service';

describe('notification rate limiting', () => {
  it('uses atomic Redis increments with TTL for both dimensions', async () => {
    const redis = {
      connect: vi.fn(async function (this: { isOpen: boolean }) {
        this.isOpen = true;
      }),
      eval: vi.fn(async () => [1, 3]),
      isOpen: false,
      isReady: false,
    };
    const limiter = new NotificationRateLimiter(redis as any);
    await limiter.consume('app:1', 3);
    expect(redis.eval).toHaveBeenCalledOnce();
    expect(redis.connect).toHaveBeenCalledOnce();
    expect(redis.eval.mock.calls[0][1]).toEqual({
      keys: [
        'notification:rate:req:app:1',
        'notification:rate:recipient:app:1',
      ],
      arguments: ['3', '60'],
    });
  });

  it('fails closed when Redis is unavailable', async () => {
    const limiter = new NotificationRateLimiter({
      connect: vi.fn(async () => {
        throw new Error('redis unavailable');
      }),
      eval: vi.fn(async () => {
        throw new Error('redis unavailable');
      }),
      isOpen: false,
      isReady: false,
    } as any);
    await expect(limiter.consume('app:1', 1)).rejects.toBeTruthy();
  });
});
