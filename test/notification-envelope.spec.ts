import { ConfigService } from '@nestjs/config';
import { describe, expect, it } from 'vitest';
import { NotificationEnvelopeService } from '../src/module/notification/notification-envelope';

describe('notification envelope', () => {
  const current = Buffer.alloc(32, 3).toString('base64');
  const old = Buffer.alloc(32, 7).toString('base64');

  function service(extra: Record<string, string> = {}) {
    return new NotificationEnvelopeService(
      new ConfigService({
        NOTIFICATION_SECRET_KEY: current,
        NOTIFICATION_SECRET_KEY_VERSION: 'v2',
        NOTIFICATION_SECRET_KEYS: JSON.stringify({ v1: old }),
        ...extra,
      }),
    );
  }

  it('round trips without exposing plaintext and authenticates purpose', () => {
    const envelopes = service();
    const envelope = envelopes.encrypt(
      'private@example.com',
      'notification-recipient:d1',
    );
    expect(JSON.stringify(envelope)).not.toContain('private@example.com');
    expect(envelopes.decrypt(envelope, 'notification-recipient:d1')).toBe(
      'private@example.com',
    );
    expect(() =>
      envelopes.decrypt(envelope, 'notification-content:d1'),
    ).toThrow();
  });

  it('detects tampering and can decrypt a retained old key version', () => {
    const legacyWriter = service({
      NOTIFICATION_SECRET_KEY: old,
      NOTIFICATION_SECRET_KEY_VERSION: 'v1',
      NOTIFICATION_SECRET_KEYS: '{}',
    });
    const envelope = legacyWriter.encrypt('secret', 'notification-content:n1');
    const reader = service();
    expect(reader.decrypt(envelope, 'notification-content:n1')).toBe('secret');
    const bytes = Buffer.from(envelope.ciphertext, 'base64');
    bytes[0] ^= 1;
    expect(() =>
      reader.decrypt(
        { ...envelope, ciphertext: bytes.toString('base64') },
        'notification-content:n1',
      ),
    ).toThrow();
  });

  it('returns only a suffix hint', () => {
    expect(service().hint('smtp-password')).toBe('••••word');
    expect(service().hint('1234')).toBe('••••');
  });
});
