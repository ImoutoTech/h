# Frozen frontend contract — v1

Status: frozen for `safe-house/.trellis/tasks/08-03-oauth-login-center-ui`.

All normal Nest responses continue to use the repository's global response envelope. OIDC protocol responses are emitted directly by `oidc-provider` and must not be unwrapped as application envelopes.

## OIDC relying-party flow

- Issuer: `OIDC_ISSUER`, deployed with `/oidc` as its protocol base.
- Discovery: `GET /.well-known/openid-configuration`.
- Only `response_type=code`, `code_challenge_method=S256`, and scopes `openid profile email` are supported. `openid` is required.
- Every request redirects to `/oauth/interaction/:uid`; the UID is opaque and expires after 10 minutes.
- `GET /oauth/interaction/:uid` (authenticated) returns `{ uid, client: { id, name, description }, prompt, scope }`.
- `POST /oauth/interaction/:uid` (bearer-authenticated XHR) body `{ approved: boolean }` returns `{ continuationUrl }`. Navigate the top-level browser to it. The URL is produced by `oidc-provider` after validated completion and constrained to the client's exact registered callback; the browser never supplies it.
- Token endpoint never issues refresh tokens. Authorization codes live 120 seconds; ID/access tokens live 600 seconds.
- Client redirect/configuration and credential rotations take effect on the next protocol request through an atomic provider generation swap; no service restart is required.

## External login

- `GET /external/providers` is public and returns enabled provider projections: `{ provider, enabled, clientId, configured, secretHint, updatedAt }[]`. The UI should use only `provider` and `enabled` here.
- `GET /external/:provider/start?return_to=<relative path>` is public and returns `{ authorizationUrl }`. Supported providers are `github`, `google`.
- Provider consoles target backend `GET /external/:provider/callback`. The backend stores a normalized result for 120 seconds and redirects only to `${SAFE_HOUSE_PUBLIC_URL}/external/callback?result=<opaque-id>`. No token, binding token, provider state/code/error, or raw error appears in the URL.
- The frontend callback calls public `GET /external/result/:id` exactly once. It atomically returns one of:
  - `{ outcome: "authenticated", token, refresh, user }` using the same local-session issuer as password login
  - `{ outcome: "bound", user }` when an already-authenticated identity-binding start completes; this result does not rotate the existing local session
  - `{ outcome: "binding_required", bindingToken }`
  - `{ outcome: "verified_email_required" }`
  - `{ outcome: "cancelled" }`
  - `{ outcome: "state_invalid_or_expired" }`
  - `{ outcome: "provider_disabled" }`
  - `{ outcome: "provider_misconfigured" }`
  - `{ outcome: "provider_error" }`
- Replayed or expired result IDs return `{ outcome: "state_invalid_or_expired" }`.
- `bindingToken` is opaque, single-use, and expires after 10 minutes. Never persist it beyond the active flow.
- `POST /external/identities/bind` (authenticated), body `{ bindingToken }`, returns `{ outcome: "bound", token, refresh, user }`.
- Every `user` above is the sanitized `User.getData()` projection: `{ id, nickname, role, email, avatar, created_at, updated_at }`; it never contains a password, roles relation, or provider token.
- `GET /external/identities/me` (authenticated) returns sanitized linked identities.
- `DELETE /external/identities/:id` (authenticated) returns `true`; domain error message `不能解绑最后一种可用登录方式` must be surfaced.

## Provider administration

Routes require permission `oauth-provider-admin`.

- `GET /external/admin/providers` returns masked projections only.
- `POST /external/admin/providers/:provider` accepts `{ clientId?: string, clientSecret?: string, enabled?: boolean }`.
- Blank/omitted `clientSecret` preserves the stored secret. A read never returns ciphertext, nonce, tag, key version, plaintext, authorization code, or provider token.
- Enabling incomplete configuration returns a domain error.

## Required callback URLs

- GitHub: `${PUBLIC_URL}/external/github/callback`
- Google: `${PUBLIC_URL}/external/google/callback`

The UI must represent cancellation, expired/tampered state, disabled provider, `binding_required`, and missing verified email as distinct outcomes. No provider token is returned to or stored by the browser.
