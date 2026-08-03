export async function consumeJson<T>(
  client: { getDel(key: string): Promise<string | null> },
  key: string,
): Promise<T | undefined> {
  const value = await client.getDel(key);
  return value ? (JSON.parse(value) as T) : undefined;
}
