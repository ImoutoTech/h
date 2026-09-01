import { describe, expect, it, vi } from 'vitest';
import { OAuthService } from '../src/module/oauth/oauth.service';

function fixture() {
  const activity = { record: vi.fn(async () => undefined) };
  const config = {
    get: vi.fn((key: string, fallback?: string) =>
      key === 'OIDC_ISSUER' ? 'https://identity.example/oidc' : fallback,
    ),
  };
  const service = new OAuthService(config as any, {} as any, activity as any);
  return { service, activity };
}

describe('OIDC activity semantics', () => {
  it('records login only after a successful authorization_code grant', async () => {
    const { service, activity } = fixture();
    await (service as any).recordSuccessfulCodeExchange({
      oidc: {
        params: { grant_type: 'authorization_code' },
        entities: {
          AuthorizationCode: {
            jti: 'internal-jti',
            accountId: '17',
            clientId: 'client-1',
            scope: 'openid profile',
          },
        },
      },
    });
    expect(activity.record).toHaveBeenCalledWith({
      kind: 'oidc.login',
      actorUserId: 17,
      appId: 'client-1',
      scopes: ['openid', 'profile'],
      authorizationCodeJti: 'internal-jti',
    });
  });

  it('does not count consent, another grant type, or a missing code entity as login', async () => {
    const { service, activity } = fixture();
    await (service as any).recordSuccessfulCodeExchange({
      oidc: { params: { grant_type: 'refresh_token' }, entities: {} },
    });
    await (service as any).recordSuccessfulCodeExchange({
      oidc: {
        params: { grant_type: 'authorization_code' },
        entities: {},
      },
    });
    expect(activity.record).not.toHaveBeenCalled();
  });

  it.each([
    [true, 'approved'],
    [false, 'denied'],
  ] as const)(
    'records a %s consent decision after safe continuation validation',
    async (approved, outcome) => {
      const { service, activity } = fixture();
      const provider = {
        interactionDetails: vi.fn(async () => ({
          uid: 'interaction-1',
          grantId: 'grant-1',
          params: { client_id: 'client-1', scope: 'openid email' },
        })),
        interactionFinished: vi.fn(async (_req, response) => {
          response.setHeader(
            'location',
            'https://identity.example/oidc/auth/resume-1',
          );
        }),
      };
      vi.spyOn(service, 'initialize').mockResolvedValue(provider as any);
      await service.finish('interaction-1', approved, 17, {} as any, {} as any);
      expect(activity.record).toHaveBeenCalledWith({
        kind: 'oidc.consent',
        actorUserId: 17,
        appId: 'client-1',
        scopes: ['openid', 'email'],
        outcome,
        dedupeSource: 'interaction-1',
      });
    },
  );
});
