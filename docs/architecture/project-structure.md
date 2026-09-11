# Project Structure

## Purpose

本项目采用 `pnpm` monorepo、前端 feature-first 和 NestJS modular monolith。本文定义目标目录及职责；强制依赖规则仍以 `AGENTS.md` 和 `rules/*.md` 为准。

当前只创建目录和 `.gitkeep`。目录存在不表示对应功能、依赖、API 或运行时已经实现。

## Repository

```text
Slogan/
├── apps/
│   ├── admin/               # PC 管理端
│   ├── mobile/              # React Native + Expo
│   └── api/                 # NestJS modular monolith
├── packages/
│   ├── api-client/          # 唯一 OpenAPI contract 的生成客户端
│   └── shared/              # 无框架依赖的纯 TypeScript
├── tests/
│   ├── e2e/                 # 跨应用/浏览器 Playwright 流程
│   └── fixtures/            # 无隐私数据的共享测试输入
├── openapi/                 # 唯一 API contract
├── openspec/                # 当前需求与 change
├── rules/                   # 稳定工程约束
├── workflow/                # 项目 Delivery Lifecycle
└── docs/                    # 架构、验收、发布和 runbook
```

暂不创建 `packages/config`、`packages/shared-ui`、微服务应用或第二套 API types。新增 workspace package 必须有明确所有者和至少两个真实消费者。

## PC Admin

```text
apps/admin/
└── src/
    ├── app/
    │   ├── router/          # 集中路由和 route guards
    │   └── providers/       # 应用级 providers
    ├── api/
    │   └── generated/       # OpenAPI 生成结果，不手改
    ├── features/
    │   ├── auth/
    │   ├── dashboard/
    │   ├── rooms/
    │   ├── moderation/
    │   ├── users/
    │   └── settings/
    │       ├── api/         # feature 请求组合
    │       ├── components/  # feature UI
    │       ├── hooks/       # feature 状态与交互编排
    │       └── model/       # feature 本地模型、schema、状态
    ├── views/               # 路由级页面组合
    ├── layouts/             # 应用壳和页面结构
    ├── components/          # 跨 feature UI primitives
    ├── hooks/               # 跨 feature 技术 Hook
    ├── styles/              # global、theme、tokens
    ├── types/               # 真正全局的前端类型
    ├── utils/               # 无状态纯函数
    ├── i18n/                # 语言资源和初始化
    ├── assets/              # 本地静态资产
    └── test/                # admin 测试 setup/helpers
```

上面以 `settings/` 展示 feature 内部结构；目录骨架为每个已列 feature 创建同样的 `api/components/hooks/model` 子目录。实际实现允许删除没有用途的空子目录。

### Admin Dependency Direction

```text
app/router -> views -> features -> api/shared frontend infrastructure
layouts ---------------> shared components/hooks/styles
```

- `views` 不直接调用 generated client。
- Feature 不依赖 `views` 或 `app/router`。
- 跨 feature 使用对方公开入口，不深层导入内部组件或 hooks。
- 表格列、筛选、领域表单和权限动作归 feature，不进入根 components。

## Mobile

```text
apps/mobile/
├── app/
│   ├── auth/                # Expo Router 身份路由
│   ├── rooms/               # 房间路由
│   ├── profile/             # 资料路由
│   └── voice-room/          # 语音房路由
└── src/
    ├── providers/           # 应用 providers
    ├── api/
    │   └── generated/       # OpenAPI 生成结果，不手改
    ├── features/
    │   ├── auth/
    │   ├── profile/
    │   ├── room-discovery/
    │   ├── voice-room/
    │   └── reporting/
    │       ├── api/
    │       ├── components/
    │       ├── hooks/
    │       └── model/
    ├── components/
    │   └── ui/              # React Native UI primitives
    ├── hooks/               # 跨 feature 技术 Hook
    ├── services/
    │   ├── microphone/      # 音频设备封装
    │   ├── permissions/     # 系统权限封装
    │   ├── secure-storage/  # 安全本地存储
    │   ├── localization/    # 设备语言读取
    │   └── realtime/        # LiveKit 技术 adapter
    ├── styles/              # theme 和 semantic tokens
    ├── types/               # 真正全局的移动端类型
    ├── utils/               # 无状态纯函数
    ├── i18n/                # 中英文语言资源
    ├── assets/              # 移动端静态资产
    └── test/                # mobile 测试 setup/helpers
```

目录骨架为每个已列 feature 创建 `api/components/hooks/model`。Expo Router 的 route 文件只组合 feature，不承载 API、权限或 LiveKit 业务流程。

### Mobile Dependency Direction

```text
app routes -> features -> api/services/shared mobile infrastructure
```

