import { ExternalIdentity, User, type ExternalProvider } from '@/entity';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import {
  BusinessException,
  HLOGGER_TOKEN,
  HLogger,
  RedisService,
} from '@reus-able/nestjs';
import { randomBytes, createHash } from 'crypto';
import { DataSource, type Repository } from 'typeorm';
import { ProviderConfigService } from './provider-config.service';
import { nativeImport } from '../oauth/native-import';
import { UserService } from '../user/user.service';
import { OneTimeStateService } from './one-time-state.service';

interface ExternalProfile {
  providerUserId: string;
  email?: string;
  emailVerified: boolean;
  displayName?: string;
  avatarUrl?: string;
}

type GoogleOAuthStage = 'discovery' | 'token_exchange' | 'claims_projection';
type GoogleOAuthSubstage =
  | 'authorization_response'
  | 'token_response_shape'
  | 'id_token_signature'
  | 'id_token_claim'
  | 'jwks'
  | 'unknown';
type GoogleOAuthReason =
  | 'validation_failed'
  | 'invalid_shape'
  | 'verification_failed'
  | 'key_resolution_failed'
  | 'unclassified';

@Injectable()
export class ExternalIdentityService {
  @InjectRepository(ExternalIdentity)
  private identityRepo: Repository<ExternalIdentity>;
  @InjectRepository(User) private userRepo: Repository<User>;
  @Inject(RedisService) private cache: RedisService;
  @Inject(HLOGGER_TOKEN) private logger: HLogger;

  constructor(
    private readonly providers: ProviderConfigService,
    private readonly config: ConfigService,
    private readonly dataSource: DataSource,
    private readonly userService: UserService,
    private readonly oneTimeState: OneTimeStateService,
  ) {}

  async list(userId: number) {
    const items = await this.identityRepo.find({
      where: { user: { id: userId } },
      relations: { user: true },
    });
    return items.map((item) => ({
      id: item.id,
      provider: item.provider,
      email: item.email,
      displayName: item.displayName,
      avatarUrl: item.avatarUrl,
      createdAt: item.createdAt,
    }));
  }

  async storeResult(result: Record<string, any>) {
    const id = randomBytes(32).toString('base64url');
    await this.cache.jsonSet(`external-result:${id}`, result, 120);
    return id;
  }

  async exchangeResult(id: string) {
    const result = await this.oneTimeState.consume<Record<string, any>>(
      `external-result:${id}`,
    );
    if (!result) return { outcome: 'state_invalid_or_expired' };
    return result;
  }

  async start(
    provider: ExternalProvider,
    returnTo?: string,
    bindUserId?: number,
  ) {
    const credentials = await this.providers.credentials(provider);
    const state = randomBytes(32).toString('base64url');
    const verifier = randomBytes(32).toString('base64url');
    const challenge = createHash('sha256').update(verifier).digest('base64url');
    const nonce = randomBytes(24).toString('base64url');
    await this.cache.jsonSet(
      `external-state:${state}`,
      { provider, verifier, nonce, returnTo, bindUserId },
      600,
    );
    const callback = `${this.config.get<string>('PUBLIC_URL')}/external/${provider}/callback`;
    const url =
      provider === 'github'
        ? `https://github.com/login/oauth/authorize?${new URLSearchParams({ client_id: credentials.clientId, redirect_uri: callback, scope: 'read:user user:email', state }).toString()}`
        : `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({ client_id: credentials.clientId, redirect_uri: callback, response_type: 'code', scope: 'openid profile email', state, nonce, code_challenge: challenge, code_challenge_method: 'S256' }).toString()}`;
    return { authorizationUrl: url };
  }

  async callback(
    provider: ExternalProvider,
    code: string | undefined,
    state: string,
    error?: string,
  ) {
    const transaction = await this.oneTimeState.consume<any>(
      `external-state:${state}`,
    );
    if (!transaction || transaction.provider !== provider)
      throw new BusinessException('外部登录状态无效或已过期');
    if (error)
      return {
        outcome: error === 'access_denied' ? 'cancelled' : 'provider_error',
      };
    if (!code) throw new BusinessException('外部登录回调缺少授权码');
    let result: any;
    try {
      const profile =
        provider === 'github'
          ? await this.githubProfile(code)
          : await this.googleProfile(code, state, transaction);
      if (!profile.emailVerified || !profile.email) {
        this.logger.warn(
          `外部登录失败 provider=${provider} outcome=verified_email_required`,
          ExternalIdentityService.name,
        );
        return { outcome: 'verified_email_required' };
      }
      try {
        result = await this.resolve(provider, profile, transaction.bindUserId);
      } catch (reason) {
        if (!this.isDuplicate(reason)) throw reason;
        const winner = await this.identityRepo.findOne({
          where: { provider, providerUserId: profile.providerUserId },
          relations: { user: true },
        });
        if (
          winner &&
          transaction.bindUserId &&
          winner.user.id !== transaction.bindUserId
        ) {
          throw new BusinessException('外部身份已被其他账号绑定');
        }
        if (winner) {
          result = {
            outcome: transaction.bindUserId ? 'bound' : 'authenticated',
            user: winner.user.getData(),
          };
        } else {
          const emailOwner = await this.userRepo.findOneBy({
            email: profile.email,
          });
          if (!emailOwner || transaction.bindUserId) throw reason;
          result = {
            outcome: 'binding_required',
            bindingToken: await this.createBinding(provider, profile),
          };
        }
      }
    } catch (reason) {
      this.logger.warn(
        `外部登录失败 provider=${provider} outcome=rejected`,
        ExternalIdentityService.name,
      );
      throw reason;
    }
    if (result.outcome === 'authenticated') {
      const user = await this.userRepo.findOne({
        where: { id: result.user.id },
        relations: ['roles'],
      });
      return {
        outcome: result.outcome,
        ...this.userService.issueSession(user),
      };
    }
    return result;
  }

