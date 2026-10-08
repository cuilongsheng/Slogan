# Frontend Rules

## Architecture

- PC 管理端与移动端都采用 feature-first；按业务能力组织代码，不按文件类型把全部业务平铺到全局目录。
- 路由层只组合页面和 feature，不承载复杂业务规则、网络请求或持久状态。
- 跨 feature 依赖必须通过目标 feature 的公开入口；禁止深层导入其他 feature 的内部文件。
- 依赖方向为 `route/view -> feature -> shared frontend infrastructure`。Feature 不得反向依赖 route/view。
- 循环依赖必须通过重新划分所有权、抽取 port 或移动纯共享逻辑解决，不以 barrel、路径别名或运行时技巧隐藏。

## Directory Ownership

- `api/`：HTTP client 配置、认证注入、错误映射和 OpenAPI generated client。业务请求组合归对应 feature。
- `features/<domain>/api/`：围绕一个业务能力组合 generated client，不重新定义 endpoint 或 DTO。
- `features/<domain>/components/`：只服务该业务域的 UI。
- `features/<domain>/hooks/`：只服务该业务域的状态和交互编排。
- 根 `components/`：两个以上 feature 复用且不包含领域规则的 UI primitives。
- 根 `hooks/`：两个以上 feature 复用的技术性 Hook；业务 Hook 留在 feature。
- 根 `types/`：真正跨 feature 的前端类型；不得复制 OpenAPI DTO 或后端 domain model。
- 根 `utils/`：确定性、无状态、无网络和无业务流程的纯函数。
- 根 `styles/`：全局 reset、theme、tokens 和字体；局部样式与组件共置。
- 不建立全局 `interfaces/`。类型跟随拥有它的 API、feature 或模块。

## API Contract

- `openapi/openapi.yaml` 是唯一 API contract；前端通过 `packages/api-client` 或应用内 `api/generated/` 消费生成结果。
- Generated 文件不得手工修改。页面和组件不得拼接 URL、裸调 `fetch` 或维护第二份接口类型。
- API-first 与 NestJS code-first generated OpenAPI 由 Architecture 决定，不影响前端唯一消费边界。
- API 缺失时必须标记 `MISSING/PARTIAL/BLOCKED`，不得用静态成功数据伪装完成，除非用户明确批准 mock。

## Components and State

- 组件只接收完成渲染和交互所需的数据与回调；领域权限和状态转换由 feature 层处理。
- 异步界面按适用情况明确处理 loading、success、empty、permission denied、recoverable error 和 offline/reconnecting。
- Server state、local UI state 和 form state 分开管理；不要把服务端缓存复制到全局客户端 store。
- 共享组件修改必须保持向后兼容，或在同一 change 中更新所有消费者。

## Visual and Localization

- Figma 是视觉事实来源，OpenSpec 是行为来源。不得用 Figma 推导缺失业务规则。
- 使用语义 tokens，不在业务组件散落任意颜色、间距、字号、圆角或阴影。
- 用户可见文本必须进入 i18n；不得在业务组件中混用未管理的中英文常量。
- 涉及 Figma + API 的 Level 1/2 UI 变更必须使用 `$figma-to-frontend`。

## Verification

- 至少运行项目已有的 lint、typecheck、相关 tests 和 build。
- Tests/CI 是 verification evidence；视觉、运行时和设备相关行为仍需对应证据。
- 不得把未执行检查报告为 PASS，必须区分本次引入、既有和环境阻塞的失败。
