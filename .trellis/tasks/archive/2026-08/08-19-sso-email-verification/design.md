# SSO 邮箱认证技术设计

## 1. 范围与依赖

本任务跨越 H 后端与 Safe House 前端。H 是邮箱挑战、验证事实和账号变更的唯一可信来源；Safe House 只编排用户输入与展示状态；统一通知服务只负责投递邮件，不参与 OTP 校验。

复用 `08-10-notification-auth-contact` 的 `User.email_verified_at`、`User.email_verification_source` 与 `EmailVerificationChallenge` 设计。若这些数据库变更尚未落地，本任务实现该子集；不得再创建平行的验证码表或状态机。同步远端后，统一通知服务已位于同一 Nest 应用；邮箱认证通过 `NotificationModule` 导出的 `NOTIFICATION_APPLICATION` 端口投递，不经 H 自身的鉴权 HTTP API 回环。投递服务本身不纳入范围。

## 2. 数据与安全模型

### User

- `email_verified_at datetime nullable`
- `email_verification_source varchar(32) nullable`，本任务使用 `legacy_migration`、`email_otp`
- 迁移时将已有用户按同一迁移时点标记为 `legacy_migration`，保持既有登录兼容。
- OIDC `email_verified` 必须由 `email_verified_at != null` 派生，不再硬编码。

### EmailVerificationChallenge

挑战至少保存：UUID、`purpose`、可空 `user_id`、规范化目标邮箱、OTP 摘要、过期时间、失败次数上限/当前值、可重发时间、验证时间、消费时间、创建时间以及可选通知 ID。

`purpose` 包含 `register`、`change_email`、`change_password`。注册挑战未登录并绑定目标邮箱；换绑挑战绑定 userId 与目标新邮箱；改密挑战绑定 userId 与发起时的当前已验证邮箱。

OTP 使用密码学安全随机数生成，默认 6 位、10 分钟有效、最多 5 次失败、60 秒重发冷却，参数从配置读取并设安全边界。数据库只保存带服务端 pepper 的摘要；OTP、证明、密码和完整邮箱不得进入日志。挑战验证与消费使用事务锁或条件更新，保证并发下最多一次成功。

邮箱在服务边界统一执行 `trim + lowercase`，挑战、唯一性检查与用户写入使用同一规范化值。响应对可枚举状态采用统一受理语义；最终注册/换绑仍在事务中依靠唯一约束裁决竞争。

## 3. API 契约

### 挑战

- `POST /user/email-verification/challenges` 接收 `{ purpose, email? }`，返回 `{ challengeId, expiresAt, resendAt }`。`register` 必须提供 email 且允许匿名；其余 purpose 必须登录。`change_password` 忽略客户端邮箱并使用数据库当前邮箱。
- `POST /user/email-verification/challenges/:id/verify` 接收 `{ code }`，返回短期一次性 `verificationProof`。证明绑定 challenge、purpose、userId 与邮箱，不包含 OTP。

证明使用原子 Redis 一次性状态或数据库中的随机证明摘要实现；不得使用可伪造的裸 challengeId。消费时重新校验 purpose、主体、邮箱、期限和未消费状态。

### 注册

`POST /user/register` 增加 `verificationProof`。创建用户与消费注册证明在同一事务完成；证明邮箱必须等于请求规范化邮箱，写入 `email_verified_at` 和 `email_otp` 来源。

### 邮箱换绑

新增受登录保护的专用换绑命令，接收 `verificationProof`。服务在同一事务中锁定证明和用户、检查新邮箱唯一性、写主邮箱与验证字段并消费证明，随后刷新 `user-<id>` 缓存。通用 `PUT /user/:id` 从可编辑字段中移除 `email`。

### 密码修改/首次设置

现有密码账号提交 `oldVal`、`newVal` 与 `verificationProof`；无密码账号提交 `newVal` 与证明，服务仅在数据库确认当前密码为空时允许省略 `oldVal`。证明必须属于 `change_password`、当前 userId 和发起时的当前主邮箱。密码写入与证明消费在同一事务完成。

保留当前 Safe House 先 MD5、H 再 bcrypt 的兼容协议，本任务不扩大到密码传输协议迁移；实现时修正 controller 计算了 `newData` 却传入原 `updateData` 的现存缺陷。

## 4. 前端组件与数据流

- 注册页仍作为组合层；邮箱、发送/重发、OTP、昵称和密码状态由 `useUserRegister` 编排。
- 新建可复用的邮箱验证码输入组件，只负责倒计时、验证码输入和 typed emits，不直接调用 API。
- 个人资料编辑不再直接提交 email；邮箱展示旁提供独立换绑入口，由换绑 modal + composable 完成流程。
- 新增密码修改/首次设置 modal；后端增加非敏感布尔值 `hasPassword` 控制旧密码字段，不暴露密码。
- API 类型集中在 `src/types/user.ts`，请求工厂放在 `src/api/user.ts`，请求状态和副作用放在 `src/composables/`；跨视图资料通过 Pinia action 更新。

数据流：Safe House 表单 → H challenge API → 通知服务投递 → 用户输入 OTP → H verify API 返回一次性证明 → 对应账号 mutation 原子消费证明 → 更新缓存/前端用户状态。

## 5. Token、OIDC 与兼容性

- 换绑后，缓存和后续登录、refresh、OIDC 签发读取最新邮箱与真实 `email_verified`。
- 按产品决定，不增加 token version，不撤销旧 access/refresh token，不强制其他设备登出；旧 token 中的历史邮箱保留到自然过期。
- 外部身份邮箱仍是 provider profile 元数据，不随主邮箱换绑修改；外部身份登录/绑定约束保持不变。
- 忘记密码与匿名密码重置不在本次 API 中。

## 6. 错误、日志与限流

DTO 在边界校验 purpose、邮箱、UUID、OTP 和密码字段。可预期失败使用稳定业务错误；不回显 OTP、proof、密码、数据库错误或邮箱全值。日志只记录 userId、challengeId、purpose 和结果类别。

挑战创建与验证至少按目标摘要/userId、purpose 和来源 IP 做限频；通知发送失败不能把挑战标记为已验证。重发生成新挑战并使旧挑战失效，网络重试使用同一幂等键。

## 7. 回滚与发布

- 先部署兼容读取新字段的后端，再部署 Safe House；前端切换后才移除直接改邮箱能力。
- 数据库迁移使用项目现有安全 migration runner；应用回滚时优先保留新增验证字段和挑战表。
- 通知服务不可用时返回稳定暂时性错误，不允许绕过验证。
- 回滚前端可恢复旧 UI，但后端不得恢复无需验证的邮箱写入路径。
