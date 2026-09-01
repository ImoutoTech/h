# 用户基本信息概览界面：技术设计

## Component Structure

```text
src/views/user/pages/user-info.vue
  ├─ Account facts / actions
  ├─ UserSecurityOverview.vue
  ├─ DeveloperMetrics.vue
  │    └─ UserStatisticCard.vue × 4
  └─ UserActivityList.vue

src/composables/
  ├─ useUserOverview.ts
  └─ useUserActivity.ts

src/api/user.ts
src/types/user.ts
```

feature components 放在 `src/views/user/components/`，避免让 `src/components/ui/` 依赖用户领域类型。

## Transport Types

在 `src/types/user.ts` 增加：

- `UserOverview`
- `UserOverviewApps`
- `UserActivityItem`
- `UserActivityCategory/Action/Outcome`

`src/api/user.ts` 增加带完整泛型的 `getUserOverview()` 与 `getUserActivity(page, size, category?)`。

## Composables

`useUserOverview` 使用 Alova `useRequest` 立即读取 overview，返回 `data/loading/error/refresh`。已有成功数据在 refresh 失败时保留。

`useUserActivity` 使用 `usePagination` 或等价的显式分页状态，初始 page size 为 20，按后端 count 判断是否还有更多；返回 `items/loading/error/loadMore/retry/hasMore`。加载更多失败不清空旧 items。

页面继续使用现有 `useUserData()` 和 user store 处理退出与资料修改；overview account snapshot 用于安全状态，避免改变全局 session store 责任。

## Layout

1. **账号资料与安全**：两列卡片；窄屏单列。资料卡使用 `dl`，安全卡使用状态列表与 Badge，末尾提供“管理登录方式”。编辑资料/退出登录保留清晰分组。
2. **我的子应用**：`apps === null` 时不渲染；`apps.total === 0` 时渲染 EmptyState；否则 `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4` 统计卡。
3. **最近活动**：语义化 `ol/li` 或 `ul/li`，每条包含图标、summary、detail/target、结果文本和时间；底部加载更多。

Statistic Card 使用图标、标题、大数和副信息。授权拒绝使用中性/警示语义，不使用整卡高饱和红色；数值本身不带虚构趋势百分比。

## State Matrix

| Overview | Activity | UI |
|---|---|---|
| loading | loading | 账号原 facts 可见；两个区域各自 spinner |
| success | failure | 概览正常；活动显示局部 UiAlert + 重试 |
| failure | success | 账号 store facts 和活动可见；概览显示局部错误 |
| apps=null | any | 不渲染“我的子应用” |
| apps.total=0 | any | 子应用引导空态 |
| activity empty | success | “暂无最近活动”空态 |

## Accessibility

- section 使用可见 `h2`，统计卡数值使用文本，不仅依赖图标。
- 状态 Badge 配套“已验证/未验证”“已设置/未设置”等文字。
- 活动 outcome 有文本；失败/拒绝不只依赖颜色。
- 纯图标元素 `aria-hidden=true`；图标按钮如存在必须有 `aria-label`。
- 加载状态使用 `UiSpinner`，错误使用 `UiAlert`，动态加载后的焦点不强制跳转。

## Tests

- 类型/API URL 与参数契约。
- permission/null/zero/positive 数据分支的 feature behavior assertions。
- activity 空态、失败重试、加载更多保留旧数据。
- 文案回归：不存在“已访问/visitNum”作为登录指标，30 天窗口可见。
- 组件语义：标题、列表、按钮文本、稳定 key 与非颜色 outcome。
- type-check/build/lint 与人工响应式/键盘检查。

## Rollback

主要改动集中在 user-info 页面、新 feature components、composables/types/API。回滚这些文件即可恢复旧页面；不改 user store token/session 行为和路由结构。
