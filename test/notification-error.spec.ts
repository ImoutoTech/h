import { HttpStatus } from '@nestjs/common';
import { BusinessException } from '@reus-able/nestjs';
import { describe, expect, it } from 'vitest';
import {
  notificationError,
  type NotificationErrorCode,
} from '../src/module/notification/notification-error';

const expectedStatuses: Record<NotificationErrorCode, HttpStatus> = {
  notification_invalid_key: HttpStatus.UNAUTHORIZED,
  notification_disabled_key: HttpStatus.UNAUTHORIZED,
  notification_insufficient_capability: HttpStatus.FORBIDDEN,
  notification_template_missing: HttpStatus.NOT_FOUND,
  notification_template_disabled: HttpStatus.CONFLICT,
  notification_template_forbidden: HttpStatus.FORBIDDEN,
  notification_invalid_variables: HttpStatus.BAD_REQUEST,
  notification_invalid_recipient: HttpStatus.BAD_REQUEST,
  notification_too_many_recipients: HttpStatus.BAD_REQUEST,
  notification_rate_limited: HttpStatus.TOO_MANY_REQUESTS,
  notification_idempotency_conflict: HttpStatus.CONFLICT,
  notification_channel_unavailable: HttpStatus.SERVICE_UNAVAILABLE,
  notification_not_found: HttpStatus.NOT_FOUND,
};

describe('notificationError', () => {
  it.each(Object.entries(expectedStatuses))(
    'maps %s to HTTP %s',
    (code, expectedStatus) => {
      try {
        notificationError(code as NotificationErrorCode);
      } catch (error) {
        expect(error).toBeInstanceOf(BusinessException);
        expect((error as BusinessException).getResponse()).toMatchObject({
          code,
          httpCode: expectedStatus,
        });
        return;
      }

      throw new Error('notificationError did not throw');
    },
  );
});
