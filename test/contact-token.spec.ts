import { generateKeyPairSync } from 'crypto';
import * as jwt from 'jsonwebtoken';
import { describe, expect, it } from 'vitest';
import {
  ContactTokenError,
  ContactTokenService,
} from '../src/module/internal/contact-token.service';

function fixture() {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
  });
  const issuer = 'https://identity.example.test/oidc';
  const values: Record<string, string> = {
    OIDC_ISSUER: issuer,
    OIDC_SIGNING_JWK: JSON.stringify(privateKey.export({ format: 'jwk' })),
    NOTIFICATION_CONTACT_CLIENT_IDS: 'notification-service',
  };
  const service = new ContactTokenService();
  (service as any).config = {
    get: (key: string) => values[key],
    getOrThrow: (key: string) => {
      if (!values[key]) throw new Error(`missing ${key}`);
      return values[key];
    },
  };
  const token = (claims: Record<string, unknown> = {}) => {
    const audience = String(claims.aud || 'h-internal');
    const payload = { ...claims };
    delete payload.aud;
    return jwt.sign(
      {
        scope: 'users:contact:read',
        client_id: 'notification-service',
        ...payload,
      },
      privateKey,
      { algorithm: 'RS256', issuer, audience, expiresIn: 300 },
    );
  };
  return { service, token, privateKey, publicKey };
}

describe('notification contact token boundary', () => {
  it('accepts only a signed h-internal token with contact scope and allowlisted client', () => {
    const { service, token } = fixture();
    expect(service.verify(`Bearer ${token()}`)).toEqual({
      clientId: 'notification-service',
    });
  });

  it.each([
    [{ aud: 'notification-api' }, 'unauthorized'],
    [{ scope: 'notifications:read' }, 'scope'],
    [{ client_id: 'other-service' }, 'client'],
  ])('rejects an invalid token boundary %#', (claims, reason) => {
    const { service, token } = fixture();
    try {
      service.verify(`Bearer ${token(claims)}`);
      throw new Error('expected verification to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(ContactTokenError);
      expect((error as ContactTokenError).reason).toBe(reason);
    }
  });

  it('accepts the previous public key during rotation', () => {
    const current = fixture();
    const previous = fixture();
    const previousJwk = previous.publicKey.export({ format: 'jwk' });
    const config = (current.service as any).config;
    const originalGet = config.get;
    config.get = (key: string) =>
      key === 'OIDC_PREVIOUS_PUBLIC_JWK'
        ? JSON.stringify(previousJwk)
        : originalGet(key);
    expect(current.service.verify(`Bearer ${previous.token()}`)).toEqual({
      clientId: 'notification-service',
    });
  });
});
