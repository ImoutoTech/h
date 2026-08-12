import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { createClient } from 'redis';
import {
  Notification,
  NotificationApiKey,
  NotificationChannelConfig,
  NotificationDelivery,
  NotificationTemplate,
  NotificationTemplateGrant,
  SubApp,
  SubAppNotificationPolicy,
  User,
} from '@/entity';
import { NotificationApiKeyService } from './api-key.service';
import { ChannelAdapterRegistry, TestChannelAdapter } from './channel-adapter';
import { ChannelConfigService } from './channel-config.service';
import { NotificationCleanupService } from './cleanup.service';
import { NotificationDispatcher } from './dispatcher.service';
import { NotificationAdminController } from './notification-admin.controller';
import { NotificationEnvelopeService } from './notification-envelope';
import { NotificationKeyController } from './notification-key.controller';
import { NotificationKeyGuard } from './notification-key.guard';
import { NotificationController } from './notification.controller';
import { NotificationPolicyService } from './policy.service';
import {
  NOTIFICATION_REDIS_CLIENT,
  NotificationRateLimiter,
} from './rate-limiter.service';
import { NotificationService } from './notification.service';
import { SmtpChannelAdapter } from './smtp-channel.adapter';
import { NotificationTemplateService } from './template.service';
import { TemplateRenderer } from './template-renderer';
import {
  CHANNEL_ADAPTERS,
  NOTIFICATION_APPLICATION,
} from './notification.types';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([
      Notification,
      NotificationApiKey,
      NotificationChannelConfig,
      NotificationDelivery,
      NotificationTemplate,
      NotificationTemplateGrant,
      SubApp,
      SubAppNotificationPolicy,
      User,
    ]),
  ],
  controllers: [
    NotificationController,
    NotificationAdminController,
    NotificationKeyController,
  ],
  providers: [
    NotificationEnvelopeService,
    TemplateRenderer,
    ChannelConfigService,
    NotificationTemplateService,
    NotificationPolicyService,
    NotificationApiKeyService,
    NotificationRateLimiter,
    NotificationService,
    NotificationKeyGuard,
    SmtpChannelAdapter,
    TestChannelAdapter,
    {
      provide: CHANNEL_ADAPTERS,
      inject: [SmtpChannelAdapter],
      useFactory: (smtp: SmtpChannelAdapter) => [smtp],
    },
    ChannelAdapterRegistry,
    NotificationDispatcher,
    NotificationCleanupService,
    {
      provide: NOTIFICATION_APPLICATION,
      useExisting: NotificationService,
    },
    {
      provide: NOTIFICATION_REDIS_CLIENT,
      inject: [ConfigService],
      async useFactory(config: ConfigService) {
        const client = createClient({
          socket: {
            host: config.get<string>('REDIS_HOST', 'localhost'),
            port: config.get<number>('REDIS_PORT', 6379),
          },
          username: config.get<string>('REDIS_USERNAME', ''),
          password: config.get<string>('REDIS_AUTHPASS', ''),
          database: config.get<number>('REDIS_DATABASE', 1),
        });
        // Redis is a fail-closed acceptance dependency, not a reason to take
        // management APIs or queued delivery offline at process startup.
        client.on('error', () => undefined);
        return client;
      },
    },
  ],
  exports: [NOTIFICATION_APPLICATION, NotificationService],
})
export class NotificationModule {}
