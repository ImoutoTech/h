import { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';
import { NotificationEnvelopeService } from '../src/module/notification/notification-envelope';
import { NotificationService } from '../src/module/notification/notification.service';
import { TemplateRenderer } from '../src/module/notification/template-renderer';

function baseService() {
  const service = Object.create(
    NotificationService.prototype,
  ) as NotificationService;
  (service as any).userRepo = {
    findBy: vi.fn(async () => [{ id: 1, email: 'Owner@Example.com' }]),
  };
  (service as any).renderer = new TemplateRenderer();
  return service;
}

describe('notification acceptance boundaries', () => {
  it('resolves mixed targets, normalizes and deduplicates them', async () => {
    const service = baseService();
    await expect(
      (service as any).resolveRecipients(
        [
          { kind: 'user', userId: 1 },
          { kind: 'email', email: 'owner@example.com' },
        ],
        { kind: 'subapp', appId: 'app-1' },
        true,
      ),
    ).resolves.toEqual(['owner@example.com']);
  });

  it('rejects manual targets without capability and any missing user atomically', async () => {
    const service = baseService();
    await expect(
      (service as any).resolveRecipients(
        [{ kind: 'email', email: 'guest@example.com' }],
        { kind: 'subapp', appId: 'app-1' },
        false,
      ),
    ).rejects.toBeTruthy();
    (service as any).userRepo.findBy = vi.fn(async () => []);
    await expect(
      (service as any).resolveRecipients(
        [{ kind: 'user', userId: 99 }],
        { kind: 'subapp', appId: 'app-1' },
        false,
      ),
    ).rejects.toBeTruthy();
  });

  it('applies the 20-recipient limit after deduplication', async () => {
    const service = baseService();
    const callers = Array.from({ length: 21 }, (_, index) => ({
      kind: 'email' as const,
      email: `person-${index}@example.com`,
    }));
    await expect(
      (service as any).resolveRecipients(
        callers,
        { kind: 'internal', name: 'test' },
        false,
      ),
    ).rejects.toBeTruthy();
  });

  it('enforces direct-content and template grants from current policy', async () => {
    const service = baseService();
    (service as any).templateRepo = {
      findOneBy: vi.fn(async () => ({
        id: 'template-1',
        key: 'account.verify',
        enabled: true,
        subject: '{{code}}',
        text: '{{code}}',
        html: null,
        allowedVariables: ['code'],
      })),
    };
    await expect(
      (service as any).resolveContent(
        {
          content: { kind: 'content', subject: 'Subject', text: 'Text' },
        },
        { directContent: false, templateIds: new Set() },
      ),
    ).rejects.toBeTruthy();
    await expect(
      (service as any).resolveContent(
        {
          content: {
            kind: 'template',
            templateKey: 'account.verify',
            variables: { code: '123' },
          },
        },
        { directContent: false, templateIds: new Set() },
      ),
    ).rejects.toBeTruthy();
  });

  it('returns an existing idempotent notification before rate limiting', async () => {
    const service = baseService();
    (service as any).policies = {};
    const content = { subject: 'Subject', text: 'Text' };
    const hash = (service as any).hash({
      recipients: ['guest@example.com'],
      content,
      channelType: 'email',
    });
    (service as any).repo = {
      findOneBy: vi.fn(async () => ({ id: 'existing', requestHash: hash })),
    };
    (service as any).limits = { consume: vi.fn() };
    await expect(
      service.submit({
        caller: { kind: 'internal', name: 'test' },
        recipients: [{ kind: 'email', email: 'guest@example.com' }],
        content: { kind: 'content', ...content },
        idempotencyKey: 'operation-1',
      }),
    ).resolves.toEqual({ notificationId: 'existing' });
    expect((service as any).limits.consume).not.toHaveBeenCalled();
  });

  it('uses one transaction for root and all recipient deliveries', async () => {
    const service = baseService();
    (service as any).policies = {};
    (service as any).repo = {
      findOneBy: vi.fn(async () => null),
      create: (value: any) => value,
      manager: {
        transaction: vi.fn(async (work: any) =>
          work({
            getRepository: (entity: any) => ({
              save: entity.name === 'Notification' ? vi.fn() : vi.fn(),
            }),
          }),
        ),
      },
    };
    (service as any).deliveryRepo = { create: (value: any) => value };
    (service as any).channelRepo = {
      findOneBy: vi.fn(async () => ({
        enabled: true,
        host: 'smtp.example.com',
        port: 587,
        username: 'user',
        passwordCiphertext: 'ciphertext',
        fromAddress: 'sender@example.com',
      })),
    };
    (service as any).limits = { consume: vi.fn() };
    (service as any).config = new ConfigService({
      NOTIFICATION_API_KEY_SECRET: 'digest-key',
    });
    (service as any).envelopes = new NotificationEnvelopeService(
      new ConfigService({
        NOTIFICATION_SECRET_KEY: Buffer.alloc(32, 5).toString('base64'),
        NOTIFICATION_SECRET_KEY_VERSION: 'v1',
      }),
    );
    const result = await service.submit({
      caller: { kind: 'internal', name: 'test' },
      recipients: [{ kind: 'email', email: 'guest@example.com' }],
      content: { kind: 'content', subject: 'Subject', text: 'Text' },
    });
    expect(result.notificationId).toMatch(/^[0-9a-f-]{36}$/);
    expect((service as any).repo.manager.transaction).toHaveBeenCalledOnce();
  });

  it('enforces content limits for internal callers after rendering', async () => {
    const service = baseService();
    await expect(
      (service as any).resolveContent(
        {
          content: {
            kind: 'content',
            subject: 'x'.repeat(256),
            text: 'Text',
          },
        },
        null,
      ),
    ).rejects.toBeTruthy();
  });
});
