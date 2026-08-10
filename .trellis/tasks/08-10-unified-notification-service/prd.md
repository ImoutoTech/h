# 统一通知服务

## Goal

为多个子系统提供独立部署的统一通知服务。首版通过平台默认 Email 发送邮箱验证码、博客回复/评论等事务通知；业务系统不再各自维护 SMTP、模板、重试和投递状态，同时为未来用户自定义渠道保留稳定扩展边界。

## Users and Ownership

- 业务子系统：提交语义化通知意图，拥有自身业务状态；不提交任意渲染正文，不持有平台 SMTP 凭据。
- 通知管理员：通过管理 API 维护、发布和授权消息模板，查看脱敏投递状态；首版不提供管理 UI。
- 最终用户：首版只接收平台默认 Email；未来可配置平台预置的渠道类型，不能上传适配器代码。
- H：统一身份、子应用机器授权及用户已验证主 Email 的权威来源。
- 通知服务：模板、通知受理、投递任务、重试和渠道调用的权威来源。

## Functional Requirements

### Cross-system invocation

- 所有调用必须使用 H 签发的短期、用途受限 token；业务系统不把长期 client secret 发送给通知服务。
- 调用方提交模板 key、recipient、模板变量、幂等键及可选 locale/过期时间。
- recipient 支持统一 H userId，以及只对获准事务模板开放的直接 Email 地址；禁止跨系统使用子系统本地用户 ID。
- userId 收件人在受理前解析为 H 中已验证的当前主 Email，并为本次通知固定快照。
- 成功响应采用异步受理语义：只表示通知已可靠排队，不表示已发送或最终到达。
- 提供按 notificationId 的脱敏状态查询；业务调用方只能读取本应用创建的记录。

### Templates and content

- 管理员能通过 API 创建草稿、编辑、发布不可变版本、启停模板并授权给指定子应用。
- 模板发布版本包含变量 schema、默认 locale、投递期限、subject、必需的纯文本内容及可选 HTML 内容。
- 模板变量在受理与发布阶段校验；敏感变量不得进入日志和普通审计。
- 模板能力限制为安全插值和有限条件/循环，禁止任意代码、运行时 helper 与未转义 HTML 注入。
- Email 有 HTML 时同时发送纯文本和 HTML；没有 HTML 时发送纯文本。纯文本渠道只消费纯文本，运行时不自动把 HTML 转为纯文本。
- 首版只要求默认语言内容；请求 locale 缺失时回退到模板默认语言并可观测。

### Reliability and delivery

- 受理过程必须严格幂等：同应用/同键/同请求返回原通知，同键不同请求明确冲突。
- 通知与投递任务可靠持久化后才能返回成功；投递故障不占用业务请求的 SMTP 等待时间。
- Worker 支持并行领取、崩溃恢复、延迟重试、投递期限和过期终止。
- 投递采用至少一次语义；外部渠道结果未知时允许极低概率重复，以避免静默丢失。
- `sent` 只表示 SMTP 服务端接受，不承诺最终进入收件箱。
- 通知服务负责 app/template/recipient 配额、SMTP 并发及异常积压保护；验证码的生成、校验、期限、尝试次数和业务重发冷却归调用业务。

### Security, privacy and administration

- 模板管理、发布、应用授权和投递读取使用相互分离的管理员权限，并记录真实管理员审计。
- 平台 SMTP 与加密密钥只由部署 secret 提供，不能通过数据库/API/日志回显。
- 收件地址、模板变量和渲染内容应用层认证加密，并支持密钥版本轮换。
- 终态敏感载荷最多保留 24 小时；非内容投递元数据保留 30 天；Email、错误和审计均按最小披露脱敏。
- H 的 OIDC `email_verified` 与 Contact API 必须来源于真实验证状态，不得硬编码。
- 现有 H 用户在迁移时按当前 Email 兼容为已验证并记录迁移来源；新注册与改 Email 必须先完成 OTP 验证，验证前不替换主 Email。

## Deployment and Compatibility Constraints

- 通知服务建立独立仓库，不作为 H 的进程内模块，也不共享 H 的 TypeScript 源码。
- 通知 API 与 Worker 位于同一通知仓库/镜像，以两个常驻进程运行并可独立扩缩容。
- 首版技术栈为 TypeScript、NestJS、TypeORM 和独立 MySQL 8.4 LTS。
- 现有业务继续使用 MySQL 5.7.44；其升级是独立项目，不是通知服务前置条件。
- 首版使用 MySQL 同时保存状态和可靠工作队列，不引入 Redis、Kafka、RabbitMQ。
- 首版默认渠道为通用 TLS SMTP，并通过 ChannelAdapter 边界调用。

## Acceptance Criteria

- [ ] 形成并验证 H 与通知服务间的版本化 HTTP/OpenAPI、JWT audience/scope 和错误契约。
- [ ] 验证码流程中业务系统拥有挑战状态，通知服务只发送；重试不会生成新验证码。
- [ ] 博客评论流程中统一 userId 在 `202` 前解析并固定已验证 Email，业务请求不等待 SMTP。
- [ ] 管理员可维护、发布和授权同时支持纯文本/HTML 的不可变模板版本，无需修改业务调用代码。
- [ ] 默认 Email 能发送纯文本及 multipart alternative，内容选择规则确定且可测试。
- [ ] 幂等、限流、并发 Worker、崩溃恢复、重试、过期和状态隔离通过自动化测试。
- [ ] JWT 越权、模板跨应用越权、直接地址滥用、模板注入和日志泄密均被阻止并测试。
- [ ] H 的历史用户迁移、新注册/改 Email 验证、OIDC claim 与 Contact API 使用同一验证事实。
- [ ] API 与 Worker 可独立常驻部署，试点应用可灰度接入且具备停止受理、排空队列和模板回退方案。
- [ ] 架构保留未来新增渠道适配器、用户渠道实例和偏好路由的扩展边界，不要求首版实现。

## MVP Out of Scope

- 管理 UI、用户渠道配置 UI。
- 用户自定义渠道实例、通知偏好、通知分类策略、多渠道 fan-out/fallback。
- Email 外的实际渠道、供应商专用 Email API。
- 附件、抄送/密送、批量收件人、定时发送、营销邮件与退订。
- 投递结果 webhook、通知取消、运行时 HTML 转纯文本。
- 现有业务 MySQL 5.7.44 的统一升级。

## Task Map

1. `08-10-notification-auth-contact`：H 的机器/管理员 token、真实 Email 验证状态与 Contact API。
2. 外部仓库 `/Users/reuszeng/Code/Projects/notification-service` 的 `08-10-notification-service-mvp`：通知 API、模板、MySQL 队列、Worker 和 SMTP adapter；实施状态以该仓库 Trellis 任务为准。
3. 父任务：冻结跨仓库契约并完成两条端到端集成验收，不直接承载实现代码。

## Open Questions

无阻塞性产品问题。实施前仍需在固定依赖版本和目标部署环境中验证 OIDC Client Credentials/Resource Indicators、MySQL 8.4 并发领取和 SMTP 行为。
