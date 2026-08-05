import { User, SubApp } from '@/entity';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { BusinessException, RedisService } from '@reus-able/nestjs';
import type { Repository } from 'typeorm';
import { nativeImport } from './native-import';
import { createRedisAdapter } from './redis-adapter';
import { ClientSecretService } from './client-secret.service';
import { AtomicReloader } from './atomic-reloader';
import { publicJwks, toPublicJwk } from './public-jwks';
import { Duplex } from 'stream';
import { ServerResponse } from 'http';
import { isProviderResumeContinuation } from './continuation-url';

@Injectable()
export class OAuthService {
  @InjectRepository(SubApp)
  private appRepo: Repository<SubApp>;

  @InjectRepository(User)
  private userRepo: Repository<User>;

  @Inject(RedisService)
  private cache: RedisService;

  private providers = new AtomicReloader<any>();
  private currentPublicJwk: Record<string, any>;
  private previousPublicJwk?: Record<string, any>;

  constructor(
    private readonly config: ConfigService,
    private readonly clientSecrets: ClientSecretService,
  ) {}

  async initialize() {
    const apps = await this.appRepo.find({
      relations: { secrets: true },
      order: { id: 'ASC' },
    });
    const fingerprint = JSON.stringify(
      apps.map((app) => ({
        id: app.id,
        redirectUris: app.redirectUris,
        clientType: app.clientType,
        secrets: app.secrets
          ?.map((secret) => [
            secret.id,
            secret.status,
            secret.secretCiphertext,
            secret.secretIv,
            secret.secretTag,
            secret.keyVersion,
          ])
          .sort(([left], [right]) => Number(left) - Number(right)),
      })),
    );
    return this.providers.get(fingerprint, () => this.build(apps));
  }

  private async build(apps: SubApp[]) {
    const issuer = this.config.get<string>('OIDC_ISSUER');
    const jwkText = this.config.get<string>('OIDC_SIGNING_JWK');
    const kid = this.config.get<string>('OIDC_SIGNING_KID');
    if (!issuer || !jwkText || !kid) {
      throw new Error(
        'OIDC_ISSUER, OIDC_SIGNING_JWK and OIDC_SIGNING_KID are required',
      );
    }
    const jwk = JSON.parse(jwkText);
    jwk.kid = kid;
    this.currentPublicJwk = toPublicJwk(jwk);
    const previousJwkText = this.config.get<string>('OIDC_PREVIOUS_PUBLIC_JWK');
    const previousKid = this.config.get<string>('OIDC_PREVIOUS_KID');
    if (previousJwkText) {
      const previous = JSON.parse(previousJwkText);
      previous.kid = previousKid || previous.kid;
      if (!previous.kid || previous.d) {
        throw new Error(
          'OIDC_PREVIOUS_PUBLIC_JWK must be public and have a kid',
        );
      }
      this.previousPublicJwk = previous;
    } else {
      this.previousPublicJwk = undefined;
    }
    const clients = apps.map((app) => ({
      client_id: app.id,
      redirect_uris: app.redirectUris || [app.callback],
      response_types: ['code'],
      grant_types: ['authorization_code'],
      token_endpoint_auth_method:
        app.clientType === 'confidential' ? 'client_secret_post' : 'none',
      client_secret:
        app.clientType === 'confidential'
          ? this.clientSecrets.decrypt(
              app.secrets?.find(
                (secret) => secret.status && secret.secretCiphertext,
              ),
              app.id,
            )
          : undefined,
    }));
    const { Provider, interactionPolicy } = await nativeImport('oidc-provider');
    const interactionPolicyConfig = interactionPolicy.base();
    interactionPolicyConfig
      .get('consent')
      .checks.add(
        new interactionPolicy.Check(
          'consent_required_each_time',
          'every authorization request requires explicit consent',
          (ctx: any) =>
            ctx.oidc.result?.consent
              ? interactionPolicy.Check.NO_NEED_TO_PROMPT
              : interactionPolicy.Check.REQUEST_PROMPT,
        ),
        0,
      );
    const provider = new Provider(issuer, {
      adapter: createRedisAdapter(this.cache),
      clients,
      jwks: { keys: [jwk] },
      // The interaction page is hosted by the frontend origin.  Allow the
      // browser to send the provider's short-lived session cookie when the
      // frontend calls the backend API cross-site.
      cookies: {
        short: { sameSite: 'none', path: '/' },
        long: { sameSite: 'none', path: '/' },
      },
      // oidc-provider resolves custom routes relative to the issuer pathname.
      routes: { jwks: '/jwks' },
      claims: {
        openid: ['sub'],
        profile: ['nickname', 'picture'],
        email: ['email', 'email_verified'],
      },
      conformIdTokenClaims: false,
      grantTypes: ['authorization_code'],
      responseTypes: ['code'],
      features: {
        devInteractions: { enabled: false },
        deviceFlow: { enabled: false },
        revocation: { enabled: false },
        introspection: { enabled: false },
        userinfo: { enabled: true },
      },
      pkce: { required: () => true, methods: ['S256'] },
      scopes: ['openid', 'profile', 'email'],
      ttl: {
        AuthorizationCode: 120,
        AccessToken: 600,
        IdToken: 600,
        Interaction: 600,
      },
      interactions: {
        policy: interactionPolicyConfig,
        url: (_ctx: any, interaction: any) => {
          const safeHouseBase = this.config.getOrThrow<string>(
            'SAFE_HOUSE_PUBLIC_URL',
          );
          return new URL(
            `/oauth/interaction/${encodeURIComponent(interaction.uid)}`,
            safeHouseBase,
          ).toString();
        },
      },
      findAccount: async (_ctx: any, id: string) => {
        const user = await this.userRepo.findOneBy({ id: Number(id) });
        if (!user) return undefined;
        return {
          accountId: String(user.id),
          claims: async (_use: string, scope: string) => ({
            sub: String(user.id),
            ...(scope.includes('profile')
              ? { nickname: user.nickname, picture: user.avatar }
              : {}),
            ...(scope.includes('email')
              ? { email: user.email, email_verified: true }
              : {}),
          }),
        };
      },
    });
    return provider;
  }

