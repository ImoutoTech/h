# Standards and Repository Research

## Repository findings

- `h` is a NestJS 10/Fastify service on Node 20 with CommonJS output. It uses TypeORM/MySQL and Redis; no test runner or migration command is configured.
- `synchronize: true` is currently hard-coded in `src/app.module.ts`. This task therefore needs an explicit TypeORM migration foundation before adding identity/configuration tables.
- `safe-house` is a Vue 3/Vite/Naive UI client. It already owns password login, sub-application management, and the custom authorization confirmation page, so it is the correct UI boundary for provider configuration and OIDC interactions.
- Neither repository currently has automated tests. The backend security protocol requires a focused test setup; the frontend requires type-check/build plus targeted tests or a documented browser verification matrix.

## Standards evidence

- OpenID Connect Core defines the Authorization Code Flow, ID Token validation, and UserInfo behavior. Discovery and JWKS allow relying parties to locate endpoints and verify signatures.
  - https://openid.net/specs/openid-connect-core-1_0-final.html
- OAuth 2.0 Security BCP (RFC 9700) requires exact redirect URI matching and PKCE for public clients, and warns against open redirectors and code-injection attacks.
  - https://www.rfc-editor.org/rfc/rfc9700.html
- Google exposes an OpenID Connect implementation and an `email_verified` claim. Google identity must be keyed by stable `sub`, not email.
  - https://developers.google.com/identity/openid-connect/openid-connect
  - https://developers.google.com/identity/openid-connect/reference
- GitHub OAuth Apps use the web application authorization-code flow. The authenticated-user emails endpoint exposes `primary` and `verified`; reading private emails requires `user:email`.
  - https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps
  - https://docs.github.com/en/rest/users/emails

## Library direction

- Prefer a certified authorization-server library rather than implementing OIDC protocol primitives by hand. `panva/node-oidc-provider` supports OIDC Core, Discovery, JWKS, adapters, interactions, and mounting in Fastify.
  - https://github.com/panva/node-oidc-provider
- The current backend emits CommonJS and runs Node 20, while current provider/client libraries may be ESM-only and have changing Node support. First implementation step must pin and prove a Node-20-compatible version in a minimal Nest/Fastify mount. If the supported version requires a runtime/module-system upgrade, stop and re-review that infrastructure change instead of silently broadening scope.

## Design implications

- Use the provider library for protocol parsing, error contracts, grants, token issuance, Discovery, and JWKS. Custom Nest services own users, clients, provider configuration, encryption, interactions, and account linking.
- GitHub/Google access tokens are transient inputs used to fetch/validate identity; do not persist them after creating the local identity link.
- Use Redis-backed transient state for authorization transactions, PKCE-bound codes, access tokens, and external-provider `state`; do not use the provider library's in-memory adapter outside tests.
- Use exact registered redirect URI arrays rather than the current prefix comparison.
