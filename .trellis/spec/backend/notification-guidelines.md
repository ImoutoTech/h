# Notification Module Contracts

## Scenario: H 内置事务通知

### 1. Scope / Trigger

新增或修改 `NotificationModule`、通知管理接口、通知 Key、模板、投递队列、SMTP adapter、重试/清理或 Safe House 通知契约时，必须遵循本节。该模块处理凭据、收件地址和正文，并在多 H 实例下并发运行，因此普通 CRUD 约定不足以保证安全。

### 2. Signatures

- External: `POST /v1/notifications`, `GET /v1/notifications/:id`，使用 `Authorization: NotificationKey <value>`。
- Admin: `/v1/notification-admin/channels/email`, `/templates`, `/apps`, `/template-options`, `/apps/:appId/policy`。
- Owner Key: `/v1/apps/:appId/notification-keys`。
- DB roots: `notifications` + `notification_deliveries`; one notification owns one delivery per normalized recipient.
- Adapter seam: core acceptance/dispatcher depends on `ChannelAdapter`, resolved by the adapter registry; SMTP is one adapter, not the registry implementation.

### 3. Contracts

- Content is discriminated: `{kind:'template',templateKey,variables}` or `{kind:'content',subject,text,html?}`; never both.
- HTML variables are escaped before sanitization. Template HTML and capability-gated direct HTML use the same sanitizer before the encrypted queue snapshot is created.
- Template admins and applications granted `directContent` are trusted CSS authors: `<style>`, media queries, inline `style`, and email presentation attributes are preserved without a CSS property/value allowlist. This intentionally accepts remote tracking and visual-spoofing risk; CSS is not an executable-content security boundary.
- HTML active content remains blocked: executable/embedded/form tags, external stylesheet links, refresh metadata, event attributes, and `srcdoc` are removed. URL-bearing HTML attributes and each `srcset` candidate must use the configured safe schemes; adding a new URL attribute also requires adding it to scheme enforcement.
- Follow-up data migrations for built-in templates must preserve administrator content: fill a default field only while that field is `NULL`, and clear it on rollback only while its value is byte-identical to the migration's default.
- At most 20 normalized recipients; any invalid recipient rejects the whole acceptance transaction.
- Optional idempotency is scoped by `(appId,idempotencyKey)` for seven days; same canonical hash returns the original ID, different hash conflicts.
- `NOTIFICATION_SECRET_KEY` and its version protect SMTP passwords, recipient addresses, and rendered snapshots with AES-256-GCM plus purpose/record-bound AAD.
- Dispatcher uses MySQL 5.7 compare-and-set leases. Completion must include `lease_owner` in its write predicate; a stale worker may never save a reclaimed entity.
- Payload purge is based on terminal age; seven-day row deletion is anchored to immutable acceptance `createdAt`, not mutable `updatedAt`.
- Policy-only admins read `/apps` and `/template-options`; full subject/body projections require `notification-template-admin`.

### 4. Validation & Error Matrix

| Condition | Result |
|---|---|
| invalid/disabled/deleted Notification Key | reject before policy/data access |
| manual address/direct content without app capability | insufficient capability |
| missing/extra template variable or disabled/ungranted template | stable template/variable error |
| HTML variable contains tags or attribute delimiters | escape as text before sanitization; never create markup |
| active HTML tag/attribute or unsafe URL scheme | remove it while retaining safe display content |
| arbitrary CSS in trusted template/direct content | preserve it unchanged |
| built-in template already has administrator HTML | migration leaves it unchanged; rollback also preserves later customization |
| more than 20 recipients or any invalid target | reject whole request, create no rows |
| same idempotency key, different request hash | conflict |
| Redis unavailable during external acceptance | fail closed; do not bypass rate limits |
| SMTP disabled before acceptance | channel unavailable; do not enqueue |
| SMTP disabled after enqueue | retain until enabled or 24-hour expiry |
| expired/reclaimed lease | stale worker completion affects zero rows |

