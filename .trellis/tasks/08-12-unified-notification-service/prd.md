# H 内置轻量化消息通知服务

## Goal

在 H 进程内提供轻量、统一的事务消息能力，让 H 与已登记子应用复用安全的收件人解析、模板、渠道配置、异步投递和状态查询；管理员在 Safe House 中维护单实例 SMTP、消息模板及应用通知权限。首期只实现 Email，同时保留真实的渠道适配器 seam，不重新引入独立通知中台的部署与跨服务复杂度。

## Background

- H 是 NestJS 10 + TypeORM + MySQL 服务，已有 Redis、全局用户 JWT 权限、子应用模型、可轮换 secret、数据库迁移和 AES-256-GCM 信封加密模式。
- H 用户具有唯一 Email；按 H `userId` 发送时使用受理时读取的当前 Email。邮箱验证状态不在本任务内扩展。
- Safe House 是 Vue 3 + Composition API + TypeScript 管理端，已有登录供应商配置界面，可复用权限控制、密码留空不修改、secret hint 和保存刷新交互。
- 2026-08-10 的独立通知服务、OAuth Client Credentials、独立 Worker/数据库和完整模板发布体系已因实现与运维成本过高而放弃；本任务不恢复该架构。

## Requirements

### 1. Module and channel seam

- 通知能力作为 H 内部独立 NestJS module 实现；H 通过一个 application interface 调用，子应用通过版本化 HTTP interface 调用，二者进入同一受理用例。
- 核心用例只依赖 `ChannelAdapter` interface；首期提供 SMTP Email adapter 和测试 adapter。Adapter registry 按 `channelType` 解析实现，业务调用方不接触 SMTP 类型。
- 首期只有一个平台级 SMTP 实例，请求方不能选择实例、覆盖 `From` 或取得渠道凭据。
- SMTP host、port、TLS 模式、username、加密 password、默认发件人名称/地址、启停状态保存在数据库，而不是 SMTP 环境变量。
- SMTP password 认证加密后入库；管理读取只返回 `configured` 与 hint。环境仍持有通知专用主加密密钥和版本，用于解密数据库密文。

### 2. Safe House administration

- 在现有管理页增加“通信渠道”“消息模板”“应用通知权限”三个区域，均受独立管理员权限保护。
- SMTP 表单支持启停、host、port、TLS 模式、username、password、默认发件人名称/地址；password 不回显，留空表示不修改。启用前必须通过前后端必填与格式校验。
- 模板界面支持列表、创建、编辑、启停；字段包含不可变稳定 key、名称、Email subject、纯文本正文、可选 HTML 正文和允许变量定义。
- 模板保存校验 key 唯一、语法、未知变量和必填内容；不提供草稿、审批、版本历史、多语言或回滚。
- 管理员按子应用配置模板白名单、`directContent` 和 `manualRecipient` 能力；普通子应用所有者不能扩大这些能力。
- 首期不要求 SMTP 测试连接/测试邮件按钮。

### 3. Notification API Key

- 子应用所有者可在现有子应用管理区域创建、查看脱敏列表、启停/轮换和吊销通知专用 API Key；明文只在创建响应中出现一次。
- 通知 Key 与子应用绑定，不复用用户 JWT 或 OIDC client secret；只保存不可逆校验摘要、hint、状态和审计元数据，日志不得记录完整 Key。
- Key 只承担调用方身份。它实时继承应用通知策略，不复制权限；管理员收紧策略后，该应用所有现有 Key 立即受限。
- 外部状态查询只能读取所属应用创建的通知。

### 4. Recipient targeting and limits

- recipient 支持 H `userId` 和手动 Email 两类；一次请求可以混合，规范化后去重。
- `userId` 在受理时解析为用户当前 Email；用户不存在、无可用 Email 或地址非法时，请求整体拒绝且不创建部分任务。
- 默认应用只能使用 H 用户目标；只有管理员授予 `manualRecipient` 后才能提交任意合法手动 Email。首期不强制域名白名单。
- 单请求最多 20 个唯一收件人。每个收件人形成独立 delivery，邮件 `To` 只包含本人；单个地址独立发送、重试和失败，不泄露其他地址。
- 使用现有 Redis 实施可集中调整的应用请求/收件人速率限制；首期默认 60 请求/分钟且 200 收件人/分钟。H 内部调用具有独立调用方标识和限制策略。

### 5. Controlled hybrid content

- 请求必须且只能选择一种内容类型：
  - `template`：`templateKey + variables`；应用只能调用其白名单中的启用模板。
  - `content`：`subject + text + optional html`；外部应用必须拥有 `directContent` 能力。
- 两类请求使用可判别且互斥的 DTO；混传、缺少必填字段、未知/缺失变量、停用模板和越权模板均返回稳定错误。
- H 进程内调用可使用两种内容类型，无需 API Key，但必须通过同一目标、内容安全和渠道能力校验。
- 模板采用受限变量插值，不执行任意代码、helper、条件或循环。HTML 插值进行上下文安全转义，HTML 内容经过服务端清理；Safe House 不直接用 `v-html` 呈现未清理内容。
- Email 必须包含 subject 与纯文本正文，可选 HTML；有 HTML 时 SMTP 发送 `multipart/alternative`。
- 任务入队前完成模板解析和渲染并保存内容快照；编辑模板不改变已受理任务。

### 6. Durable asynchronous delivery

