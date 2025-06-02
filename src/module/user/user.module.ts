import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { User, Role, Permission } from '@/entity';
import { AuthPermissionService } from '../system/permission.service';

@Module({
  controllers: [UserController],
  providers: [UserService, AuthPermissionService],
  imports: [ConfigModule, TypeOrmModule.forFeature([User, Role, Permission])],
})
export class UserModule {}
