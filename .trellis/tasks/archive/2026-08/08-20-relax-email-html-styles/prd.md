# 放宽邮件 HTML 样式过滤

## Goal

在不放开可执行 HTML 攻击面的前提下，完整保留事务邮件模板的 CSS 和常用展示属性，避免服务端清洗破坏邮件布局、颜色、字体、间距和按钮样式。

## Background

- 当前 `TemplateRenderer.sanitize()` 允许表格等结构标签，但不允许 `<style>` 标签或 `style` 属性，导致模板保存正常、投递前样式被统一移除。
- 模板调用与获准的直接 HTML 内容共用同一 sanitizer；渲染后的 HTML 会加密入队，SMTP adapter 不再做二次过滤。
- 模板管理员及被授予 `directContent` 能力的应用视为可信内容作者。本任务接受远程图片/CSS 跟踪和视觉伪装风险，不把 CSS 限制作为安全边界。

## Requirements

- 保留 `<style>` 标签及其完整 CSS 内容，不按 CSS 属性或值建立 allowlist。
- 允许所有安全展示标签使用 `style`、`class`、`id`、`title`、`role`、`aria-*` 和常用邮件布局属性；保留表格、图片和链接的展示属性。
- 继续移除 `script`、`iframe`、`object`、`embed`、`applet`、表单控件、外部样式链接、自动刷新等主动或嵌入式内容。
- 继续移除事件处理属性、`srcdoc` 等可执行属性，并限制链接和资源 URL 为现有安全 scheme。
- 保持 HTML 模板变量先转义再清洗；直接 HTML 与模板 HTML 使用相同规则。
- 不修改通知 API、数据库结构、SMTP adapter、模板管理前端或权限模型。

## Acceptance Criteria

- [x] `<style>` 中的 class 规则和任意内联 CSS 在清洗后保持不变。
- [x] 常见邮件表格布局属性、按钮样式、背景、间距、字体与响应式 media query 在清洗后保留。
- [x] `script`、iframe/插件嵌入、表单、事件处理器、`javascript:` URL 和 `srcdoc` 仍会被移除。
- [x] 插值变量中的 HTML 仍作为文本转义，不能注入标签或属性。
- [x] 模板 HTML 与直接 HTML 的回归测试均覆盖新策略，CommonJS 生产构建回放继续通过。

## Out of Scope

- CSS 隐私跟踪、远程资源加载、视觉仿冒和邮件客户端之间的完整渲染一致性。
- CSS inliner、富文本编辑器、邮件预览及历史模板迁移。
