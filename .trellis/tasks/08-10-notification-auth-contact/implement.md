# H 通知认证与联系信息实施计划

## 1. 契约与迁移

- [ ] 固化 OAuth resource/scope、Contact API 和统一错误的契约测试样例。
- [ ] 增加 User 验证字段、子应用资源授权表、EmailVerificationChallenge 表的 TypeORM migration。（User/挑战部分已完成，子应用授权待后续阶段）
- [x] 在 migration 中以固定时间和 `legacy_migration` 来源回填现有用户；准备只回退结构前的安全检查说明。
- [x] 为新实体建立必要唯一约束、外键和挑战过期/查找索引。

## 2. 邮箱所有权

- [x] 先写失败测试：未验证注册、直接改邮箱、过期/错误/重复 OTP 都不能改变主邮箱。
- [x] 实现挑战生成、code hash、冷却、错误次数、验证和一次性消费。
- [x] 改造注册与改邮箱流程，移除通用 update 对 Email 的绕过路径。
- [x] 把 OIDC `email_verified` 改为真实字段派生，并覆盖历史迁移用户与未验证状态。

## 3. 机器认证与管理员授权

- [ ] 增加子应用 resource/scope 管理能力和权限检查。
- [ ] 让 Provider 客户端配置、功能开关、资源信息和重载指纹包含机器授权。
- [ ] 增加 notification-service 自身 confidential client 与最小 `h-internal` grant 的部署配置/初始化流程。
- [ ] 为管理员 Authorization Code token 增加通知管理 audience/scope 的权限映射。
- [ ] 更新 Discovery，并针对 `oidc-provider@9.8.2` 运行真实 token endpoint 集成测试。

## 4. Contact API 与联调

- [ ] 实现 audience/scope/client 守卫和只读 Contact API。
- [ ] 对不存在与未验证用户统一响应，日志脱敏并添加 traceId。
- [ ] 使用本地通知服务 stub 验证 user recipient 与 H 自身 OTP 直接地址流程。

## 5. 质量门禁

- [ ] 运行 lint、type-check、单元测试和 OAuth/数据库集成测试。
- [ ] 回归现有 Authorization Code + PKCE、client secret 轮换、JWKS 轮换与用户登录。
- [ ] 审查迁移在 MySQL 5.7.44 的兼容性，演练备份恢复和应用版本回滚顺序。
- [ ] 通过 `trellis-check` 后再提交；不在本任务实现 notification-service 代码。

## 邮箱所有权阶段证据（2026-08-11）

- migration：`1786377600000-EmailVerificationOwnership.ts`，固定时点回填、MySQL 5.7 DDL、active challenge 唯一约束、回滚前数据检查及 User 验证事实保留。
- 状态机：`EmailVerificationService`，覆盖 CSPRNG OTP、HMAC 摘要、重发冷却、过期、错误上限、行锁验证/消费及通知幂等。
- 事务：注册/替换主邮箱与挑战消费同一 TypeORM transaction；通用 update 拒绝 `email`。
- 门禁：`pnpm exec eslint "{src,apps,libs,test}/**/*.ts"`、`pnpm run build`、`pnpm run migration:check-load`通过；`pnpm test` 19 files / 47 tests 通过。
- 未运行真实 MySQL 5.7 up/down：当前环境未提供专用集成数据库，已保留 QueryRunner DDL/回滚安全测试。
