# Technical Design

## Boundary and Contract

- Backend remains the authority for external-identity ownership.
- Add a normalized callback outcome `identity_not_bound` for a verified Provider identity whose `(provider, provider_user_id)` has no `external_identities` row.
- `identity_not_bound` contains only `outcome`; it contains no user, local session, or binding token.
- The frontend callback union and result view handle this outcome explicitly and route the user back to local login. After login, binding starts only through authenticated `GET /external/identities/:provider/start` from the identity settings page.

## Backend Data Flow

1. Validate state, Provider callback, issuer/nonce/PKCE, and verified email as today.
2. Look up `(provider, provider_user_id)` transactionally.
3. For a normal login callback:
   - existing identity: return `authenticated` and issue the existing user's session;
   - missing identity: return `identity_not_bound` with no database writes and no session issuance.
4. For an authenticated binding callback (`bindUserId` present): preserve the existing transactional bind flow and uniqueness/ownership checks.
5. Duplicate-key recovery must preserve the same distinction: a concurrent winner may authenticate only when an identity row now exists; otherwise return `identity_not_bound`, never create a user.

## Compatibility

- Keep the legacy `binding_required`/binding-token exchange code and frontend handling during this focused fix so a callback result created immediately before deployment can still complete. New unauthenticated callbacks no longer emit it.
- Do not migrate or automatically merge already-created users. Existing external identities continue to authenticate their current owner until a separate audited cleanup is approved.
- Update the backend and frontend OAuth contract specs because their current “first login creates a user / email collision emits binding_required” rules are superseded.

## Risks and Rollback

- Main risk: changing only one side makes the frontend fall into generic error handling. Backend and frontend outcome unions must ship together.
- Existing incorrectly created identities will still block binding; this is intentionally deferred rather than risking automatic account reassignment.
- Rollback is limited to reverting the outcome and resolve-branch changes; no migration or destructive data operation is involved.
