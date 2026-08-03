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

## Pre-start checks

- [ ] `prd.md` has no blocking open questions and passes convergence review.
- [ ] `design.md` and this plan reflect the final approved scope.
- [ ] `implement.jsonl` and `check.jsonl` contain only `h`-local backend/research context; the `safe-house` task owns its frontend context.
- [ ] User explicitly approves the final planning summary after these artifacts are complete.
