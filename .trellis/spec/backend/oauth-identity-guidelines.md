# OAuth / OIDC Identity Center Contracts

## Scenario: OIDC and external-provider changes

### 1. Scope / Trigger

Use this contract whenever changing OIDC endpoints, sub-application credentials, GitHub/Google login, external identity binding, provider configuration, signing keys, Redis authorization state, or their database migrations.

### 2. Signatures

- OIDC issuer base: `${OIDC_ISSUER}` (deployed under `/oidc`).
- Interaction page: `${SAFE_HOUSE_PUBLIC_URL}/authorize/interaction/:uid`; interaction API: `GET|POST /oauth/interaction/:uid`.
- External callback result: provider callback redirects to `${SAFE_HOUSE_PUBLIC_URL}/external/callback?result=<opaque>`; exchange with `GET /external/result/:id`.
- Identity management: `GET /external/identities/me`, `GET /external/identities/:provider/start`, `POST /external/identities/bind`, `DELETE /external/identities/:id`.
- Provider administration: `GET /external/admin/providers`, `POST /external/admin/providers/:provider` with permission `oauth-provider-admin`.
- Database uniqueness: `(provider, provider_user_id)` identifies an external identity; redirect URI comparison is exact.
- Migration commands: `pnpm migration:run` and `pnpm migration:revert` invoke `src/database/run-migrations.ts`; `migration:show` remains read-only.

### 3. Contracts

- OIDC supports only Authorization Code, `S256` PKCE, and `openid profile email`; no refresh token or offline access.
- Every authorization request requires a fresh explicit consent interaction, even when an OIDC session or grant already exists.
- Validate the URL returned by `interactionFinished` as an issuer-owned `/oidc/auth/:id` resume URL. The provider performs the subsequent exact registered-client callback validation.
- Derive OIDC Redis key suffixes from a one-way digest of codes, tokens, session IDs, UIDs, and grant IDs so infrastructure key logging cannot disclose bearer material.
- External callback results are Redis-backed, single-use, and short-lived. URLs contain only an opaque result ID, never local/provider tokens or binding tokens.
- External-provider callbacks preserve every protocol parameter required by the standards client. In particular, Google callback `iss` must flow through `ExternalCallbackDto -> IdentityController -> ExternalIdentityService` and be included in the reconstructed callback URL passed to `openid-client`; never rebuild that URL from only `code` and `state`, and never disable issuer validation to compensate.
- `authenticated` session result: `{ outcome, token, refresh, user }`.
- A verified Provider identity without an existing `(provider, provider_user_id)` row returns `{ outcome: 'identity_not_bound' }`; an unauthenticated callback never creates a user, external identity, local session, or binding token.
- Authenticated bind callback: `{ outcome: 'bound', user }`; binding-token exchange: `{ outcome: 'bound', token, refresh, user }`.
- Provider and confidential-client secrets use separate AES-256-GCM keys/envelopes. Plaintext is allowed only for one-time creation responses or transient provider memory.
- Required deployment keys include `OIDC_ISSUER`, current signing private JWK/kid, optional previous public JWK, `OIDC_CLIENT_SECRET_KEY`, `PROVIDER_SECRET_KEY`, and validated `SAFE_HOUSE_PUBLIC_URL`.
- `PORT` controls the internal listener and defaults to the historical `4000`; when set, it is a decimal integer in `1..65535`. Local environments without a reverse proxy must align it with the port in `OIDC_ISSUER` and `PUBLIC_URL`.
- Install exactly one credentialed CORS policy, derived from the exact origin of `SAFE_HOUSE_PUBLIC_URL`, across `/external`, `/oauth`, and `/oidc`. Do not combine Nest/Fastify CORS with the legacy `FastifyCorsMiddleware` or `ALLOWED_ORIGIN` path exceptions.
- Feature modules may inject only providers exported by imported modules. One-time Redis state is accessed through the Identity-owned adapter that injects the exported `RedisService`; never inject the upstream private raw-client token.
- OIDC ESM packages run on Node 22 LTS through native dynamic import; the Nest build remains CommonJS.
- Migration run/revert must not use TypeORM's stock CLI because it enables query/parameter logging. The repository runner emits only fixed success/failure text and must never serialize TypeORM errors containing SQL or secret parameters.
- Register `application/x-www-form-urlencoded` support without colliding with Nest/Fastify's default parser, and forward the parsed form body to `oidc-provider` for token requests.

### 4. Validation & Error Matrix

