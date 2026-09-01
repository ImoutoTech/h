# 用户“基本信息” Tab 指标与数据能力调研

> 调研日期：2026-09-01  
> 范围：`h` 后端与其配套 `safe-house` 前端；以实体、migration、service/controller 和前端 API 定义为一手证据。  
> 本文只调研和建议，不包含产品代码修改。

## 结论摘要

基本信息 Tab 当前只显示邮箱、用户 ID、加入时间和上次编辑，页头另有头像、昵称和角色；它确实偏单薄。前端已经拿到但没有在该 Tab 显示的账号数据包括“邮箱已验证”和“已设置密码”。另外，已有接口可直接取到用户的子应用总数和外部登录方式。这些可以作为第一期的低成本补充。

“子应用登录次数”不能直接将现有 `visitNum` 当成可靠口径：它只在旧的 `POST /app/:id` 回调中累加，新 OIDC 授权流程不更新该字段。“授权次数”也没有持久化事件，OIDC Grant 只通过 adapter 写入 Redis，并且没有面向用户或子应用的统计索引。行为日志目前是运维日志字符串，不是可查询的产品事件。这三类数据需要从“埋点和事件模型”开始补。

## 口径先行

“用户基本信息”页面同时包含账号身份和开发者子应用两种视角。如果不先定义口径，“登录次数”容易在“该账号自己登录 H”、“该账号登录过的子应用”、“该账号所有子应用被全部用户登录”之间混淆。

建议将顶部业务指标定义为“我拥有的子应用”视角：

- **子应用数量**：当前用户作为 `owner` 的未删除子应用数。
- **子应用登录次数**：所属子应用中完成的 OIDC 登录流程数；应在业务上选定“授权码成功换 token”或“授权交互成功完成”作为唯一计数点，不计刷新 token。
- **授权次数**：所属子应用收到的用户授权决策，分为同意和拒绝；“授权率”用 `approved / decisions` 计算。
- **行为日志**：当前账号自身对资料、登录方式、子应用和密钥等的操作，不把所有终端用户的登录流量混入个人行为时间线。

## 当前页面和接口现状

