import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';

import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ENV_LIST } from './utils/constants';

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
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
