# H 通知认证与联系信息实施计划

## 1. 契约与迁移

- [x] 固化 OAuth resource/scope、Contact API 和统一错误的契约测试样例。
- [x] 增加 User 验证字段、子应用资源授权表、EmailVerificationChallenge 表的 TypeORM migration。
- [x] 在 migration 中以固定时间和 `legacy_migration` 来源回填现有用户；准备只回退结构前的安全检查说明。
- [x] 为新实体建立必要唯一约束、外键和挑战过期/查找索引。

## 2. 邮箱所有权

- [x] 先写失败测试：未验证注册、直接改邮箱、过期/错误/重复 OTP 都不能改变主邮箱。
- [x] 实现挑战生成、code hash、冷却、错误次数、验证和一次性消费。
- [x] 改造注册与改邮箱流程，移除通用 update 对 Email 的绕过路径。
- [x] 把 OIDC `email_verified` 改为真实字段派生，并覆盖历史迁移用户与未验证状态。

## 3. 机器认证与管理员授权

- [x] 增加子应用 resource/scope 管理能力和权限检查。
- [x] 让 Provider 客户端配置、功能开关、资源信息和重载指纹包含机器授权。
- [x] 增加 notification-service 自身 confidential client 与最小 `h-internal` grant 的部署配置/初始化流程。
- [x] 为管理员 Authorization Code token 增加通知管理 audience/scope 的权限映射。
- [x] 更新 Discovery，并针对固定的 `oidc-provider@9.8.2` 运行 Authorization Code 真实端点回归；Client Credentials 的完整部署端点联调留待真实 H 环境。

## 4. Contact API 与联调

- [x] 实现 audience/scope/client 守卫和只读 Contact API。
- [x] 对不存在与未验证用户统一响应，日志脱敏并添加 traceId。
- [x] 使用跨仓库协议替身验证 user recipient 与 H 自身 OTP 直接地址请求契约；真实数据库/SMTP 链路留待集成环境。

## 5. 质量门禁

- [x] 运行 lint、build、单元测试、OAuth 回归和 TypeORM metadata 检查；真实 MySQL 5.7 up/down 留待专用数据库。
- [x] 回归现有 Authorization Code + PKCE、client secret 轮换、JWKS 轮换与用户登录。
- [ ] 审查迁移在 MySQL 5.7.44 的兼容性，演练备份恢复和应用版本回滚顺序。
- [ ] 通过 `trellis-check` 后再提交；不在本任务实现 notification-service 代码。

## 邮箱所有权阶段证据（2026-08-11）

- migration：`1786377600000-EmailVerificationOwnership.ts`，固定时点回填、MySQL 5.7 DDL、active challenge 唯一约束、回滚前数据检查及 User 验证事实保留。
- 状态机：`EmailVerificationService`，覆盖 CSPRNG OTP、HMAC 摘要、重发冷却、过期、错误上限、行锁验证/消费及通知幂等。
- 事务：注册/替换主邮箱与挑战消费同一 TypeORM transaction；通用 update 拒绝 `email`。
- 门禁：`pnpm exec eslint "{src,apps,libs,test}/**/*.ts"`、`pnpm run build`、`pnpm run migration:check-load`通过；`pnpm test` 19 files / 47 tests 通过。
- 未运行真实 MySQL 5.7 up/down：当前环境未提供专用集成数据库，已保留 QueryRunner DDL/回滚安全测试。

## 机器认证与 Contact API 阶段证据（2026-08-11）

- 授权模型：`subapp_resource_grants` 唯一约束 `(appId, resource, scope)`；管理员预配接口一次返回 secret，普通 resource grant 管理接口受 `oauth-machine-grant-admin` 保护。
- Provider：固定资源目录驱动 JWT audience、scope 与 300 秒 TTL；仅有 grant 的 confidential client 声明 `client_credentials`，管理员 scope 再与用户角色权限求交集；授权行加入原子重载指纹。
- Contact API：本地验签 current/previous JWK，依次约束 `h-internal`、`users:contact:read`、client allowlist；只选取 `id/email/email_verified_at`，未验证与不存在统一 404，审计不记录邮箱。
- 测试：新增 token 边界/JWK 轮换、联系信息投影与不可用归一化、资源目录测试；最终 ESLint、Nest build、23 个测试文件/62 个测试和 TypeORM metadata 检查全部通过。真实 MySQL 5.7 up/down 与部署态 Client Credentials 端点仍待集成环境。
- 跨仓库修正：H 验证码通知客户端使用 RFC 8707 `urn:h:resource:notification-api`，提交体使用 `template`，幂等键只通过 `Idempotency-Key` header 传递，与通知服务 v1 契约一致。

## H 部署就绪证据（2026-08-11）

- 扩充受版本控制的 `.env` 配置模板，覆盖数据库、Redis、OIDC 当前/上一把密钥、独立 envelope key、Email 验证参数、H 发信客户端和 Contact API client allowlist；只含占位符，真实部署值由操作员替换或注入且不得提交。
- 新增 `pnpm local:start`：从受版本控制的 `.env` 模板加载配置但不覆盖进程环境，拒绝生产模式、schema synchronize、占位符、错误 Node 版本/URL/JWK/envelope key/验证参数；默认检查 metadata、展示并执行 migration 后启动，支持 `--check` 和 `--skip-migrations`。
- 新增 H 通知认证部署 runbook，明确 Node/MySQL/Redis 前置条件、secret 生成与归属、最小 client grant、备份与 migration 顺序、H/notification-service 启动顺序、health/OIDC/Contact/OTP 检查，以及不能用普通 down migration 回滚新验证事实的边界。
- 验证：`git diff --check`、本地脚本 `--help`、直接调用 ESLint、Nest build 和 TypeORM metadata 检查通过；授权 localhost 监听后 Vitest 23 个测试文件 / 62 个测试全部通过。pnpm shim 因受限网络无法验证 registry 签名，故质量命令改用已安装的 `node_modules/.bin` 二进制。
