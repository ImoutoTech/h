# Notification authentication deployment

This runbook covers the H side of verified-email delivery, notification machine
authentication, and the internal Contact API. It does not deploy
notification-service or create SMTP credentials.

## Prerequisites and configuration

Use Node.js 22 LTS, pnpm 10, MySQL 5.7.44 or a compatible test instance, and
Redis with atomic `GETDEL` support. The tracked `.env` supplies local defaults
and documents all settings; keep machine-specific values in the ignored
`.env.development.local`, which overrides the template. Deployment platforms
should inject the same names through their secret manager.

For local integration, `pnpm local:configure` preserves usable values, generates
only H-owned secrets, aligns H on `http://localhost:3000` and notification API
on `http://localhost:4100`, and leaves confidential-client pairs as explicit
placeholders until they are provisioned in H's database. Notification-service
containers use H's exact issuer claim while reaching its JWKS, token, and
Contact endpoints through `host.docker.internal`.

Generate independent secrets and assign their ownership as follows:

- H deployment owns `TOKEN_SECRET`, `EMAIL_VERIFICATION_PEPPER`, the current
  OIDC private signing JWK, `OIDC_CLIENT_SECRET_KEY`, and
  `PROVIDER_SECRET_KEY`. Generate random byte secrets with
  `openssl rand -base64 32`. Generate an RSA signing JWK using an audited JOSE
  tool, retain the private JWK only in H, and publish public keys through JWKS.
- H database stores encrypted client-secret envelopes. The one-time plaintext
  returned while provisioning `h-account-email` belongs in H's secret manager;
  the one-time plaintext for the `notification-service` client belongs in the
  notification-service secret manager.
- `NOTIFICATION_CLIENT_ID` and `NOTIFICATION_CLIENT_SECRET` identify H when it
  calls notification-service. Grant only
  `notification-api/notifications:send`. The client ID is the UUID returned by
  H's confidential-client provisioning endpoint, not a chosen display name.
- `NOTIFICATION_CONTACT_CLIENT_IDS` is the comma-separated allowlist of clients
  that may call H. Grant those clients only
  `h-internal/users:contact:read`. Add the UUID returned when provisioning the
  notification-service client, not its display name. Changing an allowlist or
  grant requires a controlled application/provider reload.
- Never reuse the email pepper, signing key, provider encryption key, client
  encryption key, database password, or either provisioned client secret.

The optional verification settings default to a 600-second TTL, 60-second
resend cooldown, and five attempts. Keep `TYPEORM_SYNCHRONIZE=false`; production
also disables synchronization in code.

For local validation and startup:

```bash
# Generate missing H-owned local secrets without replacing existing or
# operator-owned values, start MySQL and Redis, then:
pnpm local:configure
pnpm local:start -- --check
pnpm local:start
```

The `--check` command checks configuration and TypeORM metadata without connecting
to or changing the database. The final command shows and applies pending migrations,
then starts H in watch mode. Use `--skip-migrations` only after separately
confirming migrations have been applied.

## Deployment order

1. Back up MySQL and Redis, record the running H and notification-service
   versions, and test restoration before the maintenance window.
2. Install dependencies and run `pnpm build`, `pnpm test`, and
   `pnpm migration:check-load` from the exact release artifact.
3. Inject H-owned keys and URLs. During rotation, retain the old current OIDC
   signing public key as the previous key for at least the maximum outstanding
   token lifetime.
4. Run `pnpm migration:show`, review the pending list, then run
   `pnpm migration:run` with the parameter-suppressing repository runner.
5. Start H and verify `/health`, `/oidc/.well-known/openid-configuration`, and
   `/oidc/jwks`. Complete a password login and Authorization Code + S256 PKCE
   flow before provisioning machine clients.
6. With an `oauth-machine-grant-admin` administrator, provision the two
   confidential clients described above. Capture each secret exactly once in
   its owner's secret manager. Configure the H notification client values and
   restart H; configure the Contact client values in notification-service.
7. Start notification-service. Request a five-minute token for
   `urn:h:resource:h-internal` and call H's Contact API for a known verified
   user. Then request an H token for
   `urn:h:resource:notification-api` and submit a disposable email verification
   challenge end to end.

H must be reachable before either service requests an H token. An H process can
start before notification-service is ready, but email challenge delivery will
fail closed until notification-service and H's sending client are configured.

## Health and authorization checks

- `GET /health` returns HTTP 200 with `status: ok`. It is process readiness, not
  a deep MySQL/Redis/notification dependency check.
- Discovery advertises Client Credentials and the resource-indicator behavior;
  JWKS exposes only public key material.
- A notification-service token has `aud=h-internal`,
  `scope=users:contact:read`, the expected `client_id`, and a 300-second TTL.
- The Contact API returns an address only for a verified user. Missing and
  unverified users both return `notification_contact_unavailable`.
- H's sender token has `aud=notification-api` and only
  `notifications:send`. Logs must not contain OTPs, email addresses, bearer
  tokens, client secrets, or private JWK fields.

## Rollback boundaries

Application rollback is safe only while the older binary can tolerate the
forward-compatible schema and no newly created identity or email-verification
facts would be lost. Stop traffic before changing database state. Do not run
`migration:revert` merely to roll back application code: MySQL DDL commits
implicitly, and the email-ownership migration intentionally preserves verified
user facts on down migration.

After new external identities, client grants, challenges, or verified-email
changes exist, prefer a forward corrective release. If a database rollback is
unavoidable, stop H and notification-service, restore the tested MySQL and Redis
backup as one coordinated recovery point, restore the matching secret/key
versions, then deploy the matching application versions. Revoking a machine
client prevents new tokens but does not invalidate already issued five-minute
JWTs; wait out their lifetime or reject the client at the resource service.
