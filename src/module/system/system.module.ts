import { Module } from '@nestjs/common';
import { SystemService } from './system.service';
import { SystemController } from './system.controller';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Role, Permission } from '@/entity';
import { AuthPermissionService } from './permission.service';
import { PERMISSION_SERVICE_TOKEN } from '@reus-able/nestjs';

@Module({
  controllers: [SystemController],
  providers: [
    SystemService,
    {
      provide: PERMISSION_SERVICE_TOKEN,
      useClass: AuthPermissionService,
    },
  ],
  imports: [ConfigModule, TypeOrmModule.forFeature([Role, Permission])],
  exports: [PERMISSION_SERVICE_TOKEN],
})
export class SystemModule {}
