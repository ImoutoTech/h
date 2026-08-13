import { HttpStatus } from '@nestjs/common';
import { BusinessException } from '@reus-able/nestjs';

export type NotificationErrorCode =
  | 'notification_invalid_key'
  | 'notification_disabled_key'
  | 'notification_insufficient_capability'
  | 'notification_template_missing'
  | 'notification_template_disabled'
  | 'notification_template_forbidden'
  | 'notification_invalid_variables'
  | 'notification_invalid_recipient'
  | 'notification_too_many_recipients'
  | 'notification_rate_limited'
  | 'notification_idempotency_conflict'
  | 'notification_channel_unavailable'
  | 'notification_not_found';

const messages: Record<NotificationErrorCode, string> = {
  notification_invalid_key: '通知密钥无效',
  notification_disabled_key: '通知密钥已停用',
  notification_insufficient_capability: '应用没有所需通知能力',
  notification_template_missing: '消息模板不存在',
  notification_template_disabled: '消息模板已停用',
  notification_template_forbidden: '应用无权使用此消息模板',
  notification_invalid_variables: '模板变量无效',
  notification_invalid_recipient: '通知收件人无效',
  notification_too_many_recipients: '单次通知最多包含 20 个收件人',
  notification_rate_limited: '通知请求过于频繁',
  notification_idempotency_conflict: '幂等键已用于不同的通知请求',
  notification_channel_unavailable: 'Email 通知渠道不可用',
  notification_not_found: '通知不存在',
};

const statuses: Record<NotificationErrorCode, HttpStatus> = {
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

export function notificationError(code: NotificationErrorCode): never {
  throw new BusinessException({
    code,
    message: messages[code],
    httpCode: statuses[code],
  } as any);
}
