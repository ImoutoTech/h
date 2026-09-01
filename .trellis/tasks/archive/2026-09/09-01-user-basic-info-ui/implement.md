# 用户基本信息概览界面：实施计划

## Preconditions

- [ ] 后端子任务已完成，overview/activity 实际响应与父任务 `design.md` 一致。
- [ ] safe-house 工作树状态已检查，用户现有改动已识别并保留。

## Checklist

- [ ] 1. 在 `src/types/user.ts` 定义 overview/activity 传输类型，在 `src/api/user.ts` 增加 endpoint factories。
- [ ] 2. 先写 API/composable/feature 状态回归测试，覆盖 null/zero/partial failure/load more。
- [ ] 3. 实现 `useUserOverview` 与 `useUserActivity`，保持两个请求的独立状态。
- [ ] 4. 实现领域级 Statistic Card、账号安全卡、开发者指标和活动列表组件。
- [ ] 5. 重构 `user-info.vue`，保留编辑/退出行为并移除与页头重复的信息。
- [ ] 6. 完成权限、无应用、无活动、loading、error、retry 与更多分页状态。
- [ ] 7. 运行格式化/测试/type-check/lint/build，检查并保留 lint 自动修复造成的预期 diff。
- [ ] 8. 人工验证 768px、键盘、焦点、结果文本与局部失败恢复。
- [ ] 9. 派发 Trellis check reviewer 并修复 spec/类型/可访问性问题。
- [ ] 10. 更新 frontend spec 中新增的 overview/activity 模式（若形成可复用契约）。

## Validation

```sh
pnpm test
pnpm type-check
pnpm lint
pnpm build
```

## Risky Files and Rollback

- `src/views/user/pages/user-info.vue`：保留 logout 的 token/user/permission 清理顺序。
- `src/composables/useUserActivity.ts`：加载更多失败不能丢失已加载 items 或重复追加。
- `src/types/user.ts`：不得用断言掩盖后端 null/权限语义。
- 回滚时删除新增 feature files 并恢复 user-info/API/types 的对应增量；无需迁移客户端持久化状态。

## Review Gate

- 无权限、无应用、真实 0 和请求失败四种状态不可混淆。
- 不展示 `visitNum` 或伪趋势。
- 账号资料在 overview 失败时仍可用，活动失败可局部重试。
- 组件边界、响应式、键盘与类型检查全部通过。
