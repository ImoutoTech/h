import { describe, expect, it } from 'vitest';
import { createRedisAdapter } from '../src/module/oauth/redis-adapter';

class MemoryRedis {
  values = new Map<string, any>();
  async jsonSet(key: string, value: any) {
    this.values.set(key, structuredClone(value));
  }
  async jsonGet<T>(key: string): Promise<T> {
    return structuredClone(this.values.get(key));
  }
  async del(key: string) {
    this.values.delete(key);
  }
}

describe('OIDC Redis adapter', () => {
  it('isolates model namespaces and resolves uid indexes', async () => {
    const redis = new MemoryRedis();
    const Adapter = createRedisAdapter(redis as any);
    const sessions = new Adapter('Session');
    const codes = new Adapter('AuthorizationCode');
    await sessions.upsert('same', { uid: 'u1', accountId: '1' }, 60);
    await codes.upsert('same', { accountId: '2' }, 60);
    expect((await sessions.find('same')).accountId).toBe('1');
    expect((await codes.find('same')).accountId).toBe('2');
    expect((await sessions.findByUid('u1')).accountId).toBe('1');
  });

  it('marks authorization material consumed and destroys indexes', async () => {
    const redis = new MemoryRedis();
    const Adapter = createRedisAdapter(redis as any);
    const adapter = new Adapter('AuthorizationCode');
    await adapter.upsert('code', { uid: 'u1' }, 60);
    await adapter.consume('code');
    expect((await adapter.find('code')).consumed).toBeTypeOf('number');
    await adapter.destroy('code');
    expect(await adapter.find('code')).toBeUndefined();
    expect(await adapter.findByUid('u1')).toBeUndefined();
  });

  it('revokes every token associated with a grant', async () => {
    const redis = new MemoryRedis();
    const Adapter = createRedisAdapter(redis as any);
    const accessTokens = new Adapter('AccessToken');
    const codes = new Adapter('AuthorizationCode');
    await accessTokens.upsert('access', { grantId: 'grant-1' }, 60);
    await codes.upsert('code', { grantId: 'grant-1' }, 60);

    await accessTokens.revokeByGrantId('grant-1');

    expect(await accessTokens.find('access')).toBeUndefined();
    expect(await codes.find('code')).toBeUndefined();
  });
});
