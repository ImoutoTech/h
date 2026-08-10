# 统一通知服务总体实施计划

## 交付顺序

父任务只负责跨仓库契约和集成验收，不直接承载业务代码。实施按以下顺序进行：

1. `08-10-notification-auth-contact`：先完成 H 的真实邮箱验证状态、OAuth 机器令牌和 Contact API。
2. `/Users/reuszeng/Code/Projects/notification-service/.trellis/tasks/08-10-notification-service-mvp`：在独立仓库实现通知服务；可先用契约 stub 并行开发，但联调必须使用第一项的真实接口。该外部任务拥有实现状态、分支、commit 和 PR。
3. 父任务集成验收：用一个 H 邮箱验证码场景和一个博客评论场景验证完整链路。

## 跨仓库契约门禁

- [ ] 在编码前冻结 OpenAPI 草案：通知提交/状态、模板管理、H Contact API。
- [ ] 冻结 JWT `issuer/audience/scope/client_id/sub` 约定与统一错误结构。
- [ ] 冻结模板变量 schema、locale fallback、幂等请求规范化算法和状态枚举。
- [ ] 两个仓库各自生成或校验客户端契约，但不发布共享业务源码包。
- [ ] 契约变更使用向后兼容字段扩展；破坏性变更只能进入新 API major 版本。

## 集成验收

- [ ] H 能为授权业务应用签发 `aud=notification-api` 的短期机器 JWT，越权 scope/resource 被拒绝。
- [ ] Notification API 能以自身机器身份读取 H 中已验证 Email；无验证邮箱与 H 不可用分别映射为确定错误。
- [ ] 邮箱验证码链路使用直接地址和 caller-owned challenge，重放幂等且不重新生成验证码。
- [ ] 博客评论链路使用统一 userId，`202` 前固定已验证 Email 与模板版本快照。
- [ ] SMTP 沙箱同时验证纯文本邮件与 `multipart/alternative` 邮件。
- [ ] 杀死 Worker 后租约恢复且不丢任务；模拟未知 SMTP 结果并记录至少一次语义。
- [ ] 终态载荷清理、日志脱敏、密钥轮换读取与 30 天元数据策略通过测试。
- [ ] 压测证明 API 延迟、队列吞吐和 SMTP 并发限制达到上线前定义的容量目标。

## 上线与回滚门禁

- [ ] 先上线 H 的兼容字段和历史迁移，验证 OIDC `email_verified` 不再硬编码。
- [ ] 通知服务在测试 SMTP 下运行恢复演练，再配置生产 SMTP secret。
- [ ] 只为试点应用和模板发放 grant，观察指标后逐个迁移。
- [ ] 回滚优先撤销 token scope/模板 grant 并排空队列，不删除已受理数据。
- [ ] 两个子任务分别完成代码审查、测试和迁移回滚演练后，父任务才能验收归档。
