import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExternalIdentity, ProviderConfig, User } from '@/entity';
import { IdentityController } from './identity.controller';
import { ExternalIdentityService } from './external-identity.service';
import { ProviderConfigService } from './provider-config.service';
import { UserModule } from '../user/user.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ExternalIdentity, ProviderConfig, User]),
    UserModule,
  ],
  controllers: [IdentityController],
  providers: [ExternalIdentityService, ProviderConfigService],
  exports: [ProviderConfigService],
})
export class IdentityModule {}
