# SSO 邮箱认证实施计划

## 1. 契约与失败测试

- [ ] 为 challenge 创建/验证、注册证明、换绑、改密/首次设密建立 DTO 与响应/错误契约测试。
- [ ] 先写失败测试：未验证注册、通用资料直改邮箱、错误/过期/超限/重放/主体或用途不匹配的证明均失败。
- [ ] 写并发测试，证明同一 challenge/proof 只能被一次 mutation 消费。
- [ ] 固化兼容行为：历史用户迁移为已验证；旧 token 不撤销；外部身份流程不回归。

## 2. H 数据模型与挑战服务

- [ ] 增加或复用 User 邮箱验证字段、EmailVerificationChallenge 实体和 MySQL migration，检查与 `08-10-notification-auth-contact` 的重复变更。
- [ ] 实现统一邮箱规范化、OTP 生成/摘要、配置边界、冷却、失败计数、过期、验证与一次性 proof 消费。
- [ ] 通过 `NOTIFICATION_APPLICATION` 端口提交内部通知，使用 challenge UUID 幂等键；不重复实现 SMTP/模板/队列。
- [ ] 为创建与验证路径加入限频、稳定错误和脱敏日志。

## 3. H 账号流程

- [ ] 注册强制消费同邮箱的 `register` proof，并原子写入验证时间/来源。
- [ ] 从通用用户更新移除 email，新增专用换绑命令，事务内完成唯一性检查、写入与 proof 消费，提交后同步缓存。
- [ ] 改密要求当前邮箱 `change_password` proof；有密码账号同时验证旧密码，无密码账号允许首次设置。
- [ ] 修复改密 controller 未传递 MD5 转换后 DTO 的缺陷，并保持既有客户端协议兼容。
- [ ] 用户安全投影返回 `hasPassword`，OIDC `email_verified` 来自持久化验证状态。

## 4. Safe House 交互

- [ ] 增加 challenge/proof/换绑/改密 API 类型和请求工厂。
- [ ] 实现验证码输入组件及 composable，处理发送、倒计时、重发、验证、loading 和稳定错误。
- [ ] 改造注册流程：先验证邮箱，最终注册提交一次性 proof；邮箱变更时清空旧 challenge/proof。
- [ ] 从普通资料保存中移除 email，新增独立换绑 modal，成功后通过 store action 刷新用户资料。
- [ ] 新增改密/首次设密 modal，根据 `hasPassword` 控制旧密码字段；成功后清空密码和 proof 临时状态。
- [ ] 检查键盘提交、重复点击、移动端布局、倒计时可访问提示和敏感字段 autocomplete。

## 5. 验证与集成

- [ ] H：`pnpm exec eslint "{src,apps,libs,test}/**/*.ts"`、`pnpm run build`、`pnpm test`、migration load/show，并执行新增定向测试。
- [ ] Safe House：`pnpm type-check`、`pnpm lint`（检查自动修复 diff）、`pnpm build`，运行仓库现有测试命令及新增定向测试。
- [ ] 用通知服务 stub 完成注册、换绑、已有密码改密、无密码首次设密四条端到端流程。
- [ ] 回归登录/refresh、OIDC email claims、GitHub/Google 登录绑定、用户缓存、邮箱唯一性竞争和通知服务不可用。
- [ ] 审查日志与响应中不存在 OTP、proof、密码、完整邮箱或原始数据库错误。

## 6. 发布与回滚门禁

- [ ] 确认 migration 与现有通知认证任务没有重复建表/加列，明确执行顺序。
- [ ] 后端兼容版本先发布，Safe House 后发布；通知服务契约/模板可用性列为上线前置条件。
- [ ] 演练应用回滚时保留验证字段/挑战表；任何回滚版本都不能恢复未验证邮箱写入。
- [ ] 通过 `trellis-check`、更新相关 spec，并分别检查 H 与 Safe House 工作区 diff 后再提交。
