# 用户概览事件与接口：实施计划

## Checklist

- [ ] 1. 新增事件 taxonomy、entity、barrel export 与 migration；验证 metadata load。
- [ ] 2. 新增 ActivityModule、类型化 writer、幂等键与安全错误处理测试。
- [ ] 3. 新增 retention cleanup 与配置边界测试。
- [ ] 4. 实现 overview/activity DTO、controller、query service、权限与安全投影测试。
- [ ] 5. 接入 UserService 的密码登录成功/失败与资料/邮箱/密码变更事件。
- [ ] 6. 接入 ExternalIdentityService 的 provider 登录及绑定/解绑事件。
- [ ] 7. 接入 SubAppService 的应用和 Client Secret 变更事件。
- [ ] 8. 接入 OAuthService consent 事件与 Provider `grant.success` token exchange 事件。
- [ ] 9. 补齐 OIDC 未兑换/成功/拒绝/重放和 provider reload 回归测试。
- [ ] 10. 运行后端完整质量门槛，派发 Trellis check reviewer 并修复问题。
- [ ] 11. 更新后端 spec 中事件契约、migration 现实与安全边界。

## Validation

```sh
./node_modules/.bin/eslint "{src,apps,libs,test}/**/*.ts"
./node_modules/.bin/nest build
./node_modules/.bin/vitest run
pnpm migration:check-load
pnpm migration:show
```

若环境允许 disposable MySQL，额外运行 migration up/down/up；OIDC 标准客户端测试可能需要允许 loopback listener。

## Risky Files and Rollback

- `src/module/oauth/oauth.service.ts`：协议关键路径；任何 listener 都必须捕获错误且不能记录 ctx/body/code。
- `src/module/user/user.service.ts`：避免把 session 换发、绑定换 token 误算为登录。
- `src/module/*/*.module.ts`：保持 ActivityModule 单向依赖，防止 Nest DI cycle。
- migration：回滚会删除事件数据；未确认可丢失前只回滚代码，不执行 down。

## Review Gate

- writer 只能接收类型化白名单命令。
- overview/activity 不接受任意 user id，且权限与 actor 隔离有测试。
- token exchange 的成功计数与 consent 口径不混淆。
- 90 天清理、幂等与敏感信息否定断言全部通过。
