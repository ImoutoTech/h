import { Module, ValidationPipe } from '@nestjs/common';
import { APP_GUARD, APP_PIPE, Reflector } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';

import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ENV_LIST } from './utils/constants';
import { UserModule } from './module/user/user.module';

import { SubappModule } from './module/subapp/subapp.module';
import { RedisModule } from './module/redis/redis.module';
import {
  LoggerModule,
  BusinessException,
  HLOGGER_TOKEN,
  HLogger,
  AuthGuard,
} from '@reus-able/nestjs';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [...ENV_LIST],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        type: 'mysql',
        host: configService.get('MYSQL_SERVER', 'localhost'),
        port: configService.get<number>('MYSQL_PORT', 3306),
        username: configService.get('MYSQL_USER', 'root'),
        password: configService.get('MYSQL_PASSWORD', 'root'),
        database: configService.get('MYSQL_DATABASE', 'h'),
        synchronize: true,
        autoLoadEntities: true,
      }),
    }),
    UserModule,
    SubappModule,
    RedisModule,
    LoggerModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_PIPE,
      useFactory() {
        return new ValidationPipe({
          transform: true,
          transformOptions: {
            enableImplicitConversion: true, // 开启隐式转换
          },
          exceptionFactory: (errors) => {
            const errorProperties = errors.map((e) => e.property).join(',');
            return new BusinessException(
              `参数校验失败，请检查 ${errorProperties}`,
            );
          },
        });
      },
    },
    {
      provide: APP_GUARD,
      useFactory(config: ConfigService, reflector: Reflector, logger: HLogger) {
        return new AuthGuard(config, logger, reflector);
      },
      inject: [ConfigService, Reflector, HLOGGER_TOKEN],
    },
  ],
})
export class AppModule {}
