import { Module, ValidationPipe } from '@nestjs/common';
import { APP_PIPE } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';

import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ENV_LIST } from './utils/constants';
import { UserModule } from './user/user.module';
import { BusinessException } from './common/exceptions';

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
        synchronize: false,
        autoLoadEntities: true,
      }),
    }),
    UserModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_PIPE,
      useFactory() {
        return new ValidationPipe({
          transform: true,
          exceptionFactory: (errors) => {
            const errorProperties = errors.map((e) => e.property).join(',');
            return new BusinessException(
              `参数校验失败，请检查 ${errorProperties}`,
            );
          },
        });
      },
    },
  ],
})
export class AppModule {}
