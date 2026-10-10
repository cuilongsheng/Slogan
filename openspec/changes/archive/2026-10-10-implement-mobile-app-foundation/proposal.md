## Why

移动端仍是工程启动页，`packages/api-client` 也只有空目录，尚不能以唯一 OpenAPI 合同安全地开发真实业务页面。先建立可重复生成、可检查漂移的客户端边界，后续登录、房间和语音 change 才能逐批接入同一合同。

## What Changes

### Confirmed scope

- 从 `openapi/openapi.yaml` 生成类型，不手写 endpoint、DTO 或枚举副本。
- 在 `packages/api-client` 提供轻量、可注入 `fetch` 和 base URL 的类型化客户端工厂，以及确定性的生成与漂移检查命令。
- 移动端通过自身 `src/api` 入口消费该包，预留下一批登录 change 注入鉴权与会话生命周期的位置。
- 保留当前工程启动页，验证生成客户端可被 Expo/TypeScript 工程引用；不把无 API 调用的页面伪装成业务交付。

### Non-goals

- 本 change 不实现登录、资料、i18n 产品文案、房间、LiveKit 或管理端页面；这些分别归后续 frontend changes。
- 不修改后端业务实现或 `openapi/openapi.yaml`，不写静态成功数据或维护第二份接口合同。

### Roadmap and unresolved decisions

- 安全会话存储与刷新策略随 `implement-mobile-auth-profile` 设计和实现；第一个真实 API 页面再接入查询缓存与本地化库。
- 已确认的 Figma 视觉将在各具体页面 change 中映射到精确 frame、状态与设备尺寸，本工程底座不声明视觉验收完成。

## Capabilities

### New Capabilities

无。本 change 只建立代码生成和应用接入基础，不新增产品需求场景；`.openspec.yaml` 设置 `skip_specs: true`。

### Modified Capabilities

无。

## Impact

- 受影响阶段：Architecture、Frontend、Test / Acceptance。
- 代码范围：`packages/api-client/`、`apps/mobile/src/api/`、移动端依赖清单与相关生成脚本；不触碰当前未提交的后端改动。
- 验证：生成结果可重复、合同变更检测、移动端 typecheck/lint/test/build 与依赖边界检查。运行时登录和真机语音证据留给对应业务 change。
