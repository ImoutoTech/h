const DEFAULT_LISTEN_PORT = 4000;

export function resolveListenPort(
  value: string | number | undefined,
  fallback = DEFAULT_LISTEN_PORT,
) {
  if (value === undefined || value === null || value === '') return fallback;
  const text = String(value);
  if (!/^\d+$/.test(text)) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }
  const port = Number(text);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }
  return port;
}
