import type { RedisService } from '@reus-able/nestjs';

interface AdapterPayload {
  payload: Record<string, any>;
  expiresAt?: number;
}

export function createRedisAdapter(cache: RedisService) {
  return class RedisOidcAdapter {
    readonly prefix: string;

    constructor(name: string) {
      this.prefix = `oidc:${name}:`;
    }

    key(id: string) {
      return `${this.prefix}${id}`;
    }

    grantKey(grantId: string) {
      return `oidc:grant:${grantId}`;
    }

    async upsert(id: string, payload: Record<string, any>, expiresIn: number) {
      const data: AdapterPayload = {
        payload,
        expiresAt: expiresIn ? Date.now() + expiresIn * 1000 : undefined,
      };
      await cache.jsonSet(this.key(id), data, expiresIn || undefined);
      if (payload.uid)
        await cache.jsonSet(
          `${this.prefix}uid:${payload.uid}`,
          { id },
          expiresIn,
        );
      if (payload.userCode)
        await cache.jsonSet(
          `${this.prefix}code:${payload.userCode}`,
          { id },
          expiresIn,
        );
      if (payload.grantId) {
        const grantKey = this.grantKey(payload.grantId);
        const grant = (await cache.jsonGet<{ keys: string[] }>(grantKey)) || {
          keys: [],
        };
        const key = this.key(id);
        if (!grant.keys.includes(key)) grant.keys.push(key);
        await cache.jsonSet(grantKey, grant, expiresIn || undefined);
      }
    }

    async find(id: string) {
      const data = await cache.jsonGet<AdapterPayload>(this.key(id));
      if (!data || (data.expiresAt && data.expiresAt <= Date.now()))
        return undefined;
      return data.payload;
    }

    async findByUid(uid: string) {
      const index = await cache.jsonGet<{ id: string }>(
        `${this.prefix}uid:${uid}`,
      );
      return index ? this.find(index.id) : undefined;
    }

    async findByUserCode(userCode: string) {
      const index = await cache.jsonGet<{ id: string }>(
        `${this.prefix}code:${userCode}`,
      );
      return index ? this.find(index.id) : undefined;
    }

    async destroy(id: string) {
      const payload = await this.find(id);
      await cache.del(this.key(id));
      if (payload?.uid) await cache.del(`${this.prefix}uid:${payload.uid}`);
      if (payload?.userCode)
        await cache.del(`${this.prefix}code:${payload.userCode}`);
    }

    async consume(id: string) {
      const data = await this.find(id);
      if (!data) return;
      data.consumed = Math.floor(Date.now() / 1000);
      const ttl = data.exp
        ? Math.max(1, data.exp - Math.floor(Date.now() / 1000))
        : 600;
      await this.upsert(id, data, ttl);
    }

    async revokeByGrantId(grantId: string) {
      const grantKey = this.grantKey(grantId);
      const grant = await cache.jsonGet<{ keys: string[] }>(grantKey);
      if (grant) {
        await Promise.all(grant.keys.map((key) => cache.del(key)));
        await cache.del(grantKey);
      }
    }
  };
}
