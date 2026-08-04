# Safe House 前端实现依据

## 仓库边界

- 前端仓库：`/Users/youranreus/Code/Projects/safe-house`
- 后端说明源文件：`/Users/youranreus/Code/Projects/h/docs/third-party-oidc-integration-guide.html`
- 目标页面：`safe-house/src/views/user/pages/user-app.vue`
- 前端设计来源：`safe-house/DESIGN.md`
- 前端规范来源：`safe-house/.trellis/spec/frontend/`

## 适用约束

- 功能专属弹窗放在 `src/views/user/components/`，使用 kebab-case 文件名和显式 PascalCase 组件名。
- 使用 Vue 3 `<script setup lang="ts">`；真实双向弹窗状态使用 `defineModel('visible')`。
- 使用自动导入的 Naive UI 组件；图标来自已安装的 `@vicons/ionicons5`。
- 模态框必须保留 `role="dialog"` 和 `aria-modal="true"`；仅图标操作必须有 tooltip 与无障碍名称。
- 局部样式使用 `<style scoped lang="scss">`；响应式以 `768px` 为主要断点。
- 视觉遵循 `DESIGN.md`：轻量白色表面、3px 轻圆角、克制阴影、一个操作组仅一个绿色主操作。
- 静态说明应进入 `public/`，由 Vite 原样复制到构建产物；路径计算应兼容 `import.meta.env.BASE_URL`。
- 不使用 `v-html`；使用隔离的 `iframe` 展示完整 HTML。

## 验证

- `pnpm type-check`
- `pnpm lint`（会自动修复，执行后检查 diff）
- `pnpm build`
- 使用现有 Node 内置测试风格补充静态回归检查，并用 `node --test tests/*.test.ts` 执行。
