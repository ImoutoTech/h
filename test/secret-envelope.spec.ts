import { describe, expect, it } from 'vitest';
import {
  decryptSecret,
  encryptSecret,
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
});
