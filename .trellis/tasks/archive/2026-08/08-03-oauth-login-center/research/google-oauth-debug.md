# Google OAuth real-environment debug checkpoint

## Status

- GitHub real login: accepted by the user.
- Google provider: real login accepted by the user after preserving the callback `iss` parameter.
- Temporary staged diagnostics were removed after acceptance.

## Evidence

1. The original callback rebuilt the authorization response with `state=unused` and omitted `expectedState`.
2. Commit `35cf3a6` passes the real callback state to both the current URL and `expectedState`, while preserving the Redis one-time consume, PKCE verifier, nonce, and exact redirect URI.
3. A post-fix real attempt still failed, so safe staged diagnostics were added. They emit only fixed classification tags and never dynamic exception text or OAuth material.
4. Safe message fingerprints identified the underlying fixed library error:

   ```text
   response parameter "iss" (issuer) missing
   ```
5. Google Discovery advertises `authorization_response_iss_parameter_supported=true`, and the browser callback supplied `iss`; `ExternalCallbackDto` / controller / service reconstruction dropped it before `openid-client` validation.
6. The fix preserves provider-returned `iss` in the reconstructed callback URL while keeping issuer, state, nonce, and PKCE validation enabled.

## Ruled out

- safe-house callback rendering and result exchange
- Redis state creation/consumption
- Google discovery
- token endpoint HTTP exchange/response shape
- JWKS lookup and ID Token signature classification
- claims projection after token validation

## Retrospective

- Category: **B — Cross-Layer Contract**, compounded by **D — Test Coverage Gap**.
- Earlier attempts focused on token/claim validation because the controller-to-client callback reconstruction boundary was not represented as an exact protocol contract.
- Prevention: DTO/controller/service regression coverage for `iss`; OAuth spec now forbids reduced callback reconstruction and forbids disabling issuer validation.
