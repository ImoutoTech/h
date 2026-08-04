# Implementation Plan

## 1. Backend behavior

- [x] Add focused service tests for unbound login, existing-identity login, authenticated binding, and duplicate/ownership races.
- [x] Change unauthenticated resolution so a missing identity returns `identity_not_bound` without creating `User` or `ExternalIdentity` records.
- [x] Ensure callback session issuance occurs only for `authenticated` with a real existing user and loaded roles.
- [x] Preserve authenticated settings-page binding and legacy binding-token compatibility.

Gate: focused tests prove no repository save/session issuance for an unbound login and preserve existing login/bind behavior.

## 2. Frontend contract and UX

- [x] Extend the callback discriminated union with `identity_not_bound`.
- [x] Render explicit Chinese guidance that the Provider account is not bound and binding must be initiated from login-method settings after local login.
- [x] Ensure this outcome never writes local tokens, user data, or an in-memory binding token.
- [x] Retain legacy `binding_required` handling for rolling-deploy compatibility.

Gate: callback behavior is exhaustive and the unbound state stays on a visible result page until the user chooses to return to login.

## 3. Specifications and verification

- [x] Update backend and frontend OAuth identity contracts to replace automatic first-login creation with explicit `identity_not_bound` behavior.
- [x] Run backend focused tests, non-mutating ESLint, and build.
- [x] Run frontend type-check, lint (inspect any applied fixes), and build.
- [ ] Manually verify a credentialed Provider callback and settings-page reauthorization against a running integration environment (deferred: no live Provider credentials/database were available in this session).

Rollback point: no schema/data migration is allowed; revert code/spec changes together if the coordinated contract cannot ship.
