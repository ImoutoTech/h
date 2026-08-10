import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { User, Role, Permission, EmailVerificationChallenge } from '@/entity';
import { AuthPermissionService } from '../system/permission.service';
import { EmailVerificationService } from './email-verification.service';
import { EmailVerificationNotifier } from './email-verification-notifier';

@Module({
  controllers: [UserController],
  providers: [
    UserService,
    AuthPermissionService,
    EmailVerificationService,
    EmailVerificationNotifier,
  ],
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([
      User,
      Role,
      Permission,
      EmailVerificationChallenge,
    ]),
  ],
  exports: [UserService, EmailVerificationService],
})
export class UserModule {}
