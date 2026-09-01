# 用户基本信息概览界面

## Goal

使用后端 overview/activity 契约重构 Safe House“基本信息”Tab，在不重复页头信息的前提下，清晰展示账号资料、安全状态、权限限定的子应用近 30 天指标和最近活动。

## Dependency

- 本子任务依赖 `09-01-user-overview-events-api` 完成并冻结接口类型。
- 若后端契约变更，必须先更新父任务 `design.md` 和本任务类型/验收标准，再开始实现。

## Requirements

### U1. Account Overview

- 保留邮箱、加入时间、资料更新时间、编辑资料与退出登录。
- 增加邮箱验证、密码状态和已绑定 GitHub/Google 等登录方式。
- 提供跳转到现有“登录方式”Tab 的明确操作。
- 不重复页头已有的头像、昵称、用户 ID 和角色；用户 ID 可从原 facts 移除。

### U2. Developer Metrics

- 仅当 overview `apps !== null` 时展示“我的子应用”区域。
- 有子应用时使用四张 Statistic Card 展示：子应用总数、近 30 天成功登录、近 30 天授权同意、近 30 天授权拒绝。
- 子应用总数卡副信息展示运行/关闭/封禁分布。
- 有权限但总数为 0 时使用引导型空状态并链接现有“子应用”Tab，不展示四张零值卡。
- 不读取或展示 `visitNum` 作为登录/授权指标。

### U3. Recent Activity

- 默认加载最近 20 条当前账号活动，按时间倒序展示 summary、detail、target、outcome 和相对/绝对时间。
- 列表有稳定 key、语义化列表结构、非颜色唯一的成功/失败/同意/拒绝表达。
- 有更多记录时提供“加载更多”或分页操作；加载失败可局部重试，不影响账号资料和开发者指标。
- 空列表显示明确空状态，不把没有历史解释为请求失败。

### U4. Request and State Boundaries

- API endpoint factory 位于 `src/api`，领域/响应类型位于 `src/types`，请求流位于 composable，页面和 feature component 只负责展示与交互。
- overview 与 activity 独立表示 loading/error；刷新/加载更多不清空已经成功展示的数据。
- API 响应使用完整 TypeScript 类型，不引入新的 `any` 或断言绕过契约。

### U5. Visual and Accessibility

- 复用 source-owned `UiCard`、`UiBadge`、`UiButton`、`UiAlert`、`UiSpinner` 和 `EmptyState`；Statistic Card 建为用户 feature component，不把领域逻辑放进全局 UI primitive。
- 参考 Origin UI Vue statistic-card 的 icon/connected 视觉语言，保持 Safe House neutral/New York tokens，不复制外部组件的整套实现。
- 移动端单列，较宽视口 2–4 列；遵循现有 768px 响应式基线。
- 图标只作辅助，状态必须有可读文本；所有操作键盘可达并有清晰焦点。

## Acceptance Criteria

- [ ] 账号资料/安全区展示真实邮箱验证、密码和绑定登录方式，并保留编辑/退出能力。
- [ ] 页内不重复头像、昵称、用户 ID 和角色；无子应用权限时完全隐藏开发者区域。
- [ ] 有子应用时四张卡的数值和 30 天窗口与 overview 一致；无子应用时显示引导空态。
- [ ] 页面没有 `visitNum` 登录文案，也不会把 `apps=null` 渲染为零指标。
- [ ] 最近活动默认 20 条，支持继续加载/分页、局部错误重试和空状态。
- [ ] overview/activity loading、失败、空数据和部分成功状态都有可观察 UI。
- [ ] 组件与 composable/API/types 分层、TypeScript 契约和权限检查符合 safe-house spec。
- [ ] `pnpm test`、`pnpm type-check`、`pnpm lint`、`pnpm build` 通过。
- [ ] 人工检查 768px 移动布局、键盘操作、焦点、错误提示和非颜色唯一状态表达。

## Out of Scope

- 30/90 天图表、Top 子应用、MAU、通知指标和环比。
- 重做用户中心页头、路由 Tab 或子应用管理页。
- 设备/地点/风险/会话 UI。
- 在前端聚合全量子应用或原始事件。

## Key Decisions

- 开发者指标按权限与是否拥有子应用自适应。
- P1 使用四张业务指标卡，账号安全用状态卡，最近活动用时间线/列表。
- 后端返回的安全 summary/detail 是 activity 展示文本来源；前端不解释任意 metadata。