### 5. Good / Base / Bad Cases

- Good: authorized template request resolves all recipients, sanitizes/renders once, encrypts snapshots, and inserts root plus deliveries in one transaction.
- Good: preserve complete email CSS while applying explicit safe tag/attribute lists and scheme checks to HTML execution surfaces.
- Good: add a built-in template HTML default with `WHERE html IS NULL`, then guard rollback with a byte-identical comparison against that default.
- Base: no idempotency key creates a new notification for each call and documents duplicate risk.
- Bad: unconditionally update or clear a built-in template field in a migration, overwriting administrator-authored content.
- Bad: add `style` to attributes but leave style parsing enabled, which silently removes nonstandard email-client CSS.
- Bad: allow a presentation URL attribute such as `background` without adding it to `allowedSchemesAppliedToAttributes`.
- Bad: logging DTOs, addresses, variables, API Keys, SMTP passwords or decrypted snapshots.
- Bad: using two independent Redis increments for request and recipient limits; use one Lua operation so accounting is atomic.
- Bad: relying only on HTTP DTO validation; H internal callers must pass the same application-boundary size/shape checks.

### 6. Tests Required

- Envelope tamper/AAD/key-version isolation and one-time Key digest behavior.
- Runtime nested DTO metadata plus internal-call and rendered-output size limits.
- Recipient atomic rejection/dedupe/capability, idempotency same/different request and transaction rollback.
- One-Lua rate accounting and Redis-unavailable fail-closed behavior.
- Lease-owner CAS, expired-lease recovery, pre-send 24-hour expiry, atomic root aggregation and partial failure.
- Cleanup proves purge does not extend seven-day retention.
- Permission tests prove policy admins receive only `{id,name}` apps and `{id,key,name,enabled}` template options.
- HTML tests prove `<style>`, media queries, arbitrary inline CSS and common email layout attributes survive for both templates and direct content.
- HTML security tests prove escaped interpolation cannot break into attribute context; active tags, event attributes, `srcdoc`, encoded/control-character unsafe schemes, unsafe `background`, and unsafe `srcset` candidates are removed.
- Built-in template migration tests assert ordering, exact template key and null-only upgrade predicate, byte-identical rollback predicate, variable references, and sanitizer-rendered output.
- The compiled CommonJS smoke test must call the real sanitizer boundary, not only the source-module test transform.

### 7. Wrong vs Correct

Wrong:

```ts
delivery.status = 'sent';
await deliveries.save(delivery); // stale worker can overwrite a reclaimed lease
```

Correct:

```ts
await deliveries.update(
  { id: delivery.id, status: 'processing', leaseOwner: workerToken },
  { status: 'sent', leaseOwner: null, leaseExpiresAt: null },
);
```

For HTML sanitization, do not treat CSS and executable HTML as the same trust boundary:

```typescript
// Wrong: breaks real email CSS while missing URL attributes added later.
allowedAttributes: { '*': ['class'] };

// Correct: trusted CSS remains intact; active tags/attributes stay off the
// allowlist and every URL-bearing HTML attribute receives scheme checks.
allowedAttributes: { '*': ['class', 'style'], table: ['background'] };
allowedSchemesAppliedToAttributes: ['href', 'src', 'cite', 'background'];
parseStyleAttributes: false;
```

For built-in template data migrations, do not take ownership of fields that administrators can edit:

```sql
-- Wrong: overwrites customized content and deletes later edits on rollback.
UPDATE notification_templates SET html = ? WHERE `key` = ?;
UPDATE notification_templates SET html = NULL WHERE `key` = ?;

-- Correct: install only into an empty field and undo only the unchanged default.
UPDATE notification_templates SET html = ? WHERE `key` = ? AND html IS NULL;
UPDATE notification_templates SET html = NULL
WHERE `key` = ? AND BINARY html = BINARY ?;
```
