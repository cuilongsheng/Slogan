## 1. 唯一 API 合同的前端消费边界

- [x] 1.1 在 `packages/api-client` 固定生成器和 fetch 客户端依赖，添加生成与漂移检查命令；通过 `pnpm install --frozen-lockfile` 和生成命令验证依赖与输入路径可用。
- [x] 1.2 从当前 `openapi/openapi.yaml` 生成只读 TypeScript 合同，提供类型化客户端公共工厂；通过生成器 `--check`、包 typecheck 和一次已知 endpoint 的类型检查验证路径、参数及响应来自合同。

## 2. 移动端接入与证据

- [x] 2.1 添加 `apps/mobile/src/api` 入口并经 workspace 包引用生成客户端，不在 route 写请求或复制 DTO；通过移动端 typecheck 和依赖边界检查验证。
- [x] 2.2 记录 API 地址配置和生成/检查方法，明确当前工程页、会话与业务 UI 的边界；通过文档中的路径/命令核对和 `git diff --check` 验证。
- [x] 2.3 对最终改动运行受影响范围的 format、lint、typecheck、相关 tests、build、依赖边界、生成漂移和 OpenSpec strict validation；在验收记录中标注实际结果及尚未进行的运行时/设备验证。
