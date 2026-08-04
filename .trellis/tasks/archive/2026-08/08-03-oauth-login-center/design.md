# Technical Design

## Architecture and boundaries

The release contains one atomic cross-repository feature:

1. `h` migration/config foundation establishes explicit TypeORM migrations and production-safe schema control.
2. `h` OIDC provider replaces the custom OAuth protocol and uses a standards library mounted into Fastify.
3. `h` external-identity module acts as an OAuth/OIDC client of GitHub and Google and links provider identities to local users.
4. `h` provider-configuration API encrypts credentials and exposes admin-only masked configuration.
5. The separate `safe-house/.trellis/tasks/08-03-oauth-login-center-ui` task implements external login, identity management, provider administration, and OIDC interaction/consent pages against the contracts owned here.

The repositories use separate Trellis tasks because their specs, checks, commits, and archives are repository-local. This `h` task owns backend contracts and final cross-repository integration acceptance. The `safe-house` task explicitly depends on those contracts; neither deliverable is independently deployable during the one-time cutover.

## Backend modules

### OIDC provider

- Replace the current custom `OAuthService` behavior with a provider integration that owns `/authorize`, `/token`, `/userinfo`, Discovery, and JWKS.
- Mount the provider through the existing Fastify application without bypassing global security/error behavior for application-owned interaction and admin routes.
- Configure only Authorization Code, `S256` PKCE, `openid profile email`, and `response_type=code`. Disable implicit/hybrid, dynamic registration, refresh tokens, device flow, and unsupported experimental features.
- Require exact redirect URI registration. Bind authorization codes to client, redirect URI, account, nonce, scope, and PKCE challenge; codes are short-lived and one-time.
- Sign ID Tokens with the environment-provided asymmetric JWK/private key and current `kid`. JWKS contains the current public key and optional previous public key during rotation.
- Use opaque access tokens backed by Redis for UserInfo; never reuse the application's existing JWT as an OIDC token.
- Implement the provider adapter on Redis with explicit key namespaces and expiry. Tests may use an isolated in-memory adapter.
- Resolve OIDC `sub` as a stable non-email local identifier. Claims expose only requested data: `profile` controls nickname/avatar and `email` controls email plus `email_verified`.

### Clients and sub-applications

- Evolve the existing `SubApp` domain rather than create a parallel client registry. Store an exact redirect URI collection and client type/authentication method.
- Public clients have no secret and must use PKCE. Confidential client secrets use AES-256-GCM at rest because `oidc-provider` requires plaintext transiently for authentication. A dedicated `OIDC_CLIENT_SECRET_KEY` is never shared with provider-credential encryption; plaintext is shown only once and otherwise exists only in provider memory. Client changes apply through an atomic fingerprinted provider rebuild without restarting the process.
- Existing callback strings and secrets are migrated into the new schema where valid. Invalid/ambiguous callback values block migration and must be corrected before cutover.

### External identities

- Add `external_identities` with a unique `(provider, provider_user_id)` constraint and a relation to `users`. Store display metadata needed for account settings, not provider access/refresh tokens.
- Google flow: use Discovery, Authorization Code + PKCE/state/nonce, validate the ID Token through a standards client, require `email_verified`, and key identity by `sub`.
- GitHub flow: use web authorization flow with `read:user user:email`, validate `state`, fetch `/user` and `/user/emails`, require a verified primary email, and key identity by GitHub numeric user ID.
- External callbacks resolve an existing identity first. If none exists and verified email is new, create a local user and link atomically. Because `users.password` is currently required, make it nullable and treat `password != null` as an available login method.
- If verified email already exists, return a typed `binding_required` outcome. The user signs in locally and explicitly binds; the callback must carry a short-lived, single-use binding transaction rather than trusting browser-supplied provider data.
- Unbinding is transactional and rejected when it would remove the last usable login method.

### Provider configuration and encryption

