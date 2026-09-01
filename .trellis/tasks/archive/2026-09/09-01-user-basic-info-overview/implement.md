# 丰富用户基本信息概览：执行计划

## Execution Order

- [ ] 1. 完成并启动 `09-01-user-overview-events-api` 子任务。
- [ ] 2. 后端接口契约、migration、事件测试和质量检查通过后，完成并启动 `09-01-user-basic-info-ui` 子任务。
- [ ] 3. 在同一环境联合验证密码/外部登录、OIDC 同意/拒绝/token exchange、子应用权限和活动展示。
- [ ] 4. 分别检查 `h` 与 `safe-house` 工作树，确保没有覆盖用户现有改动。
- [ ] 5. 运行两个仓库的完整质量门槛并进行父任务集成复核。
- [ ] 6. 按仓库分别提交，记录两个 commit，并更新必要的 Trellis spec。

## Integration Validation

### h

```sh
./node_modules/.bin/eslint "{src,apps,libs,test}/**/*.ts"
./node_modules/.bin/nest build
./node_modules/.bin/vitest run
pnpm migration:check-load
```

### safe-house

```sh
pnpm test
pnpm type-check
pnpm lint
pnpm build
```

### Manual

- [ ] 普通用户、无子应用权限用户、无子应用 owner、有活跃数据 owner 四种页面状态。
- [ ] OIDC 同意后不兑换 code 不增加登录数；成功兑换只增加一次；重放 code 不重复计数。
- [ ] 拒绝授权只增加 denied，不增加登录或 approved。
- [ ] 最近活动只显示当前账号事件，不泄露其他用户行为或敏感字段。
- [ ] 768px 及以下单列顺序、键盘焦点、loading/error/empty/retry 状态。

## Rollback Points

- migration 上线前：可无状态回滚后端代码。
- migration 上线后、前端上线前：保留空事件表并回滚服务代码。
- 前端上线后：先回滚 Safe House，再回滚 h；不要在未确认数据可丢失前 revert migration。

## Review Gates

- 后端 reviewer 验证事件口径、去重、权限、90 天清理和敏感信息边界。
- 前端 reviewer 验证 API 类型、局部错误状态、权限自适应、响应式和无障碍。
- 父任务 reviewer 对照 `prd.md` 验证跨仓库数据流与所有 acceptance criteria。