  jwks() {
    if (!this.currentPublicJwk)
      throw new Error('OIDC provider is not initialized');
    return publicJwks(this.currentPublicJwk, this.previousPublicJwk);
  }

  async discovery() {
    const provider = await this.initialize();
    return {
      issuer: this.config.get<string>('OIDC_ISSUER'),
      authorization_endpoint: provider.urlFor('authorization'),
      token_endpoint: provider.urlFor('token'),
      userinfo_endpoint: provider.urlFor('userinfo'),
      jwks_uri: provider.urlFor('jwks'),
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code'],
      subject_types_supported: ['public'],
      id_token_signing_alg_values_supported: ['RS256'],
      scopes_supported: ['openid', 'profile', 'email'],
      claims_supported: [
        'sub',
        'nickname',
        'picture',
        'email',
        'email_verified',
      ],
      code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: ['none', 'client_secret_post'],
    };
  }

  async interaction(uid: string, request: any, response: any) {
    const provider = await this.initialize();
    const details = await provider.interactionDetails(request, response);
    if (details.uid !== uid)
      throw new BusinessException('授权交互无效或已过期');
    const app = await this.appRepo.findOneBy({ id: details.params.client_id });
    return {
      uid,
      client: app
        ? { id: app.id, name: app.name, description: app.description }
        : undefined,
      prompt: details.prompt.name,
      scope: details.params.scope,
    };
  }

  async finish(
    uid: string,
    approved: boolean,
    userId: number,
    request: any,
    response: any,
  ) {
    const provider = await this.initialize();
    const details = await provider.interactionDetails(request, response);
    if (details.uid !== uid)
      throw new BusinessException('授权交互无效或已过期');
    let grantId = details.grantId;
    if (approved && !grantId) {
      const grant = new provider.Grant({
        accountId: String(userId),
        clientId: details.params.client_id,
      });
      grant.addOIDCScope(details.params.scope);
      grantId = await grant.save();
    }
    const result = approved
      ? {
          login: { accountId: String(userId) },
          consent: { grantId },
        }
      : {
          error: 'access_denied',
          error_description: 'End-User denied the authorization request',
        };
    const capture = new ServerResponse(request);
    const socket = new Duplex({
      read() {},
      write(_chunk, _encoding, callback) {
        callback();
      },
    });
    capture.assignSocket(socket as any);
    await provider.interactionFinished(request, capture, result, {
      mergeWithLastSubmission: false,
    });
    const continuationUrl = String(capture.getHeader('location') || '');
    const setCookie = capture.getHeader('set-cookie');
    capture.detachSocket(socket as any);
    const issuer = this.config.get<string>('OIDC_ISSUER', '');
    if (!isProviderResumeContinuation(continuationUrl, issuer)) {
      throw new BusinessException('授权继续地址无效');
    }
    return {
      continuationUrl,
      cookies: Array.isArray(setCookie)
        ? setCookie
        : setCookie
          ? [String(setCookie)]
          : [],
    };
  }
}
