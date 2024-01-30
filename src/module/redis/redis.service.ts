import { Injectable, Inject, Logger } from '@nestjs/common';
import { isNil } from 'lodash';
import { RedisClientType } from 'redis';
import { REDIS_CLIENT } from '@/utils/constants';

@Injectable()
export class RedisService {
  @Inject(REDIS_CLIENT)
  private redisClient: RedisClientType;

  private logger = new Logger();

  log(text: string) {
    this.logger.log(text, 'RedisService');
  }

  warn(text: string) {
    this.logger.warn(text, 'RedisService');
  }

  async get(key: string) {
    const data = await this.redisClient.get(key);
    if (isNil(data)) {
      this.warn(`Redis get key ${key}，缓存未命中`);
    } else {
      this.log(`Redis get key ${key}，命中缓存`);
    }
    return data;
  }

  async set(key: string, value: string | number, ttl?: number) {
    await this.redisClient.set(key, value);

    if (ttl) {
      await this.redisClient.expire(key, ttl);
    }
    this.log(`Redis set key ${key}，更新缓存, ttl=${ttl}`);
  }

  async hashGet(key: string) {
    const data = await this.redisClient.hGetAll(key);
    if (isNil(data)) {
      this.warn(`Redis hashGet key ${key}，缓存未命中`);
    } else {
      this.log(`Redis hashGet key ${key}，命中缓存`);
    }
    return data;
  }

  async hashSet(key: string, obj: Record<string, any>, ttl?: number) {
    for (const name in obj) {
      await this.redisClient.hSet(key, name, obj[name]);
    }

    if (ttl) {
      await this.redisClient.expire(key, ttl);
    }
    this.log(`Redis hashSet key ${key}，更新缓存, ttl=${ttl}`);
  }
}
