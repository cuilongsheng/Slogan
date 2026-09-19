## Why

当前规则只描述了技术栈和少量通用约束，没有定义 PC、移动端、后端各自的目录职责、模块边界和依赖方向。开发前补齐这些稳定边界，可以避免 `components`、`hooks`、`utils`、NestJS services 等目录逐渐成为无边界的代码堆积区。

## What Changes

- 确立 `pnpm` monorepo 的目标结构：`apps/mobile`、`apps/admin`、`apps/api` 和按真实共享需求创建的 `packages/*`。
- 保留 `rules/frontend.md` 作为双端共同规则，新增 `rules/mobile.md` 和 `rules/admin.md`。
- 扩展 `rules/backend.md`，采用 NestJS modular monolith，并定义 presentation、application、domain、infrastructure 的依赖方向。
- 新增 `docs/architecture/project-structure.md`，存放完整目录示例、目录职责和模块模板。
- 更新 `AGENTS.md` 的规则路由，使 Codex 根据改动目标读取对应规则。
- 明确不共享 PC/移动 UI，不建立全局 `interfaces` 垃圾目录，也不在目录骨架中生成占位业务代码。
- 创建 `apps/mobile`、`apps/admin`、`apps/api`、`packages/api-client`、`packages/shared` 及文档所列子目录的完整目录骨架；空目录使用 `.gitkeep` 保留，不生成业务实现。
- 保持 API contract、Figma、OpenSpec、verification 和 deployment 的既有权责不变。

## Capabilities

### New Capabilities

<!-- 无。本变更只建立工程架构与规则，不改变产品可观察行为。 -->

### Modified Capabilities

<!-- 无。skip_specs=true。 -->

## Impact

- Impacted delivery stages: Architecture。
- 将修改 `AGENTS.md`、`rules/*.md` 和 `docs/architecture/*.md`。
- 不修改 `PRD_V1.md`、baseline migration 候选 specs、`openspec/specs/` 或业务代码。
- 创建 `apps/`、`packages/` 目录骨架，但不创建 package manifest、运行时代码、API contract 或业务实现。
