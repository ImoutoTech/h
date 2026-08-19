# Email Verification Guidelines

H owns email-verification challenges and account mutation; the notification
service only delivers the OTP. Registration challenges are anonymous. Email
change and password change challenges require an access token and bind to the
authenticated user. Password-change challenges always use the persisted current
email instead of a client-supplied address.

Normalize account emails with `normalizeEmail` (`trim` plus lowercase) before
challenge lookup, uniqueness checks, login, or persistence. OTP values are
HMAC-digested with `EMAIL_VERIFICATION_PEPPER`; plaintext OTPs and proofs must
never be persisted or logged. Inject the in-process `NOTIFICATION_APPLICATION`
port from `NotificationModule`; submit as the stable internal caller
`sso-email-verification`, use the challenge UUID as the idempotency key, and do
not loop back through H's authenticated HTTP notification API.

Verification proofs bind purpose, user (nullable only for registration), and
normalized email. Consume the proof under a pessimistic database lock in the
same transaction as user creation, email change, or password change. Never add
email back to the generic user-profile update DTO. Existing-password accounts
require the old password plus proof; passwordless accounts may set their first
password with the current-email proof.

Enforce challenge cooldown and hourly limits by both source hash and target,
plus persisted verification-attempt limits by source hash and per-challenge
failure limits. Return stable errors without exposing OTPs, proofs, full email
addresses, or database details.

`User.getData()` exposes only `emailVerified` and `hasPassword`. OIDC
`email_verified` derives from `emailVerifiedAt`. Email/password changes do not
revoke existing tokens; refresh and newly issued tokens read the current email.
