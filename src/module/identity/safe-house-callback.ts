export function safeHouseCallbackUrl(base: string, resultId: string) {
  const url = new URL(base);
  const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  if (
    (!local && url.protocol !== 'https:') ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      'SAFE_HOUSE_PUBLIC_URL must be a clean HTTPS origin/base URL',
    );
  }
  const callback = new URL('/external/callback', url);
  callback.searchParams.set('result', resultId);
  return callback.toString();
}
