# 修复 HTML 模板清洗运行时错误

## Goal

修复生产 CommonJS 构建中 HTML 通知模板和直接 HTML 内容在清洗阶段抛出 `sanitize_html_1.default is not a function` 的运行时错误，恢复安全 HTML 投递。

## Background

- 生产日志在 HTML 模板渲染时稳定报错：`TypeError: (0 , sanitize_html_1.default) is not a function`。
- `src/module/notification/template-renderer.ts` 使用 `import sanitizeHtml from 'sanitize-html'`，项目编译为 CommonJS，只开启 `allowSyntheticDefaultImports` 而未开启 `esModuleInterop`。
- 生产构建回放已复现同一错误；`require('sanitize-html')` 本身为函数，其 `.default` 为 `undefined`。
- Vitest 对 CommonJS/ESM 模块做了互操作包装，现有 HTML 清洗单测通过但未覆盖生产编译产物的导入形态。

## Requirements

- 仅在模板渲染边界修正 `sanitize-html` 导入，不全局开启 `esModuleInterop`，避免扩大运行时变更范围。
- 保持现有 HTML allowlist、属性和 scheme 清洗策略不变。
- 先增加能在修复前失败的 CommonJS 运行时回归保护，再实施最小修复。
- 模板 HTML 变量仍需转义，可执行标签、事件属性和不安全 URL scheme 仍需被移除。
- 经过 Nest 生产构建后，直接调用编译后的 `TemplateRenderer.render()` 必须成功返回清洗后 HTML。

## Acceptance Criteria

- [ ] 当前最小回放在修复后不再抛出 `sanitize_html_1.default is not a function`。
- [ ] HTML 模板渲染、变量转义和直接 HTML 清洗单测通过。
- [ ] 新增回归保护能检测 CommonJS 编译产物错误，不只验证 Vitest 的模块环境。
- [ ] 非修复 ESLint、Nest build、聚焦通知测试、完整 Vitest 和 `git diff --check` 通过。

## Out of Scope

- 不修改 HTML allowlist 产品策略。
- 不修改通知 API、模板数据结构或前端。
- 不通过禁用 HTML 清洗或放宽安全规则规避错误。
