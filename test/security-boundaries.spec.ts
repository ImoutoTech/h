import { generateKeyPairSync } from 'crypto';
import { describe, expect, it } from 'vitest';
import {
  decryptSecret,
  encryptSecret,
} from '../src/module/identity/secret-envelope';
import { PERMISSION_LIST, ROLE_LIST } from '../src/utils/constants';
import { publicJwks } from '../src/module/oauth/public-jwks';
import { consumeJson } from '../src/module/identity/one-time-state';
import { isRegisteredContinuation } from '../src/module/oauth/continuation-url';
import { safeHouseCallbackUrl } from '../src/module/identity/safe-house-callback';

describe('security boundaries', () => {
  it('uses a dedicated client credential key and detects cross-key decryption', () => {
    const clientKey = Buffer.alloc(32, 1);
    const providerKey = Buffer.alloc(32, 2);
    const envelope = encryptSecret(
      'client-secret',
      'oidc-client:app-1',
      clientKey,
      'client-v1',
    );
    expect(envelope.ciphertext).not.toContain('client-secret');
    expect(() =>
      decryptSecret(envelope, 'oidc-client:app-1', providerKey),
    ).toThrow();
    expect(decryptSecret(envelope, 'oidc-client:app-1', clientKey)).toBe(
      'client-secret',
    );
  });

  it('publishes the previous public JWK without retaining its private key', () => {
    const current = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const previous = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const currentPrivate: any = current.privateKey.export({ format: 'jwk' });
    const previousPublic: any = previous.publicKey.export({ format: 'jwk' });
    currentPrivate.kid = 'current';
    previousPublic.kid = 'previous';
    const jwks = publicJwks(currentPrivate, previousPublic);
    expect(jwks.keys.map((key: any) => key.kid)).toEqual([
      'current',
      'previous',
    ]);
    expect(jwks.keys.every((key: any) => key.d === undefined)).toBe(true);
  });

  it('seeds provider administration only into the administrator role', () => {
    expect(
      PERMISSION_LIST.some((item) => item.code === 'oauth-provider-admin'),
    ).toBe(true);
    expect(ROLE_LIST[0].permissions).toContain('oauth-provider-admin');
    expect(ROLE_LIST[1].permissions).not.toContain('oauth-provider-admin');
  });

  it('atomically consumes external state and rejects replay', async () => {
    let value: string | null = JSON.stringify({ provider: 'github' });
    const client = {
      async getDel() {
        const result = value;
        value = null;
        return result;
      },
    };
    expect(await consumeJson<any>(client, 'state')).toEqual({
      provider: 'github',
    });
    expect(await consumeJson<any>(client, 'state')).toBeUndefined();
  });

  it('accepts approve/deny continuations only on the exact callback', () => {
    const registered = ['https://client.example/callback?tenant=one'];
    expect(
      isRegisteredContinuation(
        'https://client.example/callback?tenant=one&code=abc&state=s',
        registered,
      ),
    ).toBe(true);
    expect(
      isRegisteredContinuation(
        'https://client.example/callback?tenant=one&error=access_denied&state=s',
        registered,
      ),
    ).toBe(true);
    expect(
      isRegisteredContinuation(
        'https://evil.example/callback?tenant=one&code=abc',
        registered,
      ),
    ).toBe(false);
    expect(
      isRegisteredContinuation(
        'https://client.example/callback/extra?tenant=one&code=abc',
        registered,
      ),
    ).toBe(false);
  });

  it('redirects provider callbacks only to configured safe-house', () => {
    expect(safeHouseCallbackUrl('https://safe.example', 'opaque')).toBe(
      'https://safe.example/external/callback?result=opaque',
    );
    expect(() =>
      safeHouseCallbackUrl('https://safe.example@evil.example', 'opaque'),
    ).toThrow();
    expect(() =>
      safeHouseCallbackUrl('http://safe.example', 'opaque'),
    ).toThrow();
  });

  it('binds ciphertext AAD to a single client', () => {
    const envelope = encryptSecret(
      'secret',
      'oidc-client:a',
      Buffer.alloc(32, 3),
      'v1',
    );
    expect(() =>
      decryptSecret(envelope, 'oidc-client:b', Buffer.alloc(32, 3)),
    ).toThrow();
  });
});
