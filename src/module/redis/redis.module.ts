import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RedisService } from './redis.service';

import { REDIS_CLIENT } from '@/utils/constants';
import { createClient } from 'redis';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    RedisService,
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      async useFactory(config: ConfigService) {
        const client = createClient({
          socket: {
            host: config.get('REDIS_HOST', 'localhost'),
            port: config.get<number>('REDIS_PORT', 6379),
          },
          username: config.get('REDIS_USERNAME', ''),
          password: config.get('REDIS_AUTHPASS', ''),
          database: config.get<number>('REDIS_DATABASE', 1),
        });
        await client.connect();
        return client;
      },
    },
  ],
  exports: [RedisService],
})
export class RedisModule {}
