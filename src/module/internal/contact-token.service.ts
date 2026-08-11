import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createPublicKey, type KeyObject } from 'crypto';
import * as jwt from 'jsonwebtoken';

export type ContactTokenFailure =
  | 'unauthorized'
  | 'audience'
  | 'scope'
  | 'client';

export class ContactTokenError extends Error {
  constructor(readonly reason: ContactTokenFailure) {
    super(reason);
  }
}

@Injectable()
export class ContactTokenService {
  @Inject(ConfigService) private config: ConfigService;

  verify(authorization: string | undefined) {
    const match = authorization?.match(/^Bearer ([^\s]+)$/);
    if (!match) throw new ContactTokenError('unauthorized');
    const keys = this.verificationKeys();
    let payload: jwt.JwtPayload | undefined;
    for (const key of keys) {
      try {
        payload = jwt.verify(match[1], key, {
          algorithms: ['RS256'],
          issuer: this.config.getOrThrow<string>('OIDC_ISSUER'),
          audience: 'h-internal',
        }) as jwt.JwtPayload;
        break;
      } catch {
        // Try the previous rotation key before failing closed.
      }
    }
    if (!payload) throw new ContactTokenError('unauthorized');
    if (payload.aud !== 'h-internal' && !payload.aud?.includes('h-internal'))
      throw new ContactTokenError('audience');
    const scopes = new Set(String(payload.scope || '').split(' '));
    if (!scopes.has('users:contact:read')) throw new ContactTokenError('scope');
    const clientId = String(payload.client_id || '');
    const configured =
      this.config.get<string>('NOTIFICATION_CONTACT_CLIENT_IDS') ||
      this.config.get<string>('NOTIFICATION_CLIENT_ID') ||
      '';
    const allowed = new Set(
      configured
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean),
    );
    if (!clientId || !allowed.has(clientId))
      throw new ContactTokenError('client');
    return { clientId };
  }

  private verificationKeys(): KeyObject[] {
    const current = JSON.parse(
      this.config.getOrThrow<string>('OIDC_SIGNING_JWK'),
    );
    delete current.d;
    delete current.p;
    delete current.q;
    delete current.dp;
    delete current.dq;
    delete current.qi;
    const keys = [createPublicKey({ key: current, format: 'jwk' })];
    const previous = this.config.get<string>('OIDC_PREVIOUS_PUBLIC_JWK');
    if (previous) {
      keys.push(createPublicKey({ key: JSON.parse(previous), format: 'jwk' }));
    }
    return keys;
  }
}
