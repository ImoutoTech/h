import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { PermissionGuard, UserParams } from '@reus-able/nestjs';
import type { UserJwtPayload } from '@reus-able/types';
import { SetEnabledDto } from '@/dto';
import { NotificationApiKeyService } from './api-key.service';

@Controller({ path: 'apps/:appId/notification-keys', version: '1' })
export class NotificationKeyController {
  constructor(private readonly keys: NotificationApiKeyService) {}

  @Get()
  @PermissionGuard('PeqSazMt')
  list(@Param('appId') appId: string, @UserParams() actor: UserJwtPayload) {
    return this.keys.list(appId, actor.id);
  }

  @Post()
  @PermissionGuard('QffBvVPP')
  create(@Param('appId') appId: string, @UserParams() actor: UserJwtPayload) {
    return this.keys.create(appId, actor.id);
  }

  @Put(':keyId/enabled')
  @PermissionGuard('QffBvVPP')
  setEnabled(
    @Param('appId') appId: string,
    @Param('keyId') keyId: string,
    @Body() body: SetEnabledDto,
    @UserParams() actor: UserJwtPayload,
  ) {
    return this.keys.setEnabled(appId, keyId, body.enabled, actor.id);
  }

  @Delete(':keyId')
  @PermissionGuard('QffBvVPP')
  remove(
    @Param('appId') appId: string,
    @Param('keyId') keyId: string,
    @UserParams() actor: UserJwtPayload,
  ) {
    return this.keys.remove(appId, keyId, actor.id);
  }
}
