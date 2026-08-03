# Google OAuth real-environment debug checkpoint

## Status

- GitHub real login: accepted by the user.
- Google provider: configured and enabled, but real login returns the sanitized `provider_error` outcome.
- The backend has been stopped for the session pause.

## Evidence

1. The original callback rebuilt the authorization response with `state=unused` and omitted `expectedState`.
2. Commit `35cf3a6` passes the real callback state to both the current URL and `expectedState`, while preserving the Redis one-time consume, PKCE verifier, nonce, and exact redirect URI.
3. A post-fix real attempt still failed, so safe staged diagnostics were added. They emit only fixed classification tags and never dynamic exception text or OAuth material.
4. The latest real attempt classified the remaining failure as:

   ```text
   stage=token_exchange substage=id_token_claim reason=validation_failed
   ```

## Ruled out

- safe-house callback rendering and result exchange
- Redis state creation/consumption
- Google discovery
- token endpoint HTTP exchange/response shape
- JWKS lookup and ID Token signature classification
- claims projection after token validation

## Resume point

1. Inspect the finite-depth internal cause against `openid-client@6.8.1` / `oauth4webapi@3.8.6` claim checks without logging its message or attached claims.
2. Build a red test for the exact claim mismatch before changing business logic.
3. Verify issuer, audience, nonce, and any authorization-response `iss` behavior independently.
4. Remove every `[DEBUG-google-oauth]` diagnostic after the original real flow passes.
5. Run the `trellis-break-loop` retrospective and update the OAuth code-spec before final task completion.

