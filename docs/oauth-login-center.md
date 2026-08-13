# OAuth login center deployment

This release requires Node.js 22 LTS and is a breaking replacement of the legacy custom `/oauth/authorize`, `/oauth/token`, and `/oauth/user` contract.

Required environment:

- `PORT`: HTTP listen port, validated as an integer from 1 through 65535. It defaults to `4000` for backward compatibility when omitted; local OIDC development uses `3000` so the listener matches `OIDC_ISSUER`, `PUBLIC_URL`, and the frontend API origin.
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

`SAFE_HOUSE_PUBLIC_URL` is also the single CORS authority. Its exact origin receives credentialed GET/POST responses and OPTIONS preflight authorization across application and OIDC routes; other browser origins receive no CORS authorization headers.

Before cutover, back up MySQL and Redis, validate every existing callback, configure provider callback URLs, then run `pnpm migration:check-load`, inspect `pnpm migration:show`, and execute `pnpm migration:run`. Migration run and revert use the repository's parameter-suppressing runner because TypeORM's stock CLI enables query logging and can expose secret parameters. Migration scripts explicitly preload `ts-node/register` and `tsconfig-paths/register` so runtime imports resolve the same `@/` entity aliases as the Nest build. Deploy `h` and `safe-house` in the same window and smoke-test Discovery/JWKS, password login, GitHub, Google, binding, administration, and a complete Code + S256 PKCE flow.

Publish a new current public JWK alongside the previous public JWK for at least the maximum token lifetime during signing-key rotation. Private signing keys stay deployment-managed and are not exposed through admin APIs.

## Machine clients and notification contacts

Machine access is granted per `(client, resource, scope)`. An administrator with
`oauth-machine-grant-admin` can provision a confidential client through
`POST /app/admin/confidential-clients`; the response contains its secret exactly
once. Existing confidential clients can be managed through
`GET|PUT /app/:id/resource-grants`. Public clients are never configured with the
Client Credentials grant.

Provision notification-service with only the `h-internal` resource and
`users:contact:read` scope. Configure H with `NOTIFICATION_CONTACT_CLIENT_IDS`
as a comma-separated allowlist (or `NOTIFICATION_CLIENT_ID` for a single client).
The service then requests a five-minute token using
`resource=urn:h:resource:h-internal` and calls
`GET /internal/v1/users/:id/notification-contacts/email`. Resource indicators
are stable RFC 8707 URNs; the resulting JWT audience remains `h-internal`.

The fixed resource catalog is:

- `notification-api`: `notifications:send`, `notifications:read`
- `h-internal`: `users:contact:read`
- `notification-admin`: `notifications:read`, `notifications:send`,
  `notifications:manage`

For an Authorization Code request targeting `notification-admin`, the client
grant and the signed-in user's permission codes are intersected. Permission
codes may be the scope itself or `notification-admin:<scope>`.
`notification-admin` is rejected for Client Credentials tokens even when the
client has catalog grants; it always requires an end-user authorization grant.

Do not run `migration:revert` after external-only users or identity/configuration records are created. Restore the backup or ship a forward corrective migration instead.
