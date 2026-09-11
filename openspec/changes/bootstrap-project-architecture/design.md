## Context

项目目前只有需求、OpenSpec、规则和 workflow，没有前后端工程。现有 `rules/frontend.md` 与 `rules/backend.md` 只给出高层约束，尚不足以约束未来目录职责和模块依赖。本变更完善架构规则与目录文档，并创建不含业务代码的完整目录骨架。

## Goals / Non-Goals

**Goals:**

- 为 PC 管理端、移动端和 NestJS 后端定义不同但一致的模块组织方法。
- 明确 `api`、`hooks`、`utils`、`types`、`styles`、`views`、`components` 的职责和依赖方向。
- 保持单人项目可实现、可解释，同时允许真实复杂度增长。
- 防止跨端 UI 共享、DTO 重复维护、全局工具目录和公共模块失控。

**Non-Goals:**

- 不创建 workspace 配置、package manifest、运行时代码或业务实现；只创建目录和 `.gitkeep`。
- 不选择 API-first 与 NestJS code-first；仍由实现 API 的 Architecture change 决定。
- 不引入 Nx、Turborepo、微服务、事件总线或完整 DDD ceremony。
- 不改变产品需求和 baseline migration 分类。

## Decisions

### Decision: pnpm monorepo 作为目标工程形态

目标顶层结构为：

```text
apps/mobile
apps/admin
apps/api
packages/api-client
packages/shared
```

`packages/config` 等其他包只有出现第二个真实消费者后才能创建。当前创建已确定的 `apps/*`、`packages/api-client` 和 `packages/shared` 目录骨架。暂不引入 Nx/Turborepo；pnpm workspace 足以完成当前规模的依赖和脚本组织。

备选方案是三个独立仓库。它会增加 OpenAPI client、统一检查和原子变更成本，不适合当前单人、同一产品的开发方式。

### Decision: PC 和移动端都采用 feature-first，但路由与设备层不同

共同规则：

- `api/` 只包含传输层基础设施、错误映射和生成 client；业务请求组合放在对应 feature。
- `features/<domain>/` 持有业务组件、feature hooks、状态和 API 组合。
- 根 `components/` 只放跨业务、无领域规则的通用 UI。
- 根 `hooks/` 只放多个 feature 使用的技术性 Hook。
- 根 `types/` 只放前端全局类型，不复制 OpenAPI DTO。
- 根 `utils/` 只放无状态纯函数，不能隐藏业务流程或网络请求。
- `styles/` 只放全局 reset、theme、tokens；组件样式与组件共置。

PC 管理端使用 `views/` 表达路由级页面和 `layouts/` 表达壳层，重点支持表格、筛选、表单和权限状态。

移动端由 Expo Router 的顶层 `app/` 负责文件路由，业务实现位于 `src/features/`；麦克风、权限、安全存储、语言环境和实时连接等平台能力位于 `src/services/`。

不共享 React DOM 与 React Native UI 组件。允许共享 OpenAPI client、纯 TypeScript 校验和无平台依赖的数据转换。

备选方案是把所有代码按 `components/hooks/utils` 技术类型平铺。该方式初期简单，但业务增长后跨模块边界不可见，因此不采用。

### Decision: NestJS 使用 modular monolith

顶层后端结构采用：

```text
src/config
src/common
src/infrastructure
src/modules/<domain>
```

- `config` 负责配置加载和环境校验。
- `common` 只放跨模块技术机制，例如 guards、filters、interceptors、pipes、decorators 和基础错误；不得放房间或审核业务规则。
- `infrastructure` 放数据库、Redis、LiveKit、OAuth 和可观测性等全局适配设施。
- `modules` 按业务域组织，例如 auth、users、profiles、rooms、voice、moderation 和 audit。

复杂模块内部采用以下依赖方向：

```text
presentation -> application -> domain
infrastructure -> domain ports
```

- presentation 处理 controller、DTO 和协议映射。
- application 编排用例、事务和跨端口调用。
- domain 保存实体、值对象、policy、领域事件和 repository port。
- infrastructure 实现 Prisma repository 或外部服务 adapter。

简单模块在实现时可以保持扁平，但不得让 controller 直接调用 Prisma、Redis 或 LiveKit。本次按用户要求创建完整模块目录骨架；后续若某模块确认无需某层，应在实现 change 中删除对应空目录，而不是填入无意义代码。

备选方案是从第一天采用微服务或为每个模块完整复制 Clean Architecture。前者增加分布式复杂度，后者产生大量 ceremony，当前均不采用。

### Decision: 共享代码必须经过边界筛选

- `packages/api-client` 由唯一 OpenAPI contract 生成或派生，消费者不得手改生成结果。
- `packages/shared` 只接收无 React、React Native、NestJS、Prisma、LiveKit 和环境依赖的纯 TypeScript 代码。
- 不创建 `shared-ui`；PC 和移动端分别维护自己的 UI primitives。
- 不创建全局 `interfaces/`。类型按拥有者放置：API 类型来自 generated client，领域类型放 feature/module，真正全局类型才放根 `types/`。

### Decision: 跨模块导入走公开入口

feature/module 对外暴露最小 public API。其他模块不得深层导入其内部 components、repositories 或 implementation files。循环依赖必须通过重新划分所有权、抽取 port 或移动纯共享逻辑解决，不使用 `forwardRef` 作为默认手段。

### Decision: 规则和示例分开维护

- `rules/frontend.md` 保存 PC/移动共同的强制边界。
- `rules/admin.md`、`rules/mobile.md` 保存平台特有规则。
- `rules/backend.md` 保存 NestJS 模块和依赖约束。
- `docs/architecture/project-structure.md` 保存完整目录树、职责说明和按需创建原则。
- `AGENTS.md` 只负责按目标路由到相应规则，不复制全文。

## Risks / Trade-offs

- [Risk] 完整目录骨架在首个版本显得偏多。→ 骨架只使用 `.gitkeep`，不生成占位实现；正式 scaffold 时删除确认不需要的空层级，简单 feature/module 仍可保持扁平。
- [Risk] `common`、`shared`、`utils` 再次成为垃圾场。→ 要求无明确两个消费者或明确所有权时不得迁入公共目录。
- [Risk] PC 与移动端产生重复视觉组件。→ 接受平台 UI 差异，只共享 tokens 的语义和纯逻辑，不强行共享渲染代码。
- [Risk] application/domain 分层可能被误解为完整 DDD。→ 只在 rooms、voice、moderation 等规则复杂模块使用，其他模块保持最小结构。
- [Risk] OpenAPI 产生方式未决定。→ 规则只固定唯一输出和消费边界，把产生方式留给后续 API Architecture change。

## Migration Plan

1. 更新共同前端与后端规则，新增 mobile/admin 规则。
2. 创建 `docs/architecture/project-structure.md`，记录目标结构和职责。
3. 更新 `AGENTS.md` 的规则路由。
4. 创建文档所列 `apps/`、`packages/` 和测试目录骨架，以 `.gitkeep` 保留空目录。
5. 校验文档间没有冲突，确认目录骨架中没有业务实现或未经批准的 contract。

回滚只需恢复上述规则和架构文档；本变更没有业务数据、API 或运行时迁移。
