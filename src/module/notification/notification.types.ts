export type NotificationCaller =
  | { kind: 'internal'; name: string }
  | { kind: 'subapp'; appId: string };

export type SubmitNotificationCommand = {
  caller: NotificationCaller;
  recipients: Array<
    { kind: 'user'; userId: number } | { kind: 'email'; email: string }
  >;
  content:
    | {
        kind: 'template';
        templateKey: string;
        variables: Record<string, string>;
      }
    | { kind: 'content'; subject: string; text: string; html?: string };
  idempotencyKey?: string;
};

export type RenderedNotificationContent = {
  subject: string;
  text: string;
  html?: string;
};

export interface NotificationStatusProjection {
  notificationId: string;
  status: 'pending' | 'processing' | 'sent' | 'partial_failed' | 'failed';
  total: number;
  sent: number;
  failed: number;
  pending: number;
  errorClasses: Record<string, number>;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationApplication {
  submit(
    command: SubmitNotificationCommand,
  ): Promise<{ notificationId: string }>;
  status(
    caller: NotificationCaller,
    id: string,
  ): Promise<NotificationStatusProjection>;
}

export type ChannelMessage = RenderedNotificationContent & {
  to: string;
};

export type ChannelSendResult =
  | { accepted: true }
  | { accepted: false; retryable: boolean; errorClass: string };

export interface ChannelAdapter {
  readonly channelType: 'email';
  send(message: ChannelMessage): Promise<ChannelSendResult>;
}

export const NOTIFICATION_APPLICATION = Symbol('NotificationApplication');
export const CHANNEL_ADAPTERS = Symbol('ChannelAdapters');
