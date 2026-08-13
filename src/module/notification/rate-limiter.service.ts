import { Inject, Injectable, OnApplicationShutdown } from '@nestjs/common';
import type { RedisClientType } from 'redis';
import { notificationError } from './notification-error';

export const NOTIFICATION_REDIS_CLIENT = Symbol('NotificationRedisClient');

const INCREMENT_BOTH_WITH_TTL = `
local requestValue = redis.call('INCRBY', KEYS[1], 1)
if requestValue == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[2])
end
local recipientValue = redis.call('INCRBY', KEYS[2], ARGV[1])
if recipientValue == tonumber(ARGV[1]) then
  redis.call('EXPIRE', KEYS[2], ARGV[2])
end
return { requestValue, recipientValue }
`;

@Injectable()
export class NotificationRateLimiter implements OnApplicationShutdown {
  constructor(
    @Inject(NOTIFICATION_REDIS_CLIENT)
    private readonly redis: RedisClientType,
  ) {}

  async onApplicationShutdown() {
    if (this.redis.isOpen) await this.redis.quit();
  }

  async consume(callerKey: string, recipients: number) {
    try {
      if (!this.redis.isOpen && !this.redis.isReady) await this.redis.connect();
      const result = (await this.redis.eval(INCREMENT_BOTH_WITH_TTL, {
        keys: [
          `notification:rate:req:${callerKey}`,
          `notification:rate:recipient:${callerKey}`,
        ],
        arguments: [String(recipients), '60'],
      })) as number[];
      const [requestCount, recipientCount] = result.map(Number);
      if (requestCount > 60 || recipientCount > 200)
        notificationError('notification_rate_limited');
    } catch (reason) {
      if (
        reason instanceof Error &&
        reason.message.includes('通知请求过于频繁')
      ) {
        throw reason;
      }
      notificationError('notification_rate_limited');
    }
  }
}
