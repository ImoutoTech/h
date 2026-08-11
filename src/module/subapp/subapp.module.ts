import { Module } from '@nestjs/common';
import { SubAppService } from './subapp.service';
import { SubAppController } from './subapp.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  SubApp,
  SubAppMeta,
  User,
  SubAppSecret,
  SubAppResourceGrant,
} from '@/entity';
import { ConfigModule } from '@nestjs/config';
import { OauthModule } from '../oauth/oauth.module';

@Module({
  controllers: [SubAppController],
  providers: [SubAppService],
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([
      SubApp,
      User,
      SubAppMeta,
      SubAppSecret,
      SubAppResourceGrant,
    ]),
    OauthModule,
  ],
})
export class SubappModule {}
