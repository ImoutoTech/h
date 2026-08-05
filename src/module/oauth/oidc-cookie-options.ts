export function oidcCookieOptions(issuer: string) {
  const secure = isSecureOidcIssuer(issuer);
  const options = {
    path: '/',
    secure,
    sameSite: secure ? ('none' as const) : ('lax' as const),
  };

  return {
    short: options,
    long: options,
  };
}

export function isSecureOidcIssuer(issuer: string) {
  return new URL(issuer).protocol === 'https:';
}