- Missing/invalid/replayed state or result ID -> typed `state_invalid_or_expired` without echoing state.
- Google callback missing or mismatched `iss` -> reject through `openid-client` as `provider_error`; do not synthesize an issuer or bypass RFC 9207 validation.
- Disabled provider -> `provider_disabled`; incomplete credentials -> `provider_misconfigured`; sanitized upstream failure -> `provider_error`; cancellation -> `cancelled`.
- Verified Provider identity without an external-identity binding -> `identity_not_bound`; unverified/missing email -> `verified_email_required`.
- Redirect mismatch, missing/wrong verifier, code replay, or unsupported scope/flow -> standard protocol error; never redirect to an unregistered URI.
- Unbinding the last login method -> domain error `不能解绑最后一种可用登录方式`.
- Secret decryption or migration preflight failure -> abort before the first MySQL DDL because MySQL DDL implicitly commits.
- Invalid `PORT` (sign, whitespace, fraction, text, zero, or above `65535`) -> fail startup without echoing the configured value.
- Allowed safe-house origin -> credentialed CORS headers and authorized preflight `204`; another browser origin -> no CORS authorization; an Origin-less protocol/server client remains allowed.
- Installed `RedisService` without atomic `getDel` capability -> fail closed; never degrade one-time state to separate `GET` plus `DEL`.
- Migration failure -> fixed non-sensitive error text and non-zero exit status; never log the TypeORM error object, query, or parameters.

### 5. Good/Base/Bad Cases

- Good: consume callback/result/binding data with atomic Redis `GETDEL`, then return a normalized projection.
- Good: an unauthenticated callback with no identity row returns `identity_not_bound` before any user/identity save or session issuance; only a callback state carrying an authenticated `bindUserId` may create the identity relation.
- Base: account-link uniqueness races read the winning identity and verify ownership before succeeding.
- Bad: treat a verified Provider email as registration consent, create a passwordless user during login, or emit a binding token for an unbound login callback.
- Bad: prefix-match redirect URIs, put tokens in callback URLs, persist provider tokens, expose ciphertext envelopes, or return raw database/provider errors.
- Bad: invoke TypeORM's stock migration run/revert CLI or print caught migration errors, because SQL parameter logs can disclose plaintext or encrypted secret material.

### 6. Tests Required

- OIDC: mounted issuer routes, Discovery/JWKS claims, exact redirect rejection, S256 enforcement, code/state consume/replay, issuer-owned approve/deny resume allowlist, consent on every request, and key rotation.
- Storage: Redis consume/revoke/grant indexing; AES key/AAD isolation and tamper detection; client reload generation concurrency.
- Identity: unbound login has no database/session side effects, existing-identity login, authenticated binding, concurrent binding/ownership races, last-login invariant, sanitized outcomes, admin permission separation, and result replay.
- Google protocol regression: assert the exact callback URL passed to `authorizationCodeGrant` contains `code`, `state`, and the provider-returned `iss`, while PKCE verifier, expected state, and expected nonce remain enabled.
- Migration: cryptographic preflight before DDL, representative up/down on disposable MySQL, preservation/rollback guards.
- Migration CLI: statically assert run/revert scripts use the safe runner and its catch path cannot serialize TypeORM errors; execute down/up on a disposable database and assert output contains no `query:`, `PARAMETERS`, environment secrets, or database secret values.
- Token transport: boot the full Nest/Fastify application and complete a standard-client form-encoded token exchange to catch parser registration collisions and missing body forwarding.
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
if (!existingIdentity) {
  const user = await users.save(users.create({ email: profile.email }));
  return authenticate(user);
}
```

#### Correct

```typescript
if (!existingIdentity && !bindUserId) {
  return { outcome: 'identity_not_bound' };
}
```

#### Wrong

```typescript
const currentUrl = new URL(callback);
currentUrl.searchParams.set('code', code);
currentUrl.searchParams.set('state', state); // provider-returned iss was dropped
```

#### Correct

```typescript
const currentUrl = new URL(callback);
currentUrl.searchParams.set('code', code);
currentUrl.searchParams.set('state', state);
if (issuer) currentUrl.searchParams.set('iss', issuer);
// authorizationCodeGrant validates iss against discovered Google metadata.
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

#### Wrong

```json
{
  "migration:run": "typeorm migration:run",
  "migration:revert": "typeorm migration:revert"
}
```

#### Correct

```json
{
  "migration:run": "node -r ts-node/register -r tsconfig-paths/register src/database/run-migrations.ts run",
  "migration:revert": "node -r ts-node/register -r tsconfig-paths/register src/database/run-migrations.ts revert"
}
```
