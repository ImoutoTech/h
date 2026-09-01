# 丰富用户基本信息概览：集成设计

## Architecture

该父任务跨越两个 Git 仓库：

```text
h (NestJS/MySQL/oidc-provider)
  ├─ user_activity_events 持久化事件
  ├─ 账号/子应用/OIDC 采集点
  └─ GET /user/me/overview + GET /user/me/activity
                         │ typed REST contract
                         ▼
safe-house (Vue 3)
  ├─ API types + endpoint factories
  ├─ useUserOverview composable
  └─ user-info.vue 概览、状态、空态与最近活动
```

后端子任务先冻结接口契约，前端子任务再接入。父任务不直接承载产品代码，负责需求源、跨子任务口径和最终集成验收。

## Shared Contracts

### Overview

`GET /user/me/overview` 使用当前 access token 身份，不接受 user id。固定返回近 30 天窗口：

```ts
interface UserOverview {
  account: {
    emailVerified: boolean
    hasPassword: boolean
    linkedIdentities: Array<{ provider: 'github' | 'google'; createdAt: string }>
    joinedAt: string
    updatedAt: string
  }
  apps: null | {
    total: number
    running: number
    closed: number
    banned: number
    windowDays: 30
    loginSuccesses: number
    authorizationApproved: number
    authorizationDenied: number
  }
}
```

`apps: null` 表示当前用户没有查看子应用权限；有权限但没有子应用时返回数值均为 `0` 的真实空集合。这样前端能区分“不允许展示”和“允许但没有数据”。

### Activity

`GET /user/me/activity?page=1&size=20&category=` 返回现有 `{ items, count, total }` 分页形状。单项只包含安全投影：

```ts
interface UserActivityItem {
  id: string
  category: 'account' | 'oidc' | 'identity' | 'subapp'
  action: string
  outcome: 'success' | 'failure' | 'approved' | 'denied'
  summary: string
  detail?: string
  target?: { type: 'subapp' | 'identity'; id?: string; name: string }
  occurredAt: string
}
```

内部 metadata 不直接返回；后端为每种可公开事件生成稳定、安全的 summary/detail/target 投影。

## Cross-Task Data Flow

1. 业务服务在动作成功或已知失败边界调用统一 Activity writer。
2. `OAuthService.finish()` 记录同意/拒绝决策；`oidc-provider` 的 `grant.success` 只在 Authorization Code grant 成功完成后记录 `oidc/login_succeeded`。
3. writer 使用去重键保证协议事件不重复；OIDC 登录去重键来自 AuthorizationCode 实体的非 bearer `jti`，不保存原始 code。
4. overview 按当前用户聚合账号安全、外部身份、子应用状态和最近 30 天事件。
5. activity 只按 `actor_user_id` 返回当前账号事件；owner 聚合字段不改变个人时间线边界。
6. Safe House composable 并行读取 overview 与第一页 activity，独立表示错误，以便账号资料仍可用时局部重试失败区域。

## Compatibility and Migration

- 新表通过 TypeORM migration 创建；生产环境 `synchronize` 已关闭，不依赖自动建表。
- 不回填历史 OIDC 或旧 `visitNum`。上线前数据自然为 0，并在页面显示“近 30 天”。
- 保留现有 `/user/:id`、`/app/my` 与 `/external/identities/me` 契约，避免影响其他页面。
- 新事件写入不得改变认证/授权主流程的对外成功语义；协议成功事件写入失败记录安全 warn，后续由测试确认不会泄露 bearer 数据。

## Security and Privacy

- 当前用户接口使用 `@AuthRoles('user')`；子应用聚合继续遵守“查看子应用”权限。
- activity 查询固定 `actor_user_id = 当前用户`，不接受任意用户过滤。
- `metadata` 仅允许 login method、changed fields、scope 名称和已脱敏对象名称等白名单值。
- 不保存完整 IP；P1 不做设备/地区展示。匿名未知账号登录失败可保留 `actor_user_id = null` 供运维，但不会出现在个人 activity。
- 清理任务使用可配置天数，默认 90，按 `occurred_at` 删除原始事件。

## Rollout and Rollback

- 顺序：部署 h migration 与后端接口，再部署 safe-house。
- Safe House 在旧后端上会遇到新接口 404，因此两个部署应在同一发布窗口，或先上线后端。
- 回滚前端只恢复原 `user-info.vue`；回滚后端代码时保留事件表无害。migration revert 仅在确认无需保留已采集事件后执行。
- 历史指标从功能上线时开始，不承诺回填。

## Trade-offs

- 选择 token exchange 而非授权码签发，使“登录”更接近实际完成，但采集依赖 `oidc-provider@9.8.2` 的 `grant.success` 和 AuthorizationCode 实体契约，必须用集成测试锁定。
- P1 直接聚合 90 天内原始事件，不建设日汇总表；数据规模增长后由 P2 引入汇总表。
- overview 采用单一聚合接口减少浏览器请求和权限漂移，但会让后端 service 承担跨实体只读聚合职责。
