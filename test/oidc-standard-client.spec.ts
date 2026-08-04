import { generateKeyPairSync } from 'crypto';
import { createServer } from 'net';
import Fastify from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';

type OpenIdClient = typeof import('openid-client');

const servers: Array<ReturnType<typeof Fastify>> = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

async function followAuthorization(
  authorizationUrl: URL,
  redirectUri: string,
): Promise<URL> {
  let current = authorizationUrl;
  const cookies = new Map<string, string>();

  for (let redirects = 0; redirects < 10; redirects += 1) {
    const response = await fetch(current, {
      headers: cookies.size
        ? {
            cookie: [...cookies]
              .map(([name, value]) => `${name}=${value}`)
              .join('; '),
          }
        : undefined,
      redirect: 'manual',
    });
    const setCookies =
      (response.headers as any).getSetCookie?.() ||
      response.headers.get('set-cookie')?.split(/,(?=\s*[^;,=]+=[^;,]+)/) ||
      [];
    for (const setCookie of setCookies) {
      const [pair] = setCookie.split(';', 1);
      const separator = pair.indexOf('=');
      cookies.set(pair.slice(0, separator), pair.slice(separator + 1));
    }
    const location = response.headers.get('location');
    if (!location) throw new Error(`Missing redirect from ${current}`);
    current = new URL(location, current);
    if (current.href.startsWith(redirectUri)) return current;
  }

  throw new Error('Authorization redirect limit exceeded');
}

describe('standard relying-party OIDC flow', () => {
  it('exchanges an S256-bound code once and rejects a wrong verifier and replay', async () => {
    const port = await new Promise<number>((resolve, reject) => {
      const reservation = createServer();
      reservation.once('error', reject);
      reservation.listen(0, '127.0.0.1', () => {
        const address = reservation.address();
        if (!address || typeof address === 'string') {
          reservation.close();
          reject(new Error('No TCP port'));
          return;
        }
        reservation.close((error) =>
          error ? reject(error) : resolve(address.port),
        );
      });
    });
    const server = Fastify();
    servers.push(server);
    server.addContentTypeParser(
      'application/x-www-form-urlencoded',
      { parseAs: 'string' },
      (_request, body, done) => done(null, body),
    );
    const issuer = `http://127.0.0.1:${port}/oidc`;
    const redirectUri = 'http://127.0.0.1/relying-party/callback';
    const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const signingKey: any = privateKey.export({ format: 'jwk' });
    Object.assign(signingKey, { kid: 'acceptance', alg: 'RS256', use: 'sig' });
    const { Provider } = await import('oidc-provider');
    const provider = new Provider(issuer, {
      clients: [
        {
          client_id: 'acceptance-client',
          redirect_uris: [redirectUri],
          response_types: ['code'],
          grant_types: ['authorization_code'],
          token_endpoint_auth_method: 'none',
        },
      ],
      claims: { openid: ['sub'] },
      findAccount: async (_ctx: unknown, id: string) => ({
        accountId: id,
        claims: async () => ({ sub: id }),
      }),
      features: { devInteractions: { enabled: false } },
      grantTypes: ['authorization_code'],
      interactions: {
        url: (_ctx: unknown, interaction: { uid: string }) =>
          `/interaction/${interaction.uid}`,
      },
      jwks: { keys: [signingKey] },
      pkce: { required: () => true, methods: ['S256'] },
      responseTypes: ['code'],
      scopes: ['openid'],
    });

    server.get('/interaction/:uid', async (request, reply) => {
      reply.hijack();
      const details = await provider.interactionDetails(request.raw, reply.raw);
      const grant = new provider.Grant({
        accountId: '42',
        clientId: String(details.params.client_id),
      });
      grant.addOIDCScope(String(details.params.scope));
      const grantId = await grant.save();
      await provider.interactionFinished(
        request.raw,
        reply.raw,
        {
          login: { accountId: '42' },
          consent: { grantId },
        },
        { mergeWithLastSubmission: false },
      );
    });
    server.get('/oidc/.well-known/openid-configuration', async () => ({
      issuer,
      authorization_endpoint: `${issuer}/auth`,
      token_endpoint: `${issuer}/token`,
      jwks_uri: `${issuer}/jwks`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code'],
      subject_types_supported: ['public'],
      id_token_signing_alg_values_supported: ['RS256'],
      scopes_supported: ['openid'],
      code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: ['none'],
    }));
    server.all('/oidc/*', async (request, reply) => {
      reply.hijack();
      const originalUrl = request.raw.url;
      (request.raw as any).originalUrl = originalUrl;
      (request.raw as any).body = request.body;
      request.raw.url = originalUrl.replace(/^\/oidc(?=\/|$)/, '') || '/';
      try {
        await provider.callback()(request.raw, reply.raw);
      } finally {
        request.raw.url = originalUrl;
      }
    });
    await server.listen({ host: '127.0.0.1', port });

    const client: OpenIdClient = await import('openid-client');
    const configuration = await client.discovery(
      new URL(issuer),
      'acceptance-client',
      undefined,
      undefined,
      { execute: [client.allowInsecureRequests] },
    );
    const authorize = async () => {
      const verifier = client.randomPKCECodeVerifier();
      const state = client.randomState();
      const authorizationUrl = client.buildAuthorizationUrl(configuration, {
        redirect_uri: redirectUri,
        scope: 'openid',
        state,
        code_challenge: await client.calculatePKCECodeChallenge(verifier),
        code_challenge_method: 'S256',
      });
      return {
        callbackUrl: await followAuthorization(authorizationUrl, redirectUri),
        state,
        verifier,
      };
    };
    const wrongVerifierFlow = await authorize();

    await expect(
      client.authorizationCodeGrant(
        configuration,
        wrongVerifierFlow.callbackUrl,
        {
          pkceCodeVerifier: client.randomPKCECodeVerifier(),
          expectedState: wrongVerifierFlow.state,
        },
      ),
    ).rejects.toThrow();

    const validFlow = await authorize();
    const tokens = await client.authorizationCodeGrant(
      configuration,
      validFlow.callbackUrl,
      {
        pkceCodeVerifier: validFlow.verifier,
        expectedState: validFlow.state,
      },
    );
    expect(tokens).toMatchObject({ token_type: 'bearer' });
    expect(tokens.access_token).toBeTypeOf('string');
    expect(tokens.id_token).toBeTypeOf('string');
    expect(tokens.refresh_token).toBeUndefined();

    await expect(
      client.authorizationCodeGrant(configuration, validFlow.callbackUrl, {
        pkceCodeVerifier: validFlow.verifier,
        expectedState: validFlow.state,
      }),
    ).rejects.toThrow();
  });
});
