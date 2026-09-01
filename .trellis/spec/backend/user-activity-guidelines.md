# User Activity and Overview Contracts

## 1. Scope / Trigger

Use this contract when adding account activity, developer overview metrics, or
OIDC consent/login instrumentation. It covers the storage-to-API boundary and
the frontend-safe projection consumed by the user basic information tab.

## 2. Signatures

### API

- `GET /user/me/overview`
- `GET /user/me/activity?page=<int>&size=<int>&category=<optional enum>`

Both endpoints derive the subject from the authenticated access token. They
must never accept a user ID parameter.

Apply `@AuthRoles('user')` to each route handler. The installed authentication
guard reads metadata from `context.getHandler()` only; controller-class
metadata does not populate `request.user` for `@UserParams()`.

### Writer

Callers use the discriminated `ActivityCommand` union through:

```ts
ActivityWriterService.record(command: ActivityCommand): Promise<void>
```

The writer owns the event taxonomy and metadata allowlist. Do not expose an
arbitrary metadata write API.

### Database

`user_activity_events` stores:

- actor and metric ownership: `actor_user_id`, `owner_user_id`
- optional target snapshot: `app_id`, `target_name`
- taxonomy: `category`, `action`, `outcome`
- allowlisted `metadata`, optional SHA-256 `dedupe_key`
- immutable ordering timestamp: `occurred_at`

Indexes must support actor timelines, owner metrics, app history, and unique
deduplication.

## 3. Contracts

### Overview response

```ts
interface UserOverview {
  windowDays: 30
  account: {
    email: string
    createdAt: Date
    updatedAt: Date
    emailVerified: boolean
    hasPassword: boolean
    identities: Array<{
      id: number
      provider: 'github' | 'google'
      email: string | null
      displayName: string | null
      avatarUrl: string | null
      createdAt: Date
    }>
  }
  apps: null | {
    total: number
    running: number
    closed: number
    banned: number
    loginSucceeded: number
    consentApproved: number
    consentDenied: number
  }
}
```

Return `apps: null` unless the current user is an administrator or has the
existing `PeqSazMt` view-subapp permission. A permitted owner with no apps gets
real zero values. Developer metrics use the trailing 30-day window and never
read the legacy `visitNum` field.

### Activity response

```ts
interface UserActivityPage {
  items: Array<{
    id: string
    category: 'account' | 'identity' | 'oidc' | 'subapp'
    action: string
    outcome: 'success' | 'failure' | 'approved' | 'denied'
    summary: string
    detail?: string
    target?: { type: 'subapp' | 'identity'; id?: string; name: string }
    occurredAt: Date
  }>
  count: number
  total: number
  page: number
  size: number
  hasMore: boolean
}
```

Personal activity is selected only by `actor_user_id`. Stored JSON metadata is
never returned directly; the service maps it to safe `summary`, `detail`, and
`target` fields. Unknown actions use a generic safe summary.

### Event and retention rules

- Count an OIDC login only on `grant.success` for
  `grant_type=authorization_code` with an AuthorizationCode entity.
- Consent, unredeemed codes, refreshes, failures, and replays are not successful
  OIDC logins.
- Application metrics use the event's `owner_user_id` snapshot.
- Hash protocol dedupe sources with SHA-256 before persistence.
- Never persist or log an authorization code, token, JWT, password, full
  secret, Redis payload, or complete IP address.
- Event recording is additive: duplicates and storage failures must not change
  the primary authentication, authorization, or account operation result.

`USER_ACTIVITY_RETENTION_DAYS` is optional, accepts `1..3650`, and defaults to
`90`. `USER_ACTIVITY_CLEANUP_ENABLED` defaults to `true`. Cleanup runs hourly
and deletes by `occurred_at`.

## 4. Validation & Error Matrix

| Condition | Required behavior |
| --- | --- |
| Missing/invalid access token | Existing authentication guard rejects the request |
| Auth metadata exists only on the controller class | Guard skips authentication and `@UserParams()` is undefined; move metadata to each handler |
| `page < 1` or `size` outside `1..100` | Validation error naming the invalid field |
| Unknown `category` | Validation error naming `category` |
| User lacks app-view permission | Overview succeeds with `apps: null` |
| User has permission but owns no apps | Overview succeeds with zero-valued app metrics |
| Event dedupe key already exists | Ignore the duplicate; primary operation remains successful |
| Event lookup/write/cleanup fails | Emit a fixed warning; primary operation remains successful |
| Unknown stored action | Return the generic safe summary, never raw metadata |
| Invalid retention configuration | Fall back to 90 days |

## 5. Good / Base / Bad Cases

- Good: an authorization code is successfully exchanged once; one deduplicated
  `oidc.login_succeeded.success` event contributes to the app owner's 30-day
  login metric and the actor's timeline.
- Base: a permitted owner has no apps or events; the API returns zero metrics
  and an empty activity page.
- Bad: consent is approved but the code is never redeemed; record the consent
  decision only and do not increment successful logins.
- Bad: a caller passes token contents or arbitrary metadata; reject the design
  and extend the typed command plus projection allowlist instead.

## 6. Tests Required

- Writer unit tests assert actor/owner isolation, metadata whitelisting,
  SHA-256 dedupe without raw protocol values, duplicate handling, and safe
  persistence failure.
- Query tests assert permission distinctions, true-zero versus `apps: null`,
  fixed-window filters, actor-only pagination, and safe projection fields.
- OIDC tests assert approve/deny separately from successful code exchange and
  assert no login event for other grant types or a missing code entity.
- Retention tests assert the 90-day default, bounded override, immutable
  timestamp cutoff, and invalid-config fallback.
- Migration tests assert table/index creation and a down migration; run a real
  migration up/down/up when MySQL infrastructure is available.
- Quality gates are non-mutating ESLint, Nest build, full Vitest (including the
  loopback OIDC client flow), and TypeORM metadata load.

## 7. Wrong vs Correct

### Wrong

```ts
// visitNum is updated only by a legacy callback and is not an OIDC login count.
const loginSucceeded = app.meta.visitNum

// Consent happens before token exchange and must not count as login success.
provider.on('authorization.success', incrementLogin)

// The current guard does not read controller-class auth metadata.
@AuthRoles('user')
@Controller('user/me')
class ActivityController {}

// An inferred initialized property emits design:type Object in this project.
class ActivityQueryDto {
  @IsInt()
  page = 1
}
```

### Correct

```ts
class ActivityController {
  @Get('overview')
  @AuthRoles('user')
  overview(@UserParams() user: UserJwtPayload) {}
}

class ActivityQueryDto {
  @Type(() => Number)
  @IsInt()
  page: number = 1
}

provider.on('grant.success', (ctx) => {
  if (ctx.oidc.params.grant_type === 'authorization_code') {
    void activity.record(toSuccessfulCodeExchange(ctx))
  }
})
```

The handler must still hash the authorization-code JTI for deduplication and
must absorb event-write failures so the OIDC protocol result is unchanged.
