# Implementation Plan

## Ordered checklist

### 1. Compatibility and test foundation

- [ ] Declare and verify Node 22 LTS across local metadata, CI/deployment documentation, NestJS/Fastify startup, migrations, and tests.
- [ ] Pin a supported certified OIDC provider/client library combination and prove the CommonJS native dynamic-import bridge without converting the whole project to ESM.
- [ ] Add a focused backend test runner and isolated MySQL/Redis test configuration or test adapters; do not point tests at developer/production data.
- [ ] Add frontend unit/component test tooling only for security-relevant composables and forms; otherwise document browser cases alongside required type-check/build checks.

Gate: on Node 22, provider mounts without runtime warnings, Discovery renders, build passes, and tests run in isolation. Stop for re-review if a whole-project module-system conversion is required.

### 2. Explicit database migrations

- [ ] Add TypeORM DataSource and migration scripts; make `synchronize` an explicit development-only opt-in and false by default.
- [ ] Add/evolve entities for exact redirect URIs, client metadata, external identities, and encrypted provider configuration.
- [ ] Create forward and down migration; migrate existing callbacks/secrets safely and fail on ambiguous callback data.
- [ ] Test constraints, existing-user preservation, and rollback on a disposable database.

Gate: migration up/down succeeds on a representative pre-change schema and does not expose secrets.

### 3. OIDC provider

- [ ] Implement Redis adapter, account claims, client lookup, asymmetric signing/JWKS, issuer validation, and configured feature restrictions.
- [ ] Implement server-owned login/consent interactions and approve/deny completion.
- [ ] Replace legacy OAuth endpoints with standard Authorization, Token, UserInfo, Discovery, and JWKS endpoints.
- [ ] Cover exact redirects, state/nonce propagation, S256 PKCE, code replay, client binding, token expiry, claims-by-scope, standard errors, and key rotation.

Gate: a standard OIDC client completes Authorization Code + PKCE and validates the ID Token; legacy response contract no longer exists.

### 4. GitHub/Google identity and local account binding

- [ ] Add encrypted provider config service and admin/public endpoints with validation, masking, enable rules, permissions, and safe audit logging.
- [ ] Implement Google OIDC and GitHub OAuth start/callback adapters using short-lived state transactions.
- [ ] Implement new-user creation, stable provider-ID lookup, `binding_required`, authenticated bind, safe unbind, and no-verified-email outcomes transactionally.
- [ ] Ensure provider access tokens are never persisted or logged.

Gate: tests cover repeat login, email collision, duplicate callbacks, missing email, disabled provider, tampered state, concurrent link creation, and last-login-method protection.

### 5. Dispatch and integrate the `safe-house` UI task

- [ ] Publish/freeze the backend API and interaction contracts needed by `safe-house/.trellis/tasks/08-03-oauth-login-center-ui`.
- [ ] Start and dispatch that repository-local task only after its declared backend-contract dependency is satisfied.
- [ ] Consume its independently checked frontend commit and run the cross-repository browser/end-to-end matrix from this task.

Gate: frontend type-check/build passes and the manual/browser matrix covers desktop/mobile, permissions, cancellation, expiry, and all callback outcomes.

### 6. Atomic cutover and documentation

- [ ] Document new environment variables, provider-console callback URLs, key generation/rotation, migrations, rollback limits, and breaking API removal.
- [ ] Run full backend and frontend checks.
- [ ] Execute an end-to-end smoke test for password login, GitHub, Google, account binding, provider administration, and a standard relying-party login.
- [ ] Confirm no secret/token/code appears in logs, API payloads, browser persistence, or committed fixtures.

## Validation commands

Backend (exact test command finalized when the test runner is added):

```bash
pnpm exec eslint "{src,apps,libs,test}/**/*.ts"
pnpm run build
pnpm run test
pnpm run migration:run
pnpm run migration:revert
```

Frontend:

```bash
pnpm type-check
pnpm lint
pnpm build
```

Also validate Discovery/JWKS and one real standard-client code flow against an isolated environment.

## Risky files and rollback points