- 受理请求在鉴权、策略、限流、目标和内容全部校验，并将 notification、内容快照及全部 deliveries 可靠落库后返回 notification ID，不等待 SMTP。
- H 进程内后台投递器轮询任务；不部署独立 Worker，不引入新消息中间件。
- notification 汇总 `pending | processing | sent | partial_failed | failed`；delivery 使用 `pending | processing | sent | failed`。查询返回汇总、成功/失败数量和脱敏错误类别。
- MySQL 5.7 兼容的原子 compare-and-set lease 防止多个 H 实例同时领取同一 delivery；租约过期后可恢复。
- SMTP 临时故障有限次数指数退避；明确永久错误直接失败。首期最多 5 次尝试，最长不超过 24 小时。
- 投递采用至少一次语义；SMTP 结果未知窗口允许极低概率重复。`sent` 只表示 SMTP 服务端接受，不承诺进入收件箱。
- 子应用可选提供 `idempotencyKey`。7 天内同 `appId + key` 且请求摘要相同返回原 notification ID；同键不同请求冲突。不提供时每次调用均创建新任务，调用方接受重试重复风险。

### 7. Security, retention and observability

- SMTP password、delivery 收件地址及 notification 的 subject/text/html 快照使用通知专用 AES-256-GCM 认证加密，AAD 绑定记录用途与稳定 ID，并保存 key version。
- `sent`/`failed` delivery 及终态 notification 在 24 小时后清除加密地址与正文载荷；脱敏状态、错误分类和幂等摘要保留 7 天后删除。H 定时清理任务执行该策略。
- 日志使用 notificationId、deliveryId、appId、channelType、attempt 和脱敏错误类别关联；不得记录完整地址、API Key、SMTP password、变量或正文。
- 管理变更、Key 生命周期及应用策略变更记录实际操作者和时间。
- SMTP 禁用或未完整配置时仍可保存草稿配置，但发送请求明确失败且不入队；已经入队但投递时渠道被禁用的任务保留并重试，重新启用后恢复，超过 24 小时则失败。

## Acceptance Criteria

- [ ] H 内部调用和持有有效通知 Key 的子应用通过同一 application interface 受理 Email，并快速返回 notification ID。
- [ ] 错误、停用或吊销 Key 被拒绝；Key 明文不持久化、不回显且不进入日志。
- [ ] 所有者能管理 Key 但不能扩大应用能力；管理员收紧模板白名单、`directContent` 或 `manualRecipient` 后旧 Key 立即受限。
- [ ] H userId 与获准手动 Email 可混合解析、去重且总数不超过 20；任一无效目标导致请求整体拒绝。
- [ ] 每个收件人独立投递，`To` 不泄露其他地址；部分失败正确汇总为 `partial_failed`。
- [ ] 模板与直接内容 DTO 严格互斥；模板授权、变量、HTML 清理、纯文本和 multipart/alternative 行为均有自动化测试。
- [ ] Safe House 可配置/启停 SMTP；刷新后非敏感字段回显，password 仅显示 configured/hint，留空保存不覆盖旧值。
- [ ] Safe House 可创建、编辑和启停模板；key 冲突、未知变量与语法错误不能保存，已排队内容不随模板修改。
- [ ] Safe House 管理员可维护应用模板白名单与高风险能力；无相应权限者无法查看或修改管理数据。
- [ ] 可选幂等键在 7 天内对同应用同请求返回原任务，同键不同请求冲突；不传时可重复创建。
- [ ] 临时 SMTP 错误最多重试 5 次，永久错误直接失败；H 重启和多实例竞争不会丢失或同时领取同一 delivery，租约可恢复。
- [ ] 收件地址、正文和 SMTP password 以认证密文存储；终态 24 小时后载荷不可恢复，7 天后任务元数据删除。
- [ ] 外部调用方只能查询本应用通知；响应和日志不包含完整地址、正文、变量或渠道凭据。
- [ ] H 的 lint/build/test 与 Safe House 的 type-check/lint/build 通过；Safe House 完成聚焦的权限、表单和响应式手工验收。

## Out of Scope

- 独立通知服务、独立仓库、独立 Worker 集群或新消息中间件。
- Email 之外的生产 adapter；多个 SMTP 实例、应用选择实例和渠道故障转移。
- 用户自定义渠道、通知偏好、域名白名单和管理 UI。
- 模板草稿/审批/版本历史/多语言/回滚、富文本可视化编辑器和邮件预览渲染。
- SMTP 测试连接/测试邮件按钮、投递 webhook、通知取消、定时发送。
- 营销活动、退订、附件、抄送/密送和超过 20 人的批量发送。
- 邮箱所有权验证模型改造。

## Deferred Items and Risks

- SMTP 在网络超时后可能已接受邮件，至少一次语义无法完全消除极低概率重复。
- 进程内轮询适合当前轻量规模；队列持续积压、吞吐超过单 H 集群可承受范围时，再以现有 application interface 为 seam 提取独立投递进程。
- HTML 清理会移除不安全或不支持的标签/属性；首期不承诺完整邮件客户端 CSS 兼容性。
- 模板 key 创建后不可修改；重命名以新建模板并迁移应用授权完成。

## Delivery Streams

1. **H backend（前置）**：数据模型/迁移、配置与模板管理、应用策略与通知 Key、受理 interface、加密队列、投递器、SMTP adapter、查询与清理。
2. **Safe House frontend（依赖 H 管理契约稳定）**：SMTP 配置、模板管理、应用通知策略，以及子应用所有者的通知 Key 管理。
3. **Cross-repository verification（依赖前两项）**：权限、secret 不回显、模板/直接内容、多人部分失败、幂等、重试恢复和数据清理的联调验收。
