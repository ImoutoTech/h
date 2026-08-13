import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import {
  SetEnabledDto,
  SubmitNotificationDto,
  UpdateNotificationChannelDto,
} from '../src/dto';
import { NotificationAdminController } from '../src/module/notification/notification-admin.controller';
import { NotificationKeyController } from '../src/module/notification/notification-key.controller';
import { NotificationController } from '../src/module/notification/notification.controller';

describe('notification controller validation metadata', () => {
  it('retains runtime DTO classes for the global ValidationPipe', () => {
    expect(
      Reflect.getMetadata(
        'design:paramtypes',
        NotificationController.prototype,
        'submit',
      )[0],
    ).toBe(SubmitNotificationDto);
    expect(
      Reflect.getMetadata(
        'design:paramtypes',
        NotificationAdminController.prototype,
        'updateChannel',
      )[0],
    ).toBe(UpdateNotificationChannelDto);
    expect(
      Reflect.getMetadata(
        'design:paramtypes',
        NotificationKeyController.prototype,
        'setEnabled',
      )[2],
    ).toBe(SetEnabledDto);
  });

  it('rejects a submit body without its nested content object', async () => {
    const value = plainToInstance(SubmitNotificationDto, {
      recipients: [{ kind: 'user', userId: 1 }],
    });
    await expect(validate(value)).resolves.not.toHaveLength(0);
  });
});
