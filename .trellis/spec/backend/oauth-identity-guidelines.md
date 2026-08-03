# OAuth / OIDC Identity Center Contracts

## Scenario: OIDC and external-provider changes

### 1. Scope / Trigger

Use this contract whenever changing OIDC endpoints, sub-application credentials, GitHub/Google login, external identity binding, provider configuration, signing keys, Redis authorization state, or their database migrations.

### 2. Signatures

- OIDC issuer base: `${OIDC_ISSUER}` (deployed under `/oidc`).
- Interaction: `GET|POST /oauth/interaction/:uid`.
- External callback result: provider callback redirects to `${SAFE_HOUSE_PUBLIC_URL}/external/callback?result=<opaque>`; exchange with `GET /external/result/:id`.
- Identity management: `GET /external/identities/me`, `GET /external/identities/:provider/start`, `POST /external/identities/bind`, `DELETE /external/identities/:id`.
- Provider administration: `GET /external/admin/providers`, `POST /external/admin/providers/:provider` with permission `oauth-provider-admin`.
- Database uniqueness: `(provider, provider_user_id)` identifies an external identity; redirect URI comparison is exact.

### 3. Contracts

- OIDC supports only Authorization Code, `S256` PKCE, and `openid profile email`; no refresh token or offline access.
- External callback results are Redis-backed, single-use, and short-lived. URLs contain only an opaque result ID, never local/provider tokens or binding tokens.
- `authenticated` session result: `{ outcome, token, refresh, user }`.
- Authenticated bind callback: `{ outcome: 'bound', user }`; binding-token exchange: `{ outcome: 'bound', token, refresh, user }`.
- Provider and confidential-client secrets use separate AES-256-GCM keys/envelopes. Plaintext is allowed only for one-time creation responses or transient provider memory.
- Required deployment keys include `OIDC_ISSUER`, current signing private JWK/kid, optional previous public JWK, `OIDC_CLIENT_SECRET_KEY`, `PROVIDER_SECRET_KEY`, and validated `SAFE_HOUSE_PUBLIC_URL`.
- `PORT` controls the internal listener and defaults to the historical `4000`; when set, it is a decimal integer in `1..65535`. Local environments without a reverse proxy must align it with the port in `OIDC_ISSUER` and `PUBLIC_URL`.
- Install exactly one credentialed CORS policy, derived from the exact origin of `SAFE_HOUSE_PUBLIC_URL`, across `/external`, `/oauth`, and `/oidc`. Do not combine Nest/Fastify CORS with the legacy `FastifyCorsMiddleware` or `ALLOWED_ORIGIN` path exceptions.
- Feature modules may inject only providers exported by imported modules. One-time Redis state is accessed through the Identity-owned adapter that injects the exported `RedisService`; never inject the upstream private raw-client token.
- OIDC ESM packages run on Node 22 LTS through native dynamic import; the Nest build remains CommonJS.

### 4. Validation & Error Matrix

- Missing/invalid/replayed state or result ID -> typed `state_invalid_or_expired` without echoing state.
- Disabled provider -> `provider_disabled`; incomplete credentials -> `provider_misconfigured`; sanitized upstream failure -> `provider_error`; cancellation -> `cancelled`.
- Existing verified email without an identity -> `binding_required`; unverified/missing email -> `verified_email_required`.
- Redirect mismatch, missing/wrong verifier, code replay, or unsupported scope/flow -> standard protocol error; never redirect to an unregistered URI.
- Unbinding the last login method -> domain error `不能解绑最后一种可用登录方式`.
- Secret decryption or migration preflight failure -> abort before the first MySQL DDL because MySQL DDL implicitly commits.
- Invalid `PORT` (sign, whitespace, fraction, text, zero, or above `65535`) -> fail startup without echoing the configured value.
- Allowed safe-house origin -> credentialed CORS headers and authorized preflight `204`; another browser origin -> no CORS authorization; an Origin-less protocol/server client remains allowed.
- Installed `RedisService` without atomic `getDel` capability -> fail closed; never degrade one-time state to separate `GET` plus `DEL`.

### 5. Good/Base/Bad Cases

- Good: consume callback/result/binding data with atomic Redis `GETDEL`, then return a normalized projection.
- Base: account-link uniqueness races read the winning identity and verify ownership before succeeding.
- Bad: prefix-match redirect URIs, put tokens in callback URLs, persist provider tokens, expose ciphertext envelopes, or return raw database/provider errors.

### 6. Tests Required

- OIDC: mounted issuer routes, Discovery/JWKS claims, exact redirect rejection, S256 enforcement, code/state consume/replay, approve/deny continuation allowlist, and key rotation.
- Storage: Redis consume/revoke/grant indexing; AES key/AAD isolation and tamper detection; client reload generation concurrency.
- Identity: first login, collision, concurrent binding, last-login invariant, sanitized outcomes, admin permission separation, and result replay.
- Migration: cryptographic preflight before DDL, representative up/down on disposable MySQL, preservation/rollback guards.
- Environment: repeat protocol checks under Node 22, real providers, and a standard relying-party client.
- Startup wiring: compile the complete Nest feature-module provider graph using an actual `RedisService` prototype and resolve `ExternalIdentityService`; assert one atomic `getDel` per consume.
- CORS/listener: test default and boundary ports, invalid port rejection, allowed-origin GET/OPTIONS headers, denied-origin absence of authorization, and a static regression proving the legacy middleware/path exclusions are absent.

### 7. Wrong vs Correct

#### Wrong

```typescript
if (redirectUri.startsWith(app.callback)) return providerToken;
```

#### Correct

```typescript
assertRegisteredRedirectUri(redirectUri);
const resultId = await storeSingleUseResult(normalizedOutcome);
return fixedSafeHouseCallback(resultId);
```

#### Wrong

```typescript
consumer.apply(FastifyCorsMiddleware).exclude('/oauth/(.*)').forRoutes('*');
@Inject('h-redis-client') private readonly redisClient: RedisClient;
await app.listen(4000);
```

#### Correct

```typescript
app.enableCors(corsOptionsForSafeHouse(safeHouseBase));
constructor(private readonly oneTimeState: OneTimeStateService) {}
await app.listen(resolveListenPort(config.get<string>('PORT')));
```
