import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import {
  User,
  Role,
  Permission,
  EmailVerificationAttempt,
  EmailVerificationChallenge,
} from '@/entity';
import { AuthPermissionService } from '../system/permission.service';
import { EmailVerificationService } from './email-verification.service';
import { EmailNotificationService } from './email-notification.service';
import { NotificationModule } from '../notification/notification.module';
import { ActivityModule } from '../activity/activity.module';

@Module({
  controllers: [UserController],
  providers: [
    UserService,
    AuthPermissionService,
    EmailVerificationService,
    EmailNotificationService,
  ],
  imports: [
    ConfigModule,
    NotificationModule,
    ActivityModule,
    TypeOrmModule.forFeature([
      User,
      Role,
      Permission,
      EmailVerificationAttempt,
      EmailVerificationChallenge,
    ]),
  ],
  exports: [UserService],
})
export class UserModule {}
