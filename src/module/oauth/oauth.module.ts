import { Module } from '@nestjs/common';
import { OAuthService } from './oauth.service';
import { OAuthController, OidcProtocolController } from './oauth.controller';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import {
  Permission,
  Role,
  SubApp,
  SubAppMeta,
  SubAppResourceGrant,
  User,
  SubAppSecret,
} from '@/entity';
import { ClientSecretService } from './client-secret.service';

@Module({
  controllers: [OAuthController, OidcProtocolController],
  providers: [OAuthService, ClientSecretService],
  exports: [OAuthService, ClientSecretService],
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([
      SubApp,
      User,
      SubAppMeta,
      SubAppSecret,
      SubAppResourceGrant,
      Role,
      Permission,
    ]),
  ],
})
export class OauthModule {}