- “基本信息”路由对应 `user-info.vue`，当前仅有四个 fact：邮箱、用户 ID、加入时间、上次编辑，下方是编辑资料和退出登录。见 [`safe-house/src/views/user/pages/user-info.vue:14-45`](../../../safe-house/src/views/user/pages/user-info.vue#L14)。
- 页头已显示头像、昵称、用户 ID 和角色，因此不建议再在指标卡里重复。见 [`safe-house/src/views/user/view-index.vue:42-57`](../../../safe-house/src/views/user/view-index.vue#L42)。
- 用户投影已包含 `emailVerified` 和 `hasPassword`，后端 `getData()` 也已返回。见 [`src/entity/User.ts:17-27`](../../src/entity/User.ts#L17) 与 [`src/entity/User.ts:86-97`](../../src/entity/User.ts#L86)；前端类型见 [`safe-house/src/types/user.ts:3-13`](../../../safe-house/src/types/user.ts#L3)。
- `GET /app/my` 已按当前用户过滤，返回 `count/total` 和子应用列表。见 [`src/module/subapp/subapp.controller.ts:45-54`](../../src/module/subapp/subapp.controller.ts#L45) 与 [`src/module/subapp/subapp.service.ts:117-138`](../../src/module/subapp/subapp.service.ts#L117)。前端已用 `count` 作为分页总数，见 [`safe-house/src/composables/useAppList.ts:9-25`](../../../safe-house/src/composables/useAppList.ts#L9)。
- `GET /external/identities/me` 已返回当前账号的 provider、邮箱/显示名、头像和绑定时间。见 [`src/module/identity/identity.controller.ts:112-116`](../../src/module/identity/identity.controller.ts#L112) 与 [`src/module/identity/external-identity.service.ts:42-55`](../../src/module/identity/external-identity.service.ts#L42)。

## 可展示数据清单

### A. 现有接口即可展示

| 信息 / 指标 | 当前可用性 | 建议展示 | 备注 |
|---|---|---|---|
| 邮箱验证状态 | `UserExportData.emailVerified` | 账号安全卡 + 状态 Badge | 数据已在当前用户请求中，无需新接口 |
| 密码是否已设置 | `UserExportData.hasPassword` | 账号安全卡 + “设置/修改密码”快捷操作 | 外部身份创建的账号可能无密码 |
| 子应用总数 | `/app/my` 的 `count` | Statistic Card，副文案“其中 N 个运行中” | 第一期可用 `size=1` 只取总数 |
| 外部登录方式 | `/external/identities/me` | 安全卡中 provider 图标/Badge，显示绑定数 | 可链接到已有“登录方式” Tab |
| 当前权限数 | `/user/permission` 返回的权限 code 数组 | 仅在管理/开发者语境下作为次级信息 | 普通用户通常不关心权限条目数，不建议占主指标卡 |
| 账号年龄 | `created_at` | 普通信息项：“加入 X 天/年” | 建议保留准确日期作 tooltip |
| 资料最后更新 | `updated_at` | 普通信息项 | 只代表 User 行更新，不是最后登录 |

前两项的直接证据为 [`src/entity/User.ts:60-69`](../../src/entity/User.ts#L60) 和 [`src/entity/User.ts:80-97`](../../src/entity/User.ts#L80)；子应用总数证据为 [`src/module/subapp/subapp.service.ts:117-138`](../../src/module/subapp/subapp.service.ts#L117)；外部身份返回值证据为 [`src/module/identity/external-identity.service.ts:42-55`](../../src/module/identity/external-identity.service.ts#L42)。

### B. 现有数据可聚合，但建议增加专用 summary API

| 指标 | 现有数据 | 聚合方式 | 展示形式 | 限制 |
|---|---|---|---|---|
| 子应用运行/关闭/封禁数 | `SubAppMeta.status` | 按 owner + status `GROUP BY` | 总数卡副文案，或三段进度条 | 现有 `/app/my` 要拉全量列表才能前端聚合 |
| public/confidential 客户端分布 | `SubApp.clientType` | 按 owner + clientType `GROUP BY` | 集成概况中的小型分段条 | 更偏开发者信息，不应占账号概览主卡 |
| 旧子应用访问量 | `SubAppMeta.visitNum` | 对 owner 下的应用求和，并取 Top N | 总数卡 + 按应用水平条 | **只能标注“旧接口访问”，不能命名为 OIDC 登录次数** |
| 子应用最近编辑 | `SubApp.updated_at` | owner 下取 `MAX(updated_at)` 和对应 app | “最近活动应用”摘要 | 编辑时间不等于流量活跃时间 |
| 子应用通知请求数 | `notifications.app_id/created_at` | owner 子应用 JOIN notification，按日分组 | 7 日趋势折线/柱状图 | 终态记录 7 天后删除，只适合做短期窗口 |
| 通知收件人数、成功/失败数、成功率 | `total_count/sent_count/failed_count/status` | 按 owner 和时间窗 SUM，成功率用 `sent / total` | 3 个小指标 + 成功率环形/进度条 | 同上，历史趋势需额外汇总表 |
| 通知 Key 活跃度 | `NotificationApiKey.lastUsedAt/enabled` | owner 子应用 JOIN key，取启用数和 `MAX(last_used_at)` | “接入健康度”卡/最后调用时间 | 只反映通知 API Key，不是 OIDC 登录活跃 |
| 通知模板授权数 | `notification_template_grants` | owner 子应用 JOIN grant 计数 | 集成详情/子应用表的辅助数字 | 这是“模板能力授权”，不是用户 OIDC consent |
| 安全验证操作 | `email_verification_challenges` | 按 `user_id` 聚合换邮箱/改密码验证的时间和成功状态 | 最近安全活动列表 | 注册 challenge 的 `user_id` 为 null；不宜与通用行为日志混用 |

`SubAppMeta` 只有 `visitNum` 和 `status`，见 [`src/entity/SubAppMeta.ts:17-53`](../../src/entity/SubAppMeta.ts#L17)。子应用自身有 owner 和创建/更新时间，见 [`src/entity/SubApp.ts:41-47`](../../src/entity/SubApp.ts#L41) 与 [`src/entity/SubApp.ts:85-89`](../../src/entity/SubApp.ts#L85)。

通知表已按 `app_id` 保存请求和投递聚合计数，见 [`src/entity/Notification.ts:27-34`](../../src/entity/Notification.ts#L27) 和 [`src/entity/Notification.ts:93-120`](../../src/entity/Notification.ts#L93)。但 cleanup 会在终态记录创建 7 天后删除，见 [`src/module/notification/cleanup.service.ts:50-98`](../../src/module/notification/cleanup.service.ts#L50)。通知 Key 已记录最后使用时间，见 [`src/entity/NotificationApiKey.ts:28-42`](../../src/entity/NotificationApiKey.ts#L28) 与更新逻辑 [`src/module/notification/api-key.service.ts:98-118`](../../src/module/notification/api-key.service.ts#L98)。

邮箱 challenge 保存 purpose、userId、创建、验证和消费时间，见 [`src/entity/EmailVerificationChallenge.ts:18-63`](../../src/entity/EmailVerificationChallenge.ts#L18)。

### C. 当前缺失，需要逐步补充

| 期望信息 | 缺失结论 | 建议采集点 | 推荐字段 / 聚合 |
|---|---|---|---|
| H 账号登录成功/失败次数 | 无结构化表；密码登录成功和失败只写 HLogger 字符串 | `UserService.login/issueSession`，外部登录完成处 | `user_id`、`method`、`outcome`、`occurred_at`、`source_hash`、`request_id` |
| 最后登录时间 | `users` 没有 `last_login_at` | 与登录成功事件同步更新快照 | User 快照 + 登录事件明细 |
| OIDC 子应用登录次数 | 新 OIDC 流程不更新 `visitNum`，当前无可靠事件 | 在唯一的“流程成功”边界写 `oidc_login_succeeded` | `user_id`、`app_id`、`scope_set`、`occurred_at`、`request_id`；按 app/owner/日聚合 |
| OIDC 授权同意/拒绝次数 | `finish()` 处理 approved/denied，但不落业务表 | `OAuthService.finish` 在交互结果确定后写 `oidc_consent_decided` | `user_id`、`app_id`、`approved`、`scopes`、`occurred_at`、`interaction_id_hash` |
| 子应用独立用户数/MAU | 无历史登录事件，无法去重 | 基于 OIDC 成功事件 | `COUNT(DISTINCT user_id)`，支持 7d/30d 窗口 |
| 个人行为日志/安全活动 | 已有日志没有统一 schema、查询 API、分页和权限边界 | 资料/邮箱/密码更改，身份绑定/解绑，子应用/密钥操作的成功与失败边界 | 见下方事件模型 |
| 登录地区/设备/异常风险 | 未保存 IP/UA 或风险结果 | 登录边界做最小化、受控采集 | 优先存 IP 的加密/带时限快照或 hash，明确保留期；不直接在前端暴露完整 IP |
| 当前设备/活跃会话与会话撤销 | H access/refresh token 是未持久化的 JWT，没有 session/device 实体 | 登录成功时创建可撤销 session，刷新时校验 session | `session_id`、`user_id`、`method`、`last_seen_at`、`expires_at`、`revoked_at`、设备摘要 |
| 长期趋势 | 通知明细七天后删除，登录/授权无历史数据 | 建立日粒度汇总表或时序指标仓 | `date`、`owner_id/app_id`、`metric`、`dimensions`、`value`；不存不必要个人明细 |

证据与关键限制：

- `User` 只有身份、邮箱验证和创建/更新时间，没有登录次数或最后登录字段。见 [`src/entity/User.ts:32-84`](../../src/entity/User.ts#L32)。
- 密码登录成功只写 `用户#id登录成功`，密码错误也只是 warn，见 [`src/module/user/user.service.ts:130-179`](../../src/module/user/user.service.ts#L130)。外部登录成功复用同一个 `issueSession()`，所以日志无法区分密码/GitHub/Google；外部流程的失败另写 warn，见 [`src/module/identity/external-identity.service.ts:94-167`](../../src/module/identity/external-identity.service.ts#L94)。
- 旧回调在 `SubAppService.callback()` 中累加 `visitNum`，见 [`src/module/subapp/subapp.service.ts:161-200`](../../src/module/subapp/subapp.service.ts#L161)。当前 OIDC 交互完成在 `OAuthService.finish()` 中只创建 Grant 并完成 provider interaction，没有更新 `SubAppMeta`，见 [`src/module/oauth/oauth.service.ts:235-289`](../../src/module/oauth/oauth.service.ts#L235)。
- OIDC adapter 把实体和 Grant 关联写入带 TTL 的 Redis key，见 [`src/module/oauth/redis-adapter.ts:13-54`](../../src/module/oauth/redis-adapter.ts#L13)；没有 user/app 统计读取接口。
- H 登录会话由 `issueSession()` 直接签发 2 小时 access JWT 和 14 天 refresh JWT，没有持久化 session，见 [`src/module/user/user.service.ts:149-177`](../../src/module/user/user.service.ts#L149)。因此当前无法可靠列出在线设备或单独撤销某次会话。
- 日志规范明确 HLogger 用于成功动作和异常行为记录，见 [`.trellis/spec/backend/logging-guidelines.md:21-30`](../../.trellis/spec/backend/logging-guidelines.md#L21)。现有子应用操作也确实以中文字符串写日志，见 [`src/module/subapp/subapp.service.ts:203-236`](../../src/module/subapp/subapp.service.ts#L203) 和 [`src/module/subapp/subapp.service.ts:242-347`](../../src/module/subapp/subapp.service.ts#L242)。这些可用于运维排查，但缺乏产品查询所需的结构化字段、索引、记录保留和授权规则。

## 建议的页面信息架构

### 第一屏：账号概览

1. **第一行 4 张 Statistic Card**
   - 子应用总数，副文案显示运行中/关闭数。
   - 30 天子应用登录次数，补数前显示“暂无统计”，不用 `0` 冒充。
   - 30 天授权次数，副文案显示同意率。
   - 30 天活跃用户数，或在尚未实现时改放“已绑定登录方式”。

   卡片可沿用用户给出的 Origin UI Vue statistic-card 风格，但数值应有 loading/skeleton、无数据和统计中三种状态。对登录/授权数必须标出时间窗口，不建议只放“累计”大数。

2. **账号安全卡**
   - 邮箱已验证/未验证。
   - 密码已设置/仅外部登录。
   - 已绑定 GitHub/Google 等 provider。
   - 最后登录时间和方式（待补数）。

   这些更适合状态列表/Badge，不宜做成大数指标。

### 第二屏：子应用使用概览

- **30 日趋势图**：登录成功、授权同意和授权拒绝三系列；数据稀疏时改为按周。
- **Top 子应用**：水平条形图或紧凑表格，展示应用名、登录数、独立用户数、同意率；子应用较少时不需要复杂图表。
- **通知服务**：如果该用户有使用通知能力，再显示 7 日请求、收件人数和投递成功率；无接入时隐藏整块，避免页面堆满 0。

### 第三屏：最近活动

使用时间线或分组列表，显示最近 10–20 条当前账号行为：登录、修改资料、换邮箱/密码、绑定/解绑身份、创建/编辑子应用、密钥变更。每条包含时间、结果、对象名称和可选的“查看详情”。安全类失败事件可用 warning/destructive 状态，不展示完整 IP、token、authorization code 或密钥。

## 建议补建的数据模型

可先用一张受控的 `user_activity_events` 承接账号行为和 OIDC 决策，再根据体量拆分。最小字段建议：

| 字段 | 用途 |
|---|---|
| `id` | 事件 ID，有序或 UUID |
| `actor_user_id` | 发起动作的 H 用户；匿名失败登录可为 null |
| `owner_user_id` | 指标归属的子应用 owner，用于开发者仪表盘查询 |
| `app_id` | 可选子应用 ID |
| `category` / `action` | 例如 `account/login_succeeded`、`oidc/consent_decided`、`subapp/updated` |
| `outcome` | `success`、`failure`、`approved`、`denied` 等稳定枚举 |
| `occurred_at` | 不可变业务发生时间 |
| `request_id` | 跨服务追踪，用于去重和排查 |
| `metadata` | 严格白名单 JSON，例如 login method、scope 集合、changed fields；禁止密码/token/code/secret |
| `source_hash` | 可选的来源 hash，支持异常检测但不直接暴露 IP |

建立 `(actor_user_id, occurred_at)`、`(owner_user_id, occurred_at)`、`(app_id, occurred_at)` 索引。事件明细定义明确保留期，长期仅保留日粒度聚合；这与现有日志规范中“不记录密码、JWT、OAuth code/token、完整密钥”的边界一致，见 [`.trellis/spec/backend/logging-guidelines.md:28-32`](../../.trellis/spec/backend/logging-guidelines.md#L28)。

## 建议的 API 边界

不建议基本信息页分别拉全量子应用、通知和日志后在浏览器聚合。建议增加一个当前用户限定的概览 API，例如：

```text
GET /v1/user/me/overview?window=30d
```

返回可拆成：

```json
{
  "account": {
    "emailVerified": true,
    "hasPassword": true,
    "linkedIdentityCount": 2,
    "lastLoginAt": null,
    "lastLoginMethod": null
  },
  "apps": {
    "total": 3,
    "running": 2,
    "closed": 1,
    "banned": 0
  },
  "oidc": {
    "loginSuccesses": null,
    "authorizationApproved": null,
    "authorizationDenied": null,
    "activeUsers": null
  },
  "notifications": {
    "windowDays": 7,
    "requests": 12,
    "recipients": 18,
    "sent": 17,
    "failed": 1
  }
}
```

尚未采集的指标返回 `null` 而非 `0`，便于前端区分“确实没有发生”和“尚未具备统计能力”。行为明细单独用分页 API，例如 `GET /v1/user/me/activity?page=1&size=20&category=...`，不与概览聚合响应混在一起。

## 分期建议

### P0：只用现有数据，快速变丰富

- 在当前四个 facts 基础上增加邮箱验证、密码状态、已绑定登录方式。
- 增加子应用总数 Statistic Card，必要时用现有 `/app/my` 的 `count`。
- 可增加运行/关闭/封禁分布，但优先由后端 summary API 聚合。
- 暂不显示“登录次数”和“授权次数”，也不用旧 `visitNum` 伪装。

### P1：补齐核心身份事件

- 建立结构化事件表/事件写入服务。
- 先覆盖账号登录成功/失败、OIDC 授权同意/拒绝、OIDC 成功流程。
- 提供 overview 和 activity 接口，上线 30 日登录、授权、独立用户与最近活动。

### P2：趋势和运营质量

- 每日汇总子应用登录、授权、独立用户和通知投递，支持 30/90 日趋势。
- 增加 Top 子应用、授权率、失败率和通知成功率。
- 根据隐私和安全需求再决定是否加入设备/地区/异常风险，这些不应成为第一期指标。

## 需要产品确认的两个决策

1. **“子应用登录成功”的计数点**：建议用 token endpoint 成功而不是用户点击“同意”，因为后者之后仍可能中断；但这需要在 oidc-provider 的稳定事件/中间件边界实现。
2. **页面是账号概览还是开发者概览**：如果并非每个用户都有子应用权限，应对无权限/无子应用用户隐藏开发者指标区，而不是展示一排 0。
