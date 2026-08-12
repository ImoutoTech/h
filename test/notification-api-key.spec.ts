import { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';
import { NotificationApiKeyService } from '../src/module/notification/api-key.service';

describe('notification API keys', () => {
  function setup() {
    const items: any[] = [];
    const service = new NotificationApiKeyService(
      new ConfigService({ NOTIFICATION_API_KEY_SECRET: 'unit-test-hmac' }),
    );
    (service as any).repo = {
      create: (value: any) => value,
      save: vi.fn(async (value: any) => {
        value.createdAt ||= new Date('2026-08-12T00:00:00Z');
        items.push(value);
        return value;
      }),
      update: vi.fn(async () => ({ affected: 1 })),
      findOne: vi.fn(async ({ where }: any) =>
        items.find((item) => item.id === where.id),
      ),
    };
    (service as any).appRepo = {
      findOne: vi.fn(async () => ({ id: 'app-1', owner: { id: 7 } })),
    };
    (service as any).userRepo = {
      findOneBy: vi.fn(async () => ({ id: 7 })),
    };
    (service as any).logger = { log: vi.fn(), warn: vi.fn() };
    return { service, items };
  }

  it('returns plaintext once while persisting only its digest and hint', async () => {
    const { service, items } = setup();
    const created = await service.create('app-1', 7);
    expect(created.value).toMatch(/^hnt_[0-9a-f-]{36}_/);
    expect(items[0].digest).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(items[0])).not.toContain(created.value);
    expect(items[0].hint).toContain(created.value.slice(-6));
    await expect(service.authenticate(created.value)).resolves.toEqual({
      kind: 'subapp',
      appId: 'app-1',
    });
  });

  it('rejects altered and disabled keys', async () => {
    const { service, items } = setup();
    const created = await service.create('app-1', 7);
    await expect(
      service.authenticate(`${created.value}x`),
    ).rejects.toBeTruthy();
    items[0].enabled = false;
    await expect(service.authenticate(created.value)).rejects.toBeTruthy();
  });
});
