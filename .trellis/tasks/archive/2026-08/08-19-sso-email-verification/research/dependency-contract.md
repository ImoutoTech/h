# 依赖与前端约束摘录

## 邮箱挑战依赖

来源：`.trellis/tasks/08-10-notification-auth-contact/{prd.md,design.md,implement.md}`。

- H 负责挑战生成、摘要、期限、失败次数、冷却、验证和一次性消费。
- 通知服务只负责按 `account.email.verify` 模板投递，不参与验证。远端合入统一通知模块后，H 内部调用其 `NOTIFICATION_APPLICATION` 端口，不通过 HTTP 回调自身。
- User 使用 `email_verified_at` 与 `email_verification_source` 表示真实验证事实；历史用户以 `legacy_migration` 兼容回填。
- 注册与改邮箱必须原子消费证明；通用 update 不得保留直接写邮箱的旁路。

## Safe House 约束

来源：`/Users/reuszeng/Code/Projects/safe-house/.trellis/spec/frontend/`。

- Vue 3 Composition API、`<script setup lang="ts">`；路由页负责组合，状态化请求流程进入 composable。
- API 请求工厂位于 `src/api/`，共享类型位于 `src/types/`，跨视图用户状态通过 Pinia action 更新。
- Naive UI 表单在请求前使用 typed `FormInst.validate`；用户触发请求 `immediate: false`，有明确 loading/error。
- 新公共组件必须 typed props/emits；modal 保留 dialog 可访问属性；局部样式使用 scoped SCSS。
- 验证执行 `pnpm type-check`、`pnpm lint`、`pnpm build`，并运行仓库当前实际存在的测试命令。
