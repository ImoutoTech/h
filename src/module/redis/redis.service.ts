import { Injectable, Inject } from '@nestjs/common';
import { isNil } from 'lodash';
import { RedisClientType } from 'redis';
import { REDIS_CLIENT } from '@/utils/constants';
import { HLOGGER_TOKEN, HLogger } from '../logger/logger.service';

@Injectable()
export class RedisService {
  @Inject(REDIS_CLIENT)
  private redisClient: RedisClientType;

  @Inject(HLOGGER_TOKEN)
  private logger: HLogger;

  log(text: string) {
    this.logger.log(text, 'RedisService');
  }

  warn(text: string) {
    this.logger.warn(text, 'RedisService');
  }

  async del(key: string) {
    await this.redisClient.del(key);
    this.log(`Redis del key ${key}，删除缓存`);
    return true;
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

  async jsonGet<T>(key: string) {
    const data = await this.redisClient.get(key);
    if (isNil(data)) {
      this.warn(`Redis jsonGet key ${key}，缓存未命中`);
    } else {
      this.log(`Redis jsonGet key ${key}，命中缓存`);
    }
    return JSON.parse(data) as T;
  }

  async jsonSet(key: string, obj: Record<string, any>, ttl?: number) {
    await this.redisClient.set(key, JSON.stringify(obj));

    if (ttl) {
      await this.redisClient.expire(key, ttl);
    }
    this.log(`Redis jsonSet key ${key}，更新缓存, ttl=${ttl}`);
  }
}
