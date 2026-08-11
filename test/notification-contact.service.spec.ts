import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/entity', () => ({ User: class User {} }));

import { NotificationContactService } from '../src/module/internal/notification-contact.service';

describe('notification contact lookup', () => {
  it('selects only contact columns and returns verified contact', async () => {
    const service = new NotificationContactService();
    const findOne = vi.fn().mockResolvedValue({
      id: 7,
      email: 'verified@example.test',
      emailVerifiedAt: new Date('2026-08-11T00:00:00Z'),
    });
    (service as any).users = { findOne };
    (service as any).logger = { log: vi.fn() };

    await expect(
      service.email(7, 'notification-service', 'trace-1'),
    ).resolves.toEqual({
      userId: 7,
      address: 'verified@example.test',
      verifiedAt: new Date('2026-08-11T00:00:00Z'),
    });
    expect(findOne).toHaveBeenCalledWith({
      where: { id: 7 },
      select: { id: true, email: true, emailVerifiedAt: true },
    });
  });

  it.each([
    null,
    { id: 7, email: 'pending@example.test', emailVerifiedAt: null },
  ])(
    'uses the same unavailable result for missing and unverified users',
    async (user) => {
      const service = new NotificationContactService();
      (service as any).users = { findOne: vi.fn().mockResolvedValue(user) };
      (service as any).logger = { log: vi.fn() };
      await expect(
        service.email(7, 'notification-service', 'trace-1'),
      ).resolves.toBeUndefined();
    },
  );
});
