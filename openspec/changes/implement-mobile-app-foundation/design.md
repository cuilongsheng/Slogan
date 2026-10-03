## Context

当前 `apps/mobile` 使用 Expo Router，但只有工程启动页；`packages/api-client` 无生成结果或消费者。`openapi/openapi.yaml` 由 NestJS code-first 流程产生，是唯一发布合同，且当前工作区有独立的后端未提交改动。本 change 不改 API 策略或合同本身。

## Goals / Non-Goals

**Goals:**

- 用同一份 OpenAPI 输入确定性地产生 TypeScript 路径、参数和响应类型，并提供漂移检查。
- 在包公共入口提供 `openapi-fetch` 类型化客户端工厂；移动端仅通过 `src/api` 接入这个公共入口。
- 让下一批业务 feature 可以注入 base URL、`fetch` 和后续授权处理，而不在页面拼 URL 或复制 DTO。

**Non-Goals:**

- 不在无真实登录消费者时实现刷新、持久会话或查询缓存；不调用业务 API 或渲染未完成的产品页。
- 不从 Figma 自动生成组件，不改变已确认的视觉稿，也不声称本 change 完成视觉验收。

## Decisions

1. 使用 `openapi-typescript` 7.x 从仓库唯一 YAML 生成 `packages/api-client/src/generated/schema.d.ts`，使用 CLI 的 `--check` 验证漂移。当前生成器 peer 只接受 TypeScript 5，因此在生成包隔离固定 TypeScript 5.9；移动端继续用仓库的 TypeScript 6 检查生成类型。其静态输出随代码提交；后续 API 合同变化必须重新生成。相比手写类型和自制解析器，这保留合同来源且减少维护面。
2. 使用 `openapi-fetch` 作为轻量类型化运行时。包导出 `createSloganApiClient({ baseUrl, fetch? })`；不在包内读取 Expo 环境、存储 token 或决定业务错误文案。相比 Axios 或自制请求层，复用已选的 fetch 边界。
3. `apps/mobile/src/api` 只负责移动端运行配置及未来的认证注入；首批不创建无消费者的全局状态或 feature 请求组合。开发配置必须显式给出可访问的 API base URL，不能默默使用本机 `localhost` 作为真机地址。
4. 先保留现有 bootstrap route，使此 change 的验证聚焦于生成合同和 Expo 导入；首个产品路由在认证/资料 change 中以确切 Figma frame 实现。

## Risks / Trade-offs

- [合同随当前未提交后端变更变化] → 生成与检查始终以工作区当前 `openapi/openapi.yaml` 为输入；不修改该文件，并在验收中说明生成所依据的工作区状态。
- [大型生成文件增加 diff] → 禁止手工编辑，只允许固定生成命令；CI/本地 `--check` 发现漂移。
- [生成器暂未声明支持 TypeScript 6] → 把 TypeScript 5.9 限定为生成包的开发依赖，真实消费者用 TypeScript 6 通过 typecheck；未来生成器支持 6 时再移除隔离版本。
- [模拟器、真机 API 地址不同] → 工厂要求调用方明确配置，下一批接入时为设备环境提供相应配置和运行时证据。
- [当前只有工程页] → 只报告基础设施验证，不将其写作已实现登录或房间功能。

## Migration Plan

增量安装依赖、生成文件和添加公共入口，不迁移持久数据或改变既有路由。回退时移除此包的新增生成/运行时代码及移动端入口，恢复包清单和 lockfile；后端及 API 合同不受影响。