- `src/app.module.ts`, bootstrap/middleware, TypeORM config: can affect every request or schema startup.
- `src/module/oauth/`: protocol replacement is intentionally breaking.
- `src/entity/User.ts`: nullable password changes login-method invariants.
- SubApp/client schema: callback and client-secret migration can lock out existing clients.
- `safe-house` router/auth store/callback views: failed state restoration can strand both external and relying-party login flows.
- Never auto-revert a production schema after new external-only accounts exist; use backup/forward migration per `design.md`.

## Acceptance checkpoint (2026-08-04)

- [x] Password login and real GitHub/Google login smoke tests passed; Google RFC 9207 `iss` callback propagation regression is covered.
- [x] Discovery/JWKS smoke tests passed; only Authorization Code, `openid profile email`, RS256 and S256 are advertised.
- [x] Legacy `/oauth/authorize`, `/oauth/token`, and `/oauth/user` routes return 404.
- [x] Backend lint, build, and all 33 automated tests pass on Node 22.
- [x] Provider administration and linked-identity pages were verified against the running frontend/backend pair.
- [x] Migration revert/run succeeds against the explicitly configured disposable MySQL database, rollback/final state checks pass, and the final read-only migration status reports the OAuth migration applied.
- [x] A loopback-only standard `openid-client` relying party completes Authorization Code + S256 PKCE; a wrong verifier and authorization-code replay are rejected. The acceptance regression is retained in `test/oidc-standard-client.spec.ts`.
- [x] Complete the remaining ordinary-user permission, callback cancellation/expiry, and responsive browser matrix before archiving this task.

Acceptance follow-up (2026-08-04): the standard-client run exposed and fixed two mount-boundary defects: Fastify now accepts and forwards token endpoint form bodies, and the provider retains the `/oidc` mount path in interaction-resume redirects. Under Node `v22.13.0`, backend lint/build and all 35 tests pass without the unsupported-runtime warning. `.env.test.local` was validated as the active, explicitly test-named database configuration and as distinct from every configured non-test database target without exposing its values. An authorized migration revert/run first exposed a TypeORM CLI defect: the stock commands forced query logging and printed secret parameters. Run/revert now use a repository runner that suppresses query/error objects, documentation explains the boundary, and a regression asserts the destructive scripts cannot use the stock CLI. The post-fix disposable-database verification passed: revert output was exactly `Migration revert completed`, run output was exactly `Migration run completed`, neither output contained SQL, parameters, or secrets, and the final read-only migration status reports the OAuth migration applied. Browser acceptance verified unauthenticated provider-admin denial, interaction-login `return_to` preservation, terminal missing-result callback guidance, and overflow-free 390px callback/login layouts. Redis database 1 is now configured and its host/port/database tuple is distinct from every configured non-test target. Authenticated ordinary-user denial, live approve/deny, and distinct backend-produced cancellation/expiry remain blocked because execution policy rejected starting the backend against the external disposable MySQL and Redis endpoints before any account or session data was created; no acceptance mutation occurred.

Final acceptance follow-up (2026-08-04): after explicit user authorization, the backend ran under Node `v22.13.0` against only the validated disposable test MySQL and Redis DB 1. Authenticated ordinary-user navigation to provider administration was denied. Live OIDC approval preserved `state` and `iss` and returned a code to the exact registered callback; live denial returned `access_denied`, `state`, and `iss`. A repeated request exposed and fixed remembered-consent bypass, and every request now presents explicit consent. Backend-produced external cancellation and expired-state results rendered their distinct guidance. Consent and callback views had no horizontal overflow at 390x844, and the desktop paths also passed. The run additionally fixed Fastify form-parser startup ordering, issuer-owned interaction-resume validation, and raw OIDC identifier exposure through Redis key logging by hashing key suffixes.

## Pre-start checks

- [ ] `prd.md` has no blocking open questions and passes convergence review.
- [ ] `design.md` and this plan reflect the final approved scope.
- [ ] `implement.jsonl` and `check.jsonl` contain only `h`-local backend/research context; the `safe-house` task owns its frontend context.
- [ ] User explicitly approves the final planning summary after these artifacts are complete.