  private isDuplicate(reason: any) {
    return (
      reason?.code === 'ER_DUP_ENTRY' ||
      reason?.driverError?.code === 'ER_DUP_ENTRY'
    );
  }

  private async githubProfile(code: string): Promise<ExternalProfile> {
    const credentials = await this.providers.credentials('github');
    const callback = `${this.config.get<string>('PUBLIC_URL')}/external/github/callback`;
    const tokenResponse = await fetch(
      'https://github.com/login/oauth/access_token',
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: credentials.clientId,
          client_secret: credentials.clientSecret,
          code,
          redirect_uri: callback,
        }),
      },
    );
    const token: any = await tokenResponse.json();
    if (!tokenResponse.ok || !token.access_token)
      throw new BusinessException('GitHub 登录失败');
    const headers = {
      Authorization: `Bearer ${token.access_token}`,
      Accept: 'application/vnd.github+json',
    };
    const [userResponse, emailsResponse] = await Promise.all([
      fetch('https://api.github.com/user', { headers }),
      fetch('https://api.github.com/user/emails', { headers }),
    ]);
    if (!userResponse.ok || !emailsResponse.ok)
      throw new BusinessException('GitHub 用户信息读取失败');
    const user: any = await userResponse.json();
    const emails: any[] = await emailsResponse.json();
    const email = emails.find((item) => item.primary && item.verified);
    return {
      providerUserId: String(user.id),
      email: email?.email,
      emailVerified: Boolean(email),
      displayName: user.name || user.login,
      avatarUrl: user.avatar_url,
    };
  }

  private async googleProfile(
    code: string,
    state: string,
    transaction: any,
  ): Promise<ExternalProfile> {
    const credentials = await this.providers.credentials('google');
    const callback = `${this.config.get<string>('PUBLIC_URL')}/external/google/callback`;
    const client = await nativeImport('openid-client');
    let configuration: Awaited<ReturnType<typeof client.discovery>>;
    try {
      configuration = await client.discovery(
        new URL('https://accounts.google.com'),
        credentials.clientId,
        credentials.clientSecret,
      );
    } catch (reason) {
      this.logGoogleOAuthDiagnostic('discovery', reason);
      throw reason;
    }
    const currentUrl = new URL(callback);
    currentUrl.searchParams.set('code', code);
    currentUrl.searchParams.set('state', state);
    let tokens: Awaited<ReturnType<typeof client.authorizationCodeGrant>>;
    try {
      tokens = await client.authorizationCodeGrant(configuration, currentUrl, {
        pkceCodeVerifier: transaction.verifier,
        expectedNonce: transaction.nonce,
        expectedState: state,
      });
    } catch (reason) {
      this.logGoogleOAuthDiagnostic('token_exchange', reason);
      throw reason;
    }
    try {
      const claims = tokens.claims();
      if (!claims?.sub) throw new BusinessException('Google 身份令牌无效');
      return {
        providerUserId: claims.sub,
        email: claims.email as string,
        emailVerified: claims.email_verified === true,
        displayName: claims.name as string,
        avatarUrl: claims.picture as string,
      };
    } catch (reason) {
      this.logGoogleOAuthDiagnostic('claims_projection', reason);
      throw reason;
    }
  }

  private logGoogleOAuthDiagnostic(stage: GoogleOAuthStage, reason: unknown) {
    const { substage, reasonTag } = this.classifyGoogleOAuthError(reason);
    this.logger.warn(
      `[DEBUG-google-oauth] stage=${stage} substage=${substage} reason=${reasonTag}`,
      ExternalIdentityService.name,
    );
  }

  private classifyGoogleOAuthError(reason: unknown): {
    substage: GoogleOAuthSubstage;
    reasonTag: GoogleOAuthReason;
  } {
    const details: string[] = [];
    let current = reason;
    for (let depth = 0; depth < 4 && current instanceof Object; depth += 1) {
      for (const key of ['name', 'code', 'message']) {
        const value = this.readDiagnosticProperty(current, key);
        if (typeof value === 'string') details.push(value);
      }
      current = this.readDiagnosticProperty(current, 'cause');
    }
    const text = details.join('\n');

    if (
      /OAUTH_KEY_SELECTION_FAILED|JWK|verification key|key selection/i.test(
        text,
      )
    )
      return { substage: 'jwks', reasonTag: 'key_resolution_failed' };
    if (
      /signature verification failed|signing algorithm|JWS ["']alg/i.test(text)
    )
      return {
        substage: 'id_token_signature',
        reasonTag: 'verification_failed',
      };
    if (
      /OAUTH_JWT_(?:CLAIM_COMPARISON|TIMESTAMP_CHECK)|ID Token|JWT [^\n]*claim|nonce|audience|issuer/i.test(
        text,
      )
    )
      return { substage: 'id_token_claim', reasonTag: 'validation_failed' };
    if (
      /OAUTH_AUTHORIZATION_RESPONSE_ERROR|AuthorizationResponseError|authorization response|authorization code|state[^\n]*(?:parameter|mismatch)/i.test(
        text,
      )
    )
      return {
        substage: 'authorization_response',
        reasonTag: 'validation_failed',
      };
    if (
      /OAUTH_(?:INVALID_RESPONSE|RESPONSE_BODY_ERROR|RESPONSE_IS_NOT_JSON|RESPONSE_IS_NOT_CONFORM|PARSE_ERROR)|token endpoint|access token|["']response["'] body|response content-type|invalid response encountered/i.test(
        text,
      )
    )
      return {
        substage: 'token_response_shape',
        reasonTag: 'invalid_shape',
      };
    return { substage: 'unknown', reasonTag: 'unclassified' };
  }

  private readDiagnosticProperty(reason: object, key: string) {
    try {
      return (reason as Record<string, unknown>)[key];
    } catch {
      return undefined;
    }
  }

  private async resolve(
    provider: ExternalProvider,
    profile: ExternalProfile,
    bindUserId?: number,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const identities = manager.getRepository(ExternalIdentity);
      const users = manager.getRepository(User);
      const existing = await identities.findOne({
        where: { provider, providerUserId: profile.providerUserId },
        relations: { user: true },
      });
      if (existing) {
        if (bindUserId && existing.user.id !== bindUserId)
          throw new BusinessException('外部身份已被其他账号绑定');
        return {
          outcome: bindUserId ? 'bound' : 'authenticated',
          user: existing.user.getData(),
        };
      }
      let user: User;
      if (bindUserId) user = await users.findOneBy({ id: bindUserId });
      else {
        const emailOwner = await users.findOneBy({ email: profile.email });
        if (emailOwner)
          return {
            outcome: 'binding_required',
            bindingToken: await this.createBinding(provider, profile),
          };
        user = users.create({
          email: profile.email,
          nickname: profile.displayName || profile.email.split('@')[0],
          avatar: profile.avatarUrl,
          password: null,
        });
        await users.save(user);
      }
      if (!user) throw new BusinessException('绑定用户不存在');
      await identities.save(
        identities.create({
          provider,
          providerUserId: profile.providerUserId,
          email: profile.email,
          displayName: profile.displayName,
          avatarUrl: profile.avatarUrl,
          user,
        }),
      );
      return {
        outcome: bindUserId ? 'bound' : 'authenticated',
        user: user.getData(),
      };
    });
  }

  private async createBinding(
    provider: ExternalProvider,
    profile: ExternalProfile,
  ) {
    const token = randomBytes(32).toString('base64url');
    await this.cache.jsonSet(
      `external-binding:${token}`,
      { provider, profile },
      600,
    );
    return token;
  }

  async bind(userId: number, token: string) {
    const data = await this.oneTimeState.consume<any>(
      `external-binding:${token}`,
    );
    if (!data) throw new BusinessException('绑定凭证无效或已过期');
    try {
      await this.resolve(data.provider, data.profile, userId);
    } catch (reason) {
      if (!this.isDuplicate(reason)) throw reason;
      const winner = await this.identityRepo.findOne({
        where: {
          provider: data.provider,
          providerUserId: data.profile.providerUserId,
        },
        relations: { user: true },
      });
      if (!winner || winner.user.id !== userId)
        throw new BusinessException('外部身份已被其他账号绑定');
      // The winner is the same authenticated local account; issue below.
    }
    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: ['roles'],
    });
    return { outcome: 'bound', ...this.userService.issueSession(user) };
  }

  async unbind(userId: number, identityId: number) {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(ExternalIdentity);
      const identity = await repo.findOne({
        where: { id: identityId, user: { id: userId } },
        relations: { user: true },
      });
      if (!identity) throw new BusinessException('外部身份不存在');
      const count = await repo.count({ where: { user: { id: userId } } });
      if (!identity.user.password && count <= 1)
        throw new BusinessException('不能解绑最后一种可用登录方式');
      await repo.remove(identity);
      return true;
    });
  }
}
