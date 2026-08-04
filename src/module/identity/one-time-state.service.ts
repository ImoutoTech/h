import { Injectable } from '@nestjs/common';
import { RedisService } from '@reus-able/nestjs';
import { consumeJson } from './one-time-state';

interface RedisGetDelClient {
  getDel(key: string): Promise<string | null>;
}

@Injectable()
export class OneTimeStateService {
  constructor(private readonly cache: RedisService) {}

  async consume<T>(key: string): Promise<T | undefined> {
    // @reus-able/nestjs intentionally exports RedisService but not its raw
    // client token. Keep this compatibility access isolated in one adapter so
    // feature services never depend on a non-exported Nest provider.
    const client = (
      this.cache as unknown as { redisClient?: RedisGetDelClient }
    ).redisClient;
    if (!client || typeof client.getDel !== 'function') {
      throw new Error('Redis client does not support atomic GETDEL');
    }
    return consumeJson<T>(client, key);
  }
}
