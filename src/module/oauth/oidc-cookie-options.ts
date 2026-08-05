export function oidcCookieOptions(issuer: string) {
  const secure = new URL(issuer).protocol === 'https:';
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
