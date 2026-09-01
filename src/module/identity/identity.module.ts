import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExternalIdentity, ProviderConfig, User } from '@/entity';
import { IdentityController } from './identity.controller';
import { ExternalIdentityService } from './external-identity.service';
import { ProviderConfigService } from './provider-config.service';
import { UserModule } from '../user/user.module';
import { OneTimeStateService } from './one-time-state.service';
import { ActivityModule } from '../activity/activity.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ExternalIdentity, ProviderConfig, User]),
    UserModule,
    ActivityModule,
  ],
  controllers: [IdentityController],
  providers: [
    ExternalIdentityService,
    ProviderConfigService,
    OneTimeStateService,
  ],
  exports: [ProviderConfigService],
})
export class IdentityModule {}
