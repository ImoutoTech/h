import { Module } from '@nestjs/common';
import { OAuthService } from './oauth.service';
import { OAuthController } from './oauth.controller';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { SubApp, SubAppMeta, User, SubAppSecret } from '@/entity';

@Module({
  controllers: [OAuthController],
  providers: [OAuthService],
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([SubApp, User, SubAppMeta, SubAppSecret]),
  ],
})
export class OauthModule {}
