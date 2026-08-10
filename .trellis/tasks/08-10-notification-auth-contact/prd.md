# H 通知认证与联系信息接口

## Goal

让 H 成为通知系统可信的身份和已验证 Email 来源：为业务子应用、通知服务和管理员签发用途受限的短期 token，并提供只读的内部通知联系信息接口。

## Requirements

- confidential 子应用可使用现有可轮换 client secret 申请 Client Credentials token；public 子应用不得使用该授权类型。
- H 按子应用维护 resource/scope 白名单，申请 token 不能越过白名单。
- 至少支持 `notification-api`、`h-internal`、`notification-admin` 三个 audience 的用途隔离。
- 机器 token 必须可由资源服务通过 H JWKS 离线验证，并携带标准 `client_id` 和最小 scope。
- 管理员仍经 Authorization Code + PKCE 登录，通知管理权限按 H 的实际角色/权限签发到独立管理 audience。
- H 记录真实邮箱验证时间与来源；OIDC `email_verified` 不得再硬编码。
- 现有用户在迁移时按当前邮箱兼容为已验证，并记录迁移来源和时间。
- 新注册与更换 Email 必须先完成 OTP 验证；待验证地址不能提前替换当前主邮箱。
- H 拥有其账号场景的验证码生成、摘要、期限、失败次数、重发冷却、验证和一次性消费状态；通知服务只负责发送。
- Contact API 只向 notification-service 的机器身份返回指定统一 userId 的已验证当前主邮箱。
- 用户不存在和没有可用已验证 Email 使用相同的稳定不可用错误；暂时性内部错误明确为 5xx。
- 所有认证、挑战验证与联系信息访问遵循现有日志脱敏和统一业务错误规范。

## Acceptance Criteria

- [ ] 获准的 confidential 应用能取得 `aud=notification-api`、短 TTL、正确 `client_id/scope` 的 JWT。
- [ ] public 应用、错误 secret、未授权 resource 或越权 scope 均被拒绝并有测试覆盖。
- [ ] notification-service 能取得 `aud=h-internal` 且仅含 `users:contact:read` 的服务 token。
- [ ] 管理员 token 只能包含其 H 权限允许的通知管理 scopes。
- [ ] JWKS 当前/上一把公钥轮换期间的签名验证可用，Discovery 准确声明新增授权能力。
- [ ] 迁移后所有现有用户有可审计的 legacy 验证来源，OIDC claim 来自数据库真实状态。
- [ ] 新注册与改邮箱在 OTP 验证前不会创建/替换已验证主邮箱，挑战过期、重放、错误次数和冷却均被测试。
- [ ] Contact API 只返回已验证地址；未验证/不存在、越权 token 和暂时故障具有稳定响应。
- [ ] OAuth Provider 的配置指纹包含 resource/scope grant 变化，权限变更能安全生效。
- [ ] 数据迁移、回滚边界、单元测试和集成测试通过，现有 Authorization Code + PKCE 行为无回归。

## Out of Scope

- 通知模板、SMTP、投递队列和通知状态。
- 为其他业务系统托管验证码状态。
- 用户通知偏好或自定义通知渠道。
- 统一升级现有 MySQL 5.7.44。
