import { describe, expect, it } from 'vitest';
import { oidcAccountClaims } from '../src/module/oauth/oidc-account-claims';

describe('OIDC email ownership claim', () => {
  it('derives email_verified from the persisted verification fact', () => {
    const user = {
      id: 7,
      nickname: 'Owner',
      avatar: null,
      email: 'owner@example.com',
      emailVerifiedAt: null,
    } as never;
    expect(oidcAccountClaims(user, 'openid email')).toMatchObject({
      email: 'owner@example.com',
      email_verified: false,
    });
    user.emailVerifiedAt = new Date('2026-08-10T00:00:00.000Z');
    expect(oidcAccountClaims(user, 'openid email')).toMatchObject({
      email_verified: true,
    });
  });

  it('does not leak email claims when email scope was not granted', () => {
    const user = {
      id: 7,
      nickname: 'Owner',
      avatar: null,
      email: 'owner@example.com',
      emailVerifiedAt: new Date(),
    } as never;
    expect(oidcAccountClaims(user, 'openid profile')).not.toHaveProperty(
      'email',
    );
    expect(oidcAccountClaims(user, 'openid notemail')).not.toHaveProperty(
      'email',
    );
  });
});
