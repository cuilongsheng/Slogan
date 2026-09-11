# Admin Frontend Rules

## Stack and Routing

- PC 管理端使用 React + TypeScript + Vite + React Router；路由只由 `src/app/router` 统一持有。
- PC 样式使用 Tailwind CSS 和 semantic theme tokens。产品 UI primitives 在批准的 Figma 设计出现后按 feature 需要创建，不预装第二套样式或组件体系。
- `src/app/` 负责 bootstrap、router 和 providers；路由定义不得分散到 feature 内。
- `src/views/` 是路由级页面，只组合 layout、feature 和页面状态，不直接调用 generated API client。
- `src/layouts/` 负责应用壳、导航、页头和内容区域，不持有房间、举报或用户领域规则。

## Feature Ownership

- 管理后台按 `auth`、`dashboard`、`rooms`、`moderation`、`users`、`settings` 等业务 feature 组织。
- 表格列、筛选条件、业务表单、详情面板和权限动作归对应 feature，不进入根 `components/`。
- 根 `components/` 只放 Button、Input、Modal、Table shell、EmptyState 等跨 feature primitives。
- Feature 对外只暴露路由组合真正需要的 components、hooks 和 types；禁止跨 feature 深层导入。

## Data-heavy States

- 列表必须按适用情况定义筛选、分页、排序、loading、empty、error、permission denied 和刷新行为。
- 有破坏性或高权限影响的操作必须二次确认，并展示服务端返回的最终结果。
- 前端权限控制只改善体验；服务端必须再次鉴权。隐藏按钮不能作为安全边界。
- Server state 使用统一查询缓存方案；表单和瞬时 UI state 不得无理由进入全局 store。

## Visual and Responsive Behavior

- 以批准的 Figma frame、组件状态和 viewport 为视觉依据。
- 管理后台至少支持 Architecture 指定的桌面宽度；未经设计确认，不自行承诺完整移动端适配。
- 表格、弹窗、抽屉、下拉菜单和 Toast 必须覆盖键盘焦点、关闭、滚动和错误状态。

## Testing

- 使用 Playwright 覆盖关键管理流程、权限拒绝、表单校验和高风险操作确认。
- 组件或业务规则需要快速反馈时增加更低层测试；Playwright 不替代 API 权限测试。
- Figma 页面必须补充浏览器截图或视觉对比证据，不能只以 DOM 存在作为验收。
