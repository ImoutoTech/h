import { Inject, Injectable } from '@nestjs/common';
import { BusinessException } from '@reus-able/nestjs';
import { EmailVerificationPurpose } from '@/entity/email-verification-purpose';
import {
  NOTIFICATION_APPLICATION,
  type NotificationApplication,
} from '../notification/notification.types';

@Injectable()
export class EmailNotificationService {
  constructor(
    @Inject(NOTIFICATION_APPLICATION)
    private readonly notifications: NotificationApplication,
  ) {}

  async sendVerificationCode(input: {
    challengeId: string;
    email: string;
    code: string;
    purpose: EmailVerificationPurpose;
    expiresAt: Date;
  }): Promise<void> {
    try {
      await this.notifications.submit({
        caller: { kind: 'internal', name: 'sso-email-verification' },
        recipients: [{ kind: 'email', email: input.email }],
        content: {
          kind: 'template',
          templateKey: 'account.email.verify',
          variables: {
            code: input.code,
            purpose: input.purpose,
            expiresAt: input.expiresAt.toISOString(),
          },
        },
        idempotencyKey: input.challengeId,
      });
    } catch {
      throw new BusinessException('邮件服务暂时不可用');
    }
  }
}
