# OAuth login center deployment

This release requires Node.js 22 LTS and is a breaking replacement of the legacy custom `/oauth/authorize`, `/oauth/token`, and `/oauth/user` contract.

Required environment:

- `OIDC_ISSUER`: canonical HTTPS issuer, normally ending in `/oidc`.
- `OIDC_SIGNING_JWK`: current asymmetric private JWK JSON; never commit it.
- `OIDC_SIGNING_KID`: current signing key ID.
- `OIDC_PREVIOUS_PUBLIC_JWK`, `OIDC_PREVIOUS_KID`: optional previous public JWK during the validation window. The previous private key is not required.
- `OIDC_CLIENT_SECRET_KEY`, `OIDC_CLIENT_SECRET_KEY_VERSION`: dedicated 32-byte base64 AES-GCM key and version for confidential relying-party credentials. Do not reuse `PROVIDER_SECRET_KEY`.
- `PROVIDER_SECRET_KEY`: base64 encoding of exactly 32 random bytes.
- `PROVIDER_SECRET_KEY_VERSION`: envelope-key version such as `v1`.
- `PUBLIC_URL`: canonical public backend origin used for GitHub/Google callbacks.
- `SAFE_HOUSE_PUBLIC_URL`: clean HTTPS frontend base URL (HTTP only for localhost). Provider callbacks redirect only to its fixed `/external/callback` route with an opaque result ID.
- `TYPEORM_SYNCHRONIZE`: false by default. Production ignores a true value.

Before cutover, back up MySQL and Redis, validate every existing callback, configure provider callback URLs, then run `pnpm migration:run`. Deploy `h` and `safe-house` in the same window and smoke-test Discovery/JWKS, password login, GitHub, Google, binding, administration, and a complete Code + S256 PKCE flow.

Publish a new current public JWK alongside the previous public JWK for at least the maximum token lifetime during signing-key rotation. Private signing keys stay deployment-managed and are not exposed through admin APIs.

Do not run `migration:revert` after external-only users or identity/configuration records are created. Restore the backup or ship a forward corrective migration instead.
