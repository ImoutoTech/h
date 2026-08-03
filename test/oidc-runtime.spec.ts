import { generateKeyPairSync } from 'crypto';
import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';

describe('OIDC runtime compatibility', () => {
  it('loads ESM from CommonJS output and serves Discovery through Fastify', async () => {
    const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const key: any = privateKey.export({ format: 'jwk' });
    key.kid = 'current';
    key.alg = 'RS256';
    key.use = 'sig';
    const { Provider } = await import('oidc-provider');
    const provider = new Provider('http://127.0.0.1:3000/oidc', {
      clients: [
        {
          client_id: 'proof',
          redirect_uris: ['http://127.0.0.1/callback'],
          response_types: ['code'],
          token_endpoint_auth_method: 'none',
        },
      ],
      jwks: { keys: [key] },
      routes: { jwks: '/jwks' },
      grantTypes: ['authorization_code'],
      responseTypes: ['code'],
      pkce: { required: () => true, methods: ['S256'] },
      features: { devInteractions: { enabled: false } },
    });
    const fastify = Fastify();
    fastify.get(
      '/oidc/.well-known/openid-configuration',
      async (_request, reply) =>
        reply.send({
          issuer: 'http://127.0.0.1:3000/oidc',
          jwks_uri: provider.urlFor('jwks'),
          code_challenge_methods_supported: ['S256'],
        }),
    );
    fastify.all('/oidc/*', async (request, reply) => {
      reply.hijack();
      const originalUrl = request.raw.url;
      request.raw.url = originalUrl.replace(/^\/oidc(?=\/|$)/, '') || '/';
      try {
        await provider.callback()(request.raw, reply.raw);
      } finally {
        request.raw.url = originalUrl;
      }
    });
    const response = await fastify.inject({
      method: 'GET',
      url: '/oidc/.well-known/openid-configuration',
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      issuer: 'http://127.0.0.1:3000/oidc',
      code_challenge_methods_supported: ['S256'],
      jwks_uri: 'http://127.0.0.1:3000/oidc/jwks',
    });
    const invalidRedirect = await fastify.inject({
      method: 'GET',
      url: '/oidc/auth?client_id=proof&response_type=code&scope=openid&redirect_uri=http%3A%2F%2Fevil.invalid%2Fcallback&code_challenge=x&code_challenge_method=S256',
    });
    expect(invalidRedirect.statusCode).toBe(400);
    await fastify.close();
  });
});
