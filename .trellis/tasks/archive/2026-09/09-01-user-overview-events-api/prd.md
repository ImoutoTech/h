# 用户概览事件与接口

## Goal

为用户基本信息概览提供可信的账号安全快照、子应用状态、近 30 天 OIDC 登录/授权指标和最近活动，建立可查询、可去重、默认保留 90 天且不泄露 bearer/secret 的结构化事件基础。

## Dependency

- 本子任务是 `09-01-user-basic-info-overview` 的第一个实施子任务。
- 接口契约和安全投影完成后，`09-01-user-basic-info-ui` 才能开始接入。

## Requirements

### E1. Event Model

- 新增 `user_activity_events` 表与 TypeORM entity。
- 事件至少包含：事件 ID、actor user id、owner user id、app id、category、action、outcome、白名单 metadata、可选 dedupe key、发生时间。
- actor 用于个人时间线；owner/app 用于子应用聚合。子应用删除后，已有事件仍能安全显示对象快照。
- 协议事件支持幂等写入；重复 dedupe key 不产生第二条记录。

### E2. Event Taxonomy

- 账号：密码登录成功、已知账号密码登录失败、资料更新、邮箱变更、密码变更。
- 外部身份：GitHub/Google 登录成功、身份绑定、身份解绑。
- OIDC：授权同意、授权拒绝、Authorization Code 成功兑换 token。
- 子应用：创建、更新、状态变更、删除、Client Secret 创建/启停/删除。
- 未知邮箱的匿名登录失败可记录 actor 为空，但不得通过个人 activity 暴露。

### E3. OIDC Semantics

- `OAuthService.finish()` 在 interaction 成功完成且 continuation URL 校验通过后记录 consent decision。
- `oidc-provider@9.8.2` 的 `grant.success` 仅在 `grant_type=authorization_code` 且 AuthorizationCode entity 存在时记录 login success。
- login 去重键基于 AuthorizationCode `jti` 的单向摘要；不得保存或记录原始 authorization code。
- 同意后没有兑换 code 不计登录；code 重放不重复；拒绝不计登录或 approved。

### E4. Current-user APIs

- `GET /user/me/overview` 返回账号快照和权限限定的子应用/OIDC 聚合，固定窗口 30 天。
- 没有“查看子应用”权限时 `apps=null`；有权限但无子应用时返回真实零值。
- `GET /user/me/activity?page=1&size=20&category=` 只返回 actor 为当前用户的事件，按时间倒序分页。
- activity 响应由服务器把内部 metadata 转为安全、稳定的 summary/detail/target 投影；不返回原始 metadata。
- page/size/category 有运行时校验，size 有合理上限。

### E5. Retention and Failure Behavior

- 原始事件保留天数由配置控制，默认 90 天；定时清理按 occurred_at 删除过期记录。
- 事件写入失败不得把已成功的登录、授权、资料或子应用操作改为失败；记录不含敏感内容的 warn 并允许后续请求继续。
- 统计从上线后开始，不从 HLogger、Redis 或 `visitNum` 回填。

### E6. Security

- 当前用户接口必须要求有效 user access token，不接受任意 user id。
- 子应用聚合遵守 ADMIN 或现有“查看子应用”权限规则。
- metadata writer 使用类型化命令/白名单字段，禁止调用者传入任意对象。
- 禁止保存/返回/记录密码、密码哈希、JWT、OAuth code/token、完整密钥、原始 Redis payload 和完整 IP。

## Acceptance Criteria

- [ ] migration up/down、entity metadata 和模块注册均可加载。
- [ ] overview 对有/无子应用权限、无子应用和有事件数据返回正确区分的结果。
- [ ] activity 仅返回当前 actor 的安全投影，并支持倒序分页与 category 过滤。
- [ ] consent approved/denied 和 token exchange 登录事件口径有自动化测试；未兑换、拒绝、重放不误计。
- [ ] 重复 dedupe key 只保留一条协议事件。
- [ ] 已知账号登录失败、登录成功和主要账号/身份/子应用变更产生预期事件。
- [ ] 默认 90 天清理和配置覆盖有测试，事件写入失败不改变主业务成功结果。
- [ ] 响应、HLogger 和测试快照中不含禁止字段或原始敏感值。
- [ ] backend 非变更 lint、Nest build、Vitest 和 migration metadata load 通过。

## Out of Scope

- 日汇总表、90 天趋势和 MAU/独立用户。
- 通知投递指标。
- 设备、地理位置、完整 IP、风险评分和会话管理。
- 历史数据回填和面向管理员的全局审计搜索。

## Key Decisions

- 登录数以成功 Authorization Code token exchange 计数。
- 原始事件默认保留 90 天；overview 固定近 30 天。
- 协议采集失败不阻断身份协议主流程，使用幂等写入和安全告警降低漏计/重复风险。