- `services/realtime` 只封装 LiveKit SDK；房主、移除、重连资格等规则归 feature 和后端。
- PC React DOM 组件不得进入 mobile；mobile React Native 组件不得进入 admin。
- 麦克风、权限、系统语言和断网行为需要 runtime/真机证据。

## NestJS API

```text
apps/api/
├── prisma/
│   ├── schema.prisma        # 只包含 generator 和 datasource
│   ├── enums.prisma         # 跨 model 共用枚举
│   ├── models/              # Prisma multi-file schema，一 model 一文件
│   └── migrations/          # 不随意改写的历史迁移
├── test/
│   ├── unit/
│   ├── integration/
│   ├── e2e/
│   └── fixtures/
└── src/
    ├── config/              # 配置和 env validation
    ├── common/
    │   ├── decorators/
    │   ├── guards/
    │   ├── filters/
    │   ├── interceptors/
    │   ├── pipes/
    │   └── errors/
    ├── infrastructure/
    │   ├── database/
    │   ├── redis/
    │   ├── livekit/
    │   ├── oauth/
    │   └── observability/
    └── modules/
        ├── auth/
        ├── users/
        ├── profiles/
        ├── rooms/
        ├── voice/
        ├── moderation/
        └── audit/
            ├── presentation/
            │   └── dto/
            ├── application/
            │   ├── commands/
            │   ├── queries/
            │   └── services/
            ├── domain/
            │   ├── entities/
            │   ├── value-objects/
            │   ├── policies/
            │   ├── events/
            │   └── ports/
            └── infrastructure/
```

上面以 `audit/` 展示模块内部结构；目录骨架为每个已列 module 创建相同分层。正式实现时简单模块可删除无用空层，仅复杂模块保留完整分层。

### Backend Dependency Direction

```text
presentation -> application -> domain
infrastructure -------------> domain ports
```

- Controller 不直接使用 Prisma、Redis、LiveKit 或 OAuth SDK。
- Domain 不依赖 NestJS、Prisma、HTTP DTO、provider SDK 或环境变量。
- `common` 只接受跨模块技术机制，禁止放领域规则。
- 跨 module 调用公开 application API，不深层导入 repository 或内部 service。

## Shared Packages

### `packages/api-client`

```text
packages/api-client/
├── src/
│   └── generated/           # 从 openapi/openapi.yaml 产生
└── test/                    # contract/client smoke tests
```

- Generated 文件不手改。
- 不在应用内复制 DTO、enum 或 endpoint path。
- API contract 尚未批准时目录保持空骨架，不生成占位 client。

### `packages/shared`

```text
packages/shared/
├── src/
│   ├── types/               # 纯 TS、非 API DTO 的共享类型
│   ├── utils/               # 纯函数
│   └── validation/          # 无平台依赖的共享校验
└── test/
```

禁止依赖 React、React Native、NestJS、Prisma、LiveKit、DOM、Node-only runtime 或环境变量。UI、服务端实体和 provider adapter 不得进入该包。

## Naming

- React component：`PascalCase.tsx`。
- Hook：`useSomething.ts`，并以 `use` 开头。
- NestJS：`kebab-case.controller.ts`、`*.service.ts`、`*.module.ts`、`*.repository.ts`。
- DTO：`create-room.dto.ts` 等操作含义明确的名称。
- 测试：与源文件共置的 `*.spec.ts(x)`，或按级别放应用 `test/`；Playwright 使用 `*.e2e.spec.ts`。
- Feature/module 的 `index.ts` 只暴露稳定 public API，不递归 export 所有内部文件。

## Import Rules

- 使用 workspace/package alias 表达公共边界，禁止跨应用相对路径导入。
- 应用不得导入另一应用的 `src/`。
- 跨 feature/module 不深层导入内部目录。
- `packages/shared` 不依赖任何 app；`packages/api-client` 只依赖生成所需的轻量 runtime。
- 发现循环依赖时重新划分所有权，不用 barrel 或 `forwardRef` 掩盖。

## Test Placement

- 组件、Hook 和纯函数测试靠近源文件，便于识别所有权。
- NestJS domain/application 使用单元测试，repository/provider 使用 integration test，HTTP 权限和完整流程使用 e2e。
- 根 `tests/e2e` 用于跨应用或 PC Playwright 用户流程；应用内 `test/` 保存 setup、helpers 和应用级 fixtures。
- 真机权限、麦克风、前后台、系统语言和网络重连必须补充 mobile runtime evidence。

## Skeleton Rule

- 本次所有空目录以 `.gitkeep` 保留，不创建空 class、placeholder component、假 API 或 package manifest。
- 真实文件进入目录后删除对应 `.gitkeep`。
- 如果实现确认某一层没有职责，应通过对应 change 删除该空层，不用无意义代码维持目录外观。
- 目录骨架不是已实现能力、编译成功或可部署的证据。