- Add one configuration record per supported provider (`github`, `google`) with enabled state, client ID, encrypted secret envelope, timestamps, and updater identity.
- Encrypt secret values with AES-256-GCM using an environment key. Persist ciphertext, random 96-bit nonce, authentication tag, and key version. Bind provider identity/version as additional authenticated data.
- Admin reads return `configured`, masked hint, enabled state, and non-secret metadata. Empty secret on update preserves the current secret. Enabling requires a complete valid configuration.
- Never log provider tokens, secrets, codes, signing material, or encryption payloads. Audit only actor ID, provider, action, and success/failure.

## Frontend flows

Implementation ownership for this section belongs to `safe-house/.trellis/tasks/08-03-oauth-login-center-ui`; this document is the authoritative backend contract and integration source.

- Login page keeps password login and adds GitHub/Google buttons derived from the public enabled-provider endpoint.
- External callback route handles success, `binding_required`, missing verified email, disabled/misconfigured provider, cancellation, and expired state without exposing provider tokens in URLs or persisted state.
- Account settings list linked identities and provide bind/unbind actions with last-login-method errors surfaced clearly.
- Admin-only provider page uses typed API methods and a validated form. Secret is write-only; blank means unchanged and the UI shows only configuration status/mask.
- OIDC authorization interaction page reads a server-side interaction by opaque UID, displays client and requested claims, requires explicit confirmation every time, and posts approve/deny. It does not reconstruct trusted protocol data from arbitrary query parameters.

## Data and request flow

### Relying-party login

`client -> /authorize -> server interaction -> safe-house login/consent -> interaction completion -> client callback(code,state,iss) -> /token(code+verifier) -> ID Token/access token -> /userinfo`

### External login into the center

`safe-house -> h external start -> provider authorize -> h callback validates state/code -> provider identity validation -> local identity lookup/create/binding_required -> issue existing h application session -> resume pending OIDC interaction when present`

## Configuration

- Runtime baseline is Node 22 LTS. Keep the Nest/TypeScript output as CommonJS and load ESM-only OIDC libraries through a native dynamic-import bridge.
- `OIDC_ISSUER`: canonical HTTPS issuer; fail startup if absent/invalid outside local development.
- `OIDC_SIGNING_JWK`, `OIDC_SIGNING_KID`: current signing key material.
- Optional previous public JWK/key ID for rotation publication; the previous private key is not required.
- `OIDC_CLIENT_SECRET_KEY` and `OIDC_CLIENT_SECRET_KEY_VERSION`: separate AES-GCM envelope key for relying-party client credentials.
- `PROVIDER_SECRET_KEY` and `PROVIDER_SECRET_KEY_VERSION`: 32-byte encryption key material and version.
- `TYPEORM_SYNCHRONIZE`: explicit development-only opt-in; false by default.

## Migration, rollout, and rollback

- Introduce a TypeORM DataSource and migration commands. Production synchronization defaults off.
- Migration creates provider configuration and identity tables, makes password nullable, and evolves redirect URI/client metadata with uniqueness and foreign keys.
- Before release: back up MySQL and Redis, validate all registered callbacks, install provider credentials and signing/encryption keys, run migration, then deploy `h` and `safe-house` in the same window.
- Smoke-test Discovery/JWKS, password login, both external providers, binding, admin config, and one complete OIDC client flow.
- Application rollback requires rolling back both repositories. Schema rollback is allowed only if no new external-only users or identity/config records must be preserved; otherwise restore backup or use a forward corrective migration.

## Important trade-offs and deferred items

- No legacy OAuth compatibility, refresh token, offline access, remembered consent, SAML/LDAP, MFA, or providers beyond GitHub/Google.
- Runtime proof showed `oidc-provider@9.8.2` rejects Node 20 despite successful mounting. Node 22 LTS is now approved; a whole-project ESM conversion remains out of scope.
- OIDC conformance certification is not part of MVP, but implementation must be testable with a standard client and structured for a later conformance-suite run.
