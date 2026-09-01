# 用户概览事件与接口：技术设计

## Module Boundary

新增 `src/module/activity/`：

- `activity.module.ts`：注册 entity、controller、writer/query/cleanup services，导出 writer。
- `activity.types.ts`：稳定事件 taxonomy、类型化写入命令与公共响应类型。
- `activity-writer.service.ts`：白名单映射、owner/app 快照解析、幂等写入和安全失败处理。
- `activity-query.service.ts`：overview 聚合、个人 activity 分页与安全投影。
- `activity-cleanup.service.ts`：默认 90 天清理。
- `activity.controller.ts`：`/user/me/overview` 与 `/user/me/activity`。

`ActivityModule` 只依赖 TypeORM repositories、Config、Logger 和 System permission token；User/Identity/OAuth/Subapp modules 单向导入它，避免 Activity 反向调用业务 service 造成循环依赖。

## Persistence

`UserActivityEvent` 使用明确表名 `user_activity_events`：

| Column | Shape |
|---|---|
| `id` | UUID primary key |
| `actor_user_id` | nullable int；个人 activity 归属 |
| `owner_user_id` | nullable int；子应用 owner 聚合归属 |
| `app_id` | nullable varchar(36) |
| `target_name` | nullable varchar；删除后仍可安全显示 |
| `category` | varchar stable enum |
| `action` | varchar stable enum |
| `outcome` | varchar stable enum |
| `metadata` | nullable JSON，由 writer 白名单生成 |
| `dedupe_key` | nullable char(64), unique |
| `occurred_at` | immutable datetime(6) |

索引覆盖 `(actor_user_id, occurred_at)`、`(owner_user_id, occurred_at)`、`(app_id, occurred_at)` 和唯一 `dedupe_key`。使用 migration 建表；生产环境不依赖 synchronize。

## Writer Contract

调用者只能传入 discriminated command，例如：

```ts
type ActivityCommand =
  | { kind: 'account.login'; actorUserId?: number; method: LoginMethod; outcome: 'success' | 'failure' }
  | { kind: 'oidc.consent'; actorUserId: number; appId: string; scopes: string[]; outcome: 'approved' | 'denied'; dedupeSource: string }
  | { kind: 'oidc.login'; actorUserId: number; appId: string; scopes: string[]; authorizationCodeJti: string }
  | { kind: 'account.changed'; actorUserId: number; action: AccountChange; changedFields?: string[] }
  | { kind: 'identity.changed'; actorUserId: number; provider: ExternalProvider; action: 'bound' | 'unbound' }
  | { kind: 'subapp.changed'; actorUserId: number; appId: string; appName: string; action: SubappAction }
```

writer 自己生成 category/action/outcome/metadata，不暴露任意 metadata API。协议 dedupe source 先做 SHA-256，再写固定长度 key。唯一冲突视为已成功记录；其他数据库失败只写不含命令对象的 warn。

## Instrumentation

- `UserService.login`：用户不存在的尝试可写 actor null；已知用户密码错误写 failure；成功会话签发后写 password success。不要在通用 `issueSession` 中盲目记录，避免身份绑定换发 session 被误算为登录。
- `ExternalIdentityService.callback`：仅 `authenticated` 成功结果记录 provider login；binding token exchange 不算新登录。
- User profile/email/password mutation：数据库事务或保存成功后记录。
- Identity bind/unbind：成功边界记录 provider 与动作。
- SubApp create/update/remove/secret operations：成功边界记录，删除前保留 app name snapshot。
- `OAuthService.finish`：interactionFinished 成功且 continuation allowlist 验证通过后记录 consent，dedupe source 使用 interaction uid 的摘要。
- 每次 AtomicReloader 构建的新 Provider 绑定一次 `grant.success` listener。listener 检查 authorization_code grant，读取 `ctx.oidc.entities.AuthorizationCode` 的 accountId/clientId/scope/jti，异步安全写入；listener 错误被捕获并记录固定 warn。

## Overview Query

1. 查询当前 User 与 ExternalIdentity 列表，生成 account snapshot。
2. 使用 JWT role/roles 与 permission service 判断 ADMIN/“查看子应用”权限。
3. 无权限直接返回 `apps: null`。
4. 有权限时按 owner 聚合 SubApp + SubAppMeta 状态。
5. 在 `occurred_at >= now - 30d` 且 `owner_user_id=current` 范围内条件聚合：
   - `oidc/login_succeeded + success`
   - `oidc/consent_decided + approved`
   - `oidc/consent_decided + denied`
6. 返回数值快照，不返回旧 `visitNum`。

## Activity Projection

内部 metadata 永不直接返回。query service 针对已知 action 构造：

```ts
interface UserActivityProjection {
  id: string
  category: ActivityCategory
  action: ActivityAction
  outcome: ActivityOutcome
  summary: string
  detail?: string
  target?: { type: 'subapp' | 'identity'; id?: string; name: string }
  occurredAt: Date
}
```

未知 action 使用安全通用摘要，不序列化 metadata。查询始终带 `actor_user_id=currentUserId`。

## Retention

`USER_ACTIVITY_RETENTION_DAYS` 默认 90，只接受合理正整数；无效配置回退默认。cleanup 每小时调度一次，按 `occurred_at < cutoff` 删除。调度失败写固定 warn，下一轮重试。

## Tests

- Entity/migration load 与 up/down 静态契约。
- Writer taxonomy、metadata 白名单、dedupe、owner snapshot 与失败降级。
- Overview 权限/状态/30d 时间边界。
- Activity actor 隔离、分页、过滤与未知 action 安全 fallback。
- User/Identity/SubApp 采集点的聚焦 service 测试。
- OIDC provider 集成：approve/deny、未兑换、成功兑换、code replay、provider reload listener 不重复。
- 日志/响应敏感字段否定断言。
- Cleanup 默认/覆盖/边界与失败重试。

## Compatibility

保留现有用户、子应用、身份与 OIDC 响应形状。新 writer 是附加副作用；失败不改变既有业务返回。部署时先运行 migration，再启动新后端。
