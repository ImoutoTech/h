import { describe, expect, it } from 'vitest';
import {
  isSecureOidcIssuer,
  oidcCookieOptions,
} from '../src/module/oauth/oidc-cookie-options';

describe('OIDC cookie options', () => {
  it('forces Secure cookies for an HTTPS issuer behind a reverse proxy', () => {
    expect(isSecureOidcIssuer('https://login.example/oidc')).toBe(true);
    expect(oidcCookieOptions('https://login.example/oidc')).toEqual({
      short: { path: '/', secure: true, sameSite: 'none' },
      long: { path: '/', secure: true, sameSite: 'none' },
    });
  });

  it('keeps localhost HTTP cookies usable during local development', () => {
    expect(isSecureOidcIssuer('http://localhost:3000/oidc')).toBe(false);
    expect(oidcCookieOptions('http://localhost:3000/oidc')).toEqual({
      short: { path: '/', secure: false, sameSite: 'lax' },
      long: { path: '/', secure: false, sameSite: 'lax' },
    });
  });
});
