import { describe, expect, it } from 'vitest';
import {
  decryptSecret,
  encryptSecret,
  parseSecretKey,
} from '../src/module/identity/secret-envelope';

describe('provider secret envelope', () => {
  const key = Buffer.alloc(32, 7);

  it('round trips without exposing the secret in the envelope', () => {
    const envelope = encryptSecret('super-secret-value', 'github', key, 'v1');
    expect(JSON.stringify(envelope)).not.toContain('super-secret-value');
    expect(decryptSecret(envelope, 'github', key)).toBe('super-secret-value');
  });

  it('authenticates provider and key version as AAD', () => {
    const envelope = encryptSecret('secret', 'github', key, 'v1');
    expect(() => decryptSecret(envelope, 'google', key)).toThrow();
    expect(() =>
      decryptSecret({ ...envelope, keyVersion: 'v2' }, 'github', key),
    ).toThrow();
  });

  it('detects ciphertext tampering', () => {
    const envelope = encryptSecret('secret', 'github', key, 'v1');
    const bytes = Buffer.from(envelope.ciphertext, 'base64');
    bytes[0] ^= 1;
    expect(() =>
      decryptSecret(
        { ...envelope, ciphertext: bytes.toString('base64') },
        'github',
        key,
      ),
    ).toThrow();
  });

  it('identifies the invalid key variable without exposing its value', () => {
    expect(() => parseSecretKey('not-a-key', 'OIDC_CLIENT_SECRET_KEY')).toThrow(
      'OIDC_CLIENT_SECRET_KEY must be a base64 encoded 32-byte key',
    );
    expect(() => parseSecretKey('not-a-key', 'PROVIDER_SECRET_KEY')).toThrow(
      'PROVIDER_SECRET_KEY must be a base64 encoded 32-byte key',
    );
    try {
      parseSecretKey('sensitive-invalid-value', 'PROVIDER_SECRET_KEY');
    } catch (error) {
      expect(String(error)).not.toContain('sensitive-invalid-value');
    }
  });
});
