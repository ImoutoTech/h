import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { SubmitNotificationDto } from '@/dto';
import { NotificationKeyGuard } from './notification-key.guard';
import { notificationError } from './notification-error';
import { NotificationService } from './notification.service';
import type {
  NotificationCaller,
  SubmitNotificationCommand,
} from './notification.types';

@Controller({ path: 'notifications', version: '1' })
@UseGuards(NotificationKeyGuard)
export class NotificationController {
  constructor(private readonly notifications: NotificationService) {}

  @Post()
  submit(
    @Body() body: SubmitNotificationDto,
    @Req() request: { notificationCaller: NotificationCaller },
  ) {
    return this.notifications.submit({
      caller: request.notificationCaller,
      recipients: body.recipients.map((recipient) => {
        if (
          recipient.kind === 'user' &&
          recipient.userId &&
          recipient.email === undefined
        ) {
          return { kind: 'user' as const, userId: recipient.userId };
        }
        if (
          recipient.kind === 'email' &&
          recipient.email &&
          recipient.userId === undefined
        ) {
          return { kind: 'email' as const, email: recipient.email };
        }
        notificationError('notification_invalid_recipient');
      }),
      content: this.content(body),
      idempotencyKey: body.idempotencyKey,
    });
  }

  @Get(':id')
  status(
    @Param('id') id: string,
    @Req() request: { notificationCaller: NotificationCaller },
  ) {
    return this.notifications.status(request.notificationCaller, id);
  }

  private content(
    body: SubmitNotificationDto,
  ): SubmitNotificationCommand['content'] {
    const content = body.content;
    if (
      content.kind === 'template' &&
      content.templateKey &&
      content.variables &&
      content.subject === undefined &&
      content.text === undefined &&
      content.html === undefined
    ) {
      return {
        kind: 'template',
        templateKey: content.templateKey,
        variables: content.variables,
      };
    }
    if (
      content.kind === 'content' &&
      content.subject !== undefined &&
      content.text !== undefined &&
      content.templateKey === undefined &&
      content.variables === undefined
    ) {
      return {
        kind: 'content',
        subject: content.subject,
        text: content.text,
        html: content.html,
      };
    }
    notificationError('notification_invalid_variables');
  }
}
