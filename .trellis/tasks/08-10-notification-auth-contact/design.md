# H 通知认证与联系信息设计

## 1. 数据模型

### User 扩展

- `email_verified_at datetime nullable`
- `email_verification_source varchar(32) nullable`，首批值：`legacy_migration`、`email_otp`

OIDC `email_verified = email_verified_at != null`。迁移用同一固定迁移时点回填已有用户，并标记 `legacy_migration`；回滚代码时保留新增列，避免丢失后来产生的验证事实。

### 子应用资源授权

新增规范化授权表，建议每行表达一个 `(app_id, resource, scope)`，并建立唯一约束。只允许 confidential 子应用配置机器授权。OAuth Provider 的重载指纹必须包含排序后的授权行。

资源配置由代码定义，数据库只存 grant：

- `notification-api` → audience、5 分钟 TTL、允许 `notifications:send/read`
- `h-internal` → audience、5 分钟 TTL、允许 `users:contact:read`
- `notification-admin` → 管理员用户 token audience 与通知管理 scopes

### EmailVerificationChallenge

挑战记录至少包含：UUID、purpose (`register|change_email`)、可空 userId、规范化目标 Email、code hash、过期时间、最大/当前失败次数、重发允许时间、verifiedAt、consumedAt、createdAt。OTP 明文永不入库或日志。

- 注册：验证挑战后签发短期、一次性的注册证明；创建用户与消费证明在同一事务完成。
- 改邮箱：挑战绑定当前 userId；成功后在同一事务检查地址唯一性、替换主邮箱、写验证时间/来源并消费挑战。
- 并发确认通过悲观锁或条件更新保证只有一次消费成功。

## 2. OAuth Provider 改动

- 保持现有 Authorization Code + PKCE 行为。
- 对获准 confidential client 增加 `client_credentials` grant；启用 Resource Indicators。
- `getResourceServerInfo` 根据固定资源目录返回 JWT access token 配置，并把请求 scope 与应用授权表求交集。
- 管理员 Authorization Code 请求的通知资源 scope 还要与用户实际权限求交集。
- Discovery 从 Provider 实际能力生成或至少与配置同源，避免手写声明漂移。
- 用固定版本 `oidc-provider@9.8.2` 做黑盒集成测试，验证 resource、audience、scope、token TTL 和错误分支。

## 3. Contact API

`GET /internal/v1/users/:id/notification-contacts/email`

守卫顺序：JWT 签名/issuer/expiry → `aud=h-internal` → `users:contact:read` → client 白名单。只查询 `id,email,email_verified_at`。

- 已验证：返回地址与 `verifiedAt`。
- 用户不存在或未验证：统一 `404 notification_contact_unavailable`。
- 不把邮箱写进访问日志；审计只记录调用 `client_id`、userId、结果类别与 traceId。

## 4. H 自身验证码流程

H 通过通知服务发送时使用 `templateKey=account.email.verify`、直接地址 recipient 和 challenge UUID 幂等键。重发若要生成新验证码，必须先让旧挑战失效并使用新的 challenge/幂等键；同一挑战的网络重试始终复用同一码。

通知 API 返回 `202` 后，H 只记录 notificationId 供排障，不把“邮件已发送”当作验证成功。用户提交 OTP 时只访问 H；通知服务不参与验证。

## 5. 安全与兼容

- Client secret 仍使用现有加密/轮换能力；新增 grant 不复制 secret。
- 管理 API 不允许子应用自行授予 resource/scope，必须由 H 管理权限保护。
- 历史用户 grandfather 是兼容策略，审计来源必须明确，不能伪装成 OTP 实证。
- 修改 Email 的现有通用 update API 必须移除直接写 Email 能力或改为启动 challenge，避免绕过新状态机。
- 现有用户导出/登录接口的兼容性单独回归；本任务不借机扩大公开用户资料接口。
