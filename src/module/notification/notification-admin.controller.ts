import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import { PermissionGuard, UserParams } from '@reus-able/nestjs';
import type { UserJwtPayload } from '@reus-able/types';
import {
  CreateNotificationTemplateDto,
  SetEnabledDto,
  UpdateNotificationChannelDto,
  UpdateNotificationPolicyDto,
  UpdateNotificationTemplateDto,
} from '@/dto';
import { ChannelConfigService } from './channel-config.service';
import { NotificationPolicyService } from './policy.service';
import { NotificationTemplateService } from './template.service';

@Controller({ path: 'notification-admin', version: '1' })
export class NotificationAdminController {
  constructor(
    private readonly channels: ChannelConfigService,
    private readonly templates: NotificationTemplateService,
    private readonly policies: NotificationPolicyService,
  ) {}

  @Get('channels/email')
  @PermissionGuard('notification-channel-admin')
  channel() {
    return this.channels.get();
  }

  @Put('channels/email')
  @PermissionGuard('notification-channel-admin')
  updateChannel(
    @Body() body: UpdateNotificationChannelDto,
    @UserParams() actor: UserJwtPayload,
  ) {
    return this.channels.update(body, actor.id);
  }

  @Get('templates')
  @PermissionGuard('notification-template-admin')
  listTemplates() {
    return this.templates.list();
  }

  @Get('template-options')
  @PermissionGuard('notification-policy-admin')
  templateOptions() {
    return this.templates.options();
  }

  @Post('templates')
  @PermissionGuard('notification-template-admin')
  createTemplate(
    @Body() body: CreateNotificationTemplateDto,
    @UserParams() actor: UserJwtPayload,
  ) {
    return this.templates.create(body, actor.id);
  }

  @Get('templates/:id')
  @PermissionGuard('notification-template-admin')
  template(@Param('id') id: string) {
    return this.templates.get(id);
  }

  @Put('templates/:id')
  @PermissionGuard('notification-template-admin')
  updateTemplate(
    @Param('id') id: string,
    @Body() body: UpdateNotificationTemplateDto,
    @UserParams() actor: UserJwtPayload,
  ) {
    return this.templates.update(id, body, actor.id);
  }

  @Put('templates/:id/enabled')
  @PermissionGuard('notification-template-admin')
  setTemplateEnabled(
    @Param('id') id: string,
    @Body() body: SetEnabledDto,
    @UserParams() actor: UserJwtPayload,
  ) {
    return this.templates.setEnabled(id, body.enabled, actor.id);
  }

  @Get('apps/:appId/policy')
  @PermissionGuard('notification-policy-admin')
  policy(@Param('appId') appId: string) {
    return this.policies.get(appId);
  }

  @Get('apps')
  @PermissionGuard('notification-policy-admin')
  apps() {
    return this.policies.listApps();
  }

  @Put('apps/:appId/policy')
  @PermissionGuard('notification-policy-admin')
  updatePolicy(
    @Param('appId') appId: string,
    @Body() body: UpdateNotificationPolicyDto,
    @UserParams() actor: UserJwtPayload,
  ) {
    return this.policies.update(appId, body, actor.id);
  }
}
