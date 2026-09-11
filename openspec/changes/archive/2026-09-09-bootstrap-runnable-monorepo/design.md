## Context

见 `proposal.md` 的 Why。当前 `apps/*`、`packages/*` 和 `tests/*` 只有目录及 `.gitkeep`；仓库根没有 `package.json`、`pnpm-workspace.yaml`、lockfile、TypeScript 配置、测试运行器或 Git repository。既有架构已确认 `pnpm` monorepo、React PC 管理端、React Native + Expo 移动端、NestJS modular monolith、`packages/api-client` 与纯 TypeScript `packages/shared`，本设计负责把这些边界变成可执行基线。

本 change 是工程基础设施变更，不产生产品 requirement delta，因此使用 `skip_specs=true`。它只进入 Architecture 与 Test / Acceptance 阶段。

## Goals / Non-Goals

**Goals:**

- 一次安装、一个 lockfile、统一根命令，同时允许每个 workspace 独立开发和验证。
- 三个 app 都有最小可启动入口，且入口不伪装成已实现的产品页面或 API。
- 将幽灵依赖、跨应用导入、非法共享和循环依赖从文字规则提升为自动检查。
- 让本地与未来任意 CI provider 调用同一个 `pnpm verify`，避免本地/CI 两套事实。
- 为 admin、mobile、api 和纯 TS package 采用适合各运行环境的 TypeScript 与测试配置。
- 为每项技术记录唯一职责和采用时机，避免同一职责并存多套库或预装无消费者依赖。

**Non-Goals:**

- 不把所有平台强行使用同一个测试运行器、tsconfig 或 UI 组件体系。
- 不引入 Nx、Turborepo、Changesets、Git LFS、容器编排或共享配置 package。
- 不初始化数据库、Redis、LiveKit 等运行依赖，不创建公开 HTTP endpoint。
- 不生成 OpenAPI contract/client，不决定 API-first 或 NestJS code-first。
- 不接入特定 CI/Git 平台，不定义部署和正式发布版本。

## Decisions

### Decision: 使用原生 pnpm workspace，不增加任务编排框架

根目录创建 `package.json`、`pnpm-workspace.yaml`、唯一 `pnpm-lock.yaml`、版本文件和 `.npmrc`。workspace 范围固定为 `apps/*` 与 `packages/*`，包名使用 `@slogan/*`，全部标记为 `private: true`。本地 workspace 依赖必须使用 `workspace:*`，每个包显式声明自己的直接依赖。

根 package 只持有真正跨 workspace 的工程工具和编排脚本；React、Expo、NestJS 等运行依赖归各自 app。使用 pnpm 默认依赖布局，不为方便导入而开启全局 hoist；若 Expo 的已验证兼容性要求特殊 node linker，必须在 apply evidence 中说明原因和影响。

当前只有三个 app 和两个 package，pnpm recursive/filter 命令足以组织任务。Nx/Turborepo 的缓存、daemon 和额外配置暂不产生足够收益；出现可测量的 CI 或本地构建瓶颈后再以独立 change 引入。

### Decision: 工具链版本必须被仓库记录

根 `package.json` 用 `packageManager` 固定精确 pnpm 版本，用 `engines.node` 和一个版本文件固定受支持的 Node LTS 主版本；lockfile 固定完整依赖图。apply 开始时应依据 React/Vite、Expo、NestJS 与 Playwright 官方兼容范围选择同一组稳定版本并记录，不直接继承当前机器的 Node `v25.9.0` 或未声明的全局工具。

版本选择验证记录写入本 change 的 acceptance evidence。以后常规依赖升级按 Level 0/1 路由；Node、Expo、NestJS 或构建系统跨主要版本升级需单独评估。

### Decision: 技术栈使用 adopt-now / adopt-on-trigger 分层

`docs/architecture/toolchain.md` 是技术选择登记入口；它记录职责、状态、选择原因、引入触发条件和被拒绝的重叠方案。`package.json` 与 lockfile 才是实际安装版本的事实来源。稳定且必须遵守的使用边界继续由 `rules/*.md` 持有，不能把完整依赖清单复制进 `AGENTS.md`。

Bootstrap 的 `adopt-now` 组合为：

| Area | Adopt now | Responsibility |
|---|---|---|
| Root | pnpm workspace、TypeScript、ESLint、Prettier、dependency-cruiser、Playwright | workspace、静态检查、依赖边界与 Web E2E |
| Admin | React、Vite、React Router、Tailwind CSS、Vitest、React Testing Library | PC 壳、集中路由、样式 tokens 与快速测试 |
| Mobile | React Native、Expo、Expo Router、React Native StyleSheet、Jest、React Native Testing Library | 原生壳、文件路由、平台样式与快速测试 |
| API | NestJS、Express adapter、`@nestjs/config`、Zod、Jest | HTTP 应用壳、启动配置校验和测试 |

业务能力出现时采用以下 `adopt-on-trigger` 默认方案，但不得在 bootstrap 中安装：

| Trigger | Default choice | Boundary |
|---|---|---|
| 首个真实 API 消费页面 | OpenAPI generated fetch client + TanStack Query | View 不直接请求；feature hook 组合 generated client |
| 首个复杂表单 | React Hook Form + Zod | 表单 schema 属于 feature，不复制 API DTO |
| 首个后台数据表格 | TanStack Table | 列、筛选和权限动作属于对应 feature |
| 首个中英文产品页面 | i18next + react-i18next；mobile 加 expo-localization | 用户文本只来自 i18n 资源 |
| 首个预约/跨时区功能 | date-fns + date-fns-tz | DB/API 使用 UTC 时刻，展示使用 IANA timezone |
| 首个持久化用例 | PostgreSQL + Prisma | PostgreSQL 是事实来源；Prisma 只在 infrastructure |
| 首个 Redis 协调用例 | ioredis | presence、限流、临时状态和 Lua 原子操作，不保存持久事实 |
| 首个异步/延迟/重试任务 | BullMQ | 任务必须幂等并有 retry、timeout 与失败证据 |
| 首个语音房用例 | LiveKit server/client SDK | token 由后端签发；SDK 隔离在 adapter/service |
| 首个公开 API | nestjs-pino、Helmet、CORS allowlist、rate limiting | 结构化脱敏日志和服务端安全边界 |
| Auth change | Passport/provider adapter、token/refresh 方案、Argon2id（密码存在时） | 作为独立 Level 2 设计，不在 bootstrap 推断会话模型 |
| 首次真实部署 | error reporting / OpenTelemetry 按运维需求选择 | 未部署前不虚构生产监控能力 |

Axios、Redux/Zustand、NativeWind、Fastify、Changesets、Testcontainers 等初始状态为 `deferred`，不是永久禁止：

- 默认使用由唯一 OpenAPI contract 生成的 fetch transport；只有上传进度、特定 adapter 或 generator 约束形成真实需求时才评估 Axios，且组件不得直接依赖 transport。
- TanStack Query 只管理 server state；局部 React state 足够时不引入全局 store，出现真实跨页面客户端状态后再评估 Zustand/Redux。
- Admin 使用 Tailwind CSS；Mobile 使用 StyleSheet + semantic tokens，不为语法统一而强行引入 NativeWind。
- API 使用 NestJS 默认 Express adapter；只有压测或明确兼容性证据表明需要时才评估 Fastify。
- Testcontainers 在 PostgreSQL/Redis 集成测试出现后再引入；bootstrap 测试不要求外部容器。

同一职责只能存在一个默认方案。新增重叠库必须通过后续 change 说明原方案无法满足的真实约束、迁移影响和移除计划。

### Decision: 三端分别采用最小官方运行壳

- `apps/admin`：React + TypeScript + Vite + React Router + Tailwind CSS。只提供工程 smoke 页面和集中 router/provider 入口，不建立虚假的 dashboard、登录或房间 UI。测试使用 Vitest、React Testing Library；浏览器验收使用根 Playwright。
- `apps/mobile`：React Native + Expo + Expo Router + TypeScript。只提供一个工程 smoke route；保留顶层 `app/` 与 `src/features`/`src/services` 边界，样式使用 StyleSheet 和 semantic tokens。单元/组件测试使用 Expo 兼容的 Jest 与 React Native Testing Library；启动与 bundle/export 检查不等同于真机验收。
- `apps/api`：NestJS + TypeScript + Express adapter。只提供可启动的 `AppModule`、bootstrap、`@nestjs/config` 和 Zod 环境校验，不创建业务 module、公开 controller 或未进入唯一 OpenAPI contract 的 `/health` endpoint。测试使用 Jest，至少验证合法配置可 init/close、缺失必需配置会启动失败。

这些 smoke 壳属于工程运行证据，不是产品 UI 设计，因此不要求 Figma，也不使用 `voice-room-figma-to-frontend`；后续 Level 1/2 产品 UI 仍遵守该 Skill 规则。

### Decision: 共享包先建立边界，不预造能力

- `packages/shared` 使用纯 TypeScript，提供最小公开入口和 package `exports`；不得依赖 DOM、Node-only API、React、React Native、NestJS 或环境变量。没有真实共享逻辑时入口保持无业务导出。
- `packages/api-client` 只建立 private package manifest、生成目录和生成/清理脚本边界；在 `openapi/openapi.yaml` 获批前不生成文件、不暴露占位 DTO，也不成为 app 依赖。

不新增 `packages/config`。共享 TypeScript、ESLint、Prettier 配置直接放根目录，由 app/package 显式扩展；待配置需要独立版本或跨仓库复用时再抽包。

### Decision: TypeScript 配置按运行环境继承，不使用全局路径捷径

根 `tsconfig.base.json` 只放三端都成立的严格性和质量选项。admin、mobile、api、shared 各自维护运行环境相关选项；不把 DOM、Node 和 React Native lib 混入同一配置。

跨 workspace 导入走 package name 与 `exports`，应用内别名只允许指向本应用公开根。禁止用一个根 `paths` 映射直接穿透其他 app 或 feature 内部目录。初始规模不强制 TypeScript Project References；真实 build graph 需要增量编译时再引入。

### Decision: ESLint 管代码质量，依赖图工具管边界和循环

根 ESLint flat config 提供 TypeScript 和平台适配规则，各 app 只增加必要 override。使用 `dependency-cruiser` 作为单独的依赖图检查器，执行以下硬性检查：

- app 不得导入另一 app；
- package 不得导入 app；
- `packages/shared` 不得依赖平台框架或 Node-only 模块；
- 跨 feature/module 不得深层导入内部实现；
- 依赖图不得形成循环。

依赖图检查作为 `pnpm deps:check` 并进入 `pnpm verify`。不以 barrel、TS alias 或 NestJS `forwardRef` 隐藏循环。

### Decision: 根命令是唯一验证入口

根 scripts 至少包括：

```text
dev:admin       dev:mobile       dev:api
format          format:check
lint            typecheck       deps:check
test            test:e2e        build
verify
```

`verify` 顺序执行不修改文件的检查：`format:check -> deps:check -> lint -> typecheck -> test -> build -> test:e2e`。Playwright 配置通过 `webServer` 启动 admin smoke app，只覆盖浏览器行为；移动端 smoke 使用 Expo 启动/bundle 和对应测试证据，后续麦克风、权限、语言环境等功能仍要求真机 evidence。

每个 workspace 的 scripts 保持可单独调用，根命令通过 pnpm recursive/filter 编排。没有对应能力的 package 不提供伪成功脚本；例如尚未生成的 api-client 不使用 `echo success` 冒充 build/test。

### Decision: Git、版本与发布只建立防污染边界

创建 `.gitignore`，排除 `node_modules`、构建产物、覆盖率、Playwright 报告、本地环境文件、Expo/Metro 缓存和编辑器临时文件，同时保留安全的 `.env.example`。不忽略 OpenSpec、rules、lockfile 或必要测试 fixtures。

本 change 不执行 `git init`，因为 repository 远程平台和工作方式尚未由用户确认；也不启用 Git LFS，因为当前没有必须进入仓库的大型二进制资产。所有 workspace 先保持 private，不引入 Changesets 或 npm publish 流程。产品 release state 继续独立记录在 `docs/releases/`。

### Decision: CI provider 延后，但 CI contract 现在固定

未来 CI 只能调用根 `pnpm install --frozen-lockfile` 和 `pnpm verify`，不得复制另一套检查逻辑。缓存键应包含 lockfile 与运行时版本；并行化或 affected-only 优化必须保持与完整 `verify` 等价。

由于 `docs/runbooks/deployment.md` 已记录 CI provider 未决定，本 change 不创建 `.github/workflows` 或其他平台文件。平台确定后，以独立 change 添加 provider adapter，并在首次 CI 中保留完整验证作为基线。

## Risks / Trade-offs

- [Risk] Expo 对 pnpm 依赖布局或 Node 版本存在框架特定要求。→ apply 时使用官方支持矩阵选择版本，先验证 `expo-doctor`、启动和 bundle/export；只有出现证据时才增加 linker/hoist 例外。
- [Risk] 根 `verify` 初期串行执行会比最短反馈慢。→ 保留各 workspace 与各检查的独立命令；CI provider 接入后再基于测量并行或过滤，不提前增加缓存框架。
- [Risk] dependency boundary 规则过严会阻碍合法复用。→ 跨端只允许经 package public exports 共享；新增例外必须说明所有者，不允许路径级临时豁免长期存在。
- [Risk] 三种测试环境增加配置量。→ 接受平台差异，统一的是根入口、命名和 evidence，不强行统一测试运行器。
- [Risk] smoke 页面被误认为产品实现。→ 页面显式标注工程 bootstrap，不使用产品文案、Figma 状态或静态业务数据；验收记录注明不构成 0.0.1 功能完成。
- [Risk] 未接入 provider CI，合并时尚无远程强制门禁。→ 本 change 固定可复现的本地 CI contract；平台选择后优先接入，并在此之前不得声称 CI 已配置。
- [Risk] `packages/api-client` 空包导致使用者绕开 contract。→ app 不得依赖该包，直到唯一 OpenAPI contract 与生成策略在后续 Architecture change 中获批。
- [Risk] 技术登记表列出的 deferred 库被误认为已经安装或可用。→ 只有 manifest 和 lockfile 中存在且对应验证通过的依赖才算 implemented；文档必须显示 adoption status 和 trigger。

## Migration Plan

1. 记录兼容版本组合和选择依据，创建根 package/workspace/version/format/lint/TypeScript 配置及 `.gitignore`。
2. 为五个 workspace 创建 manifest，使用 `workspace:*` 声明真实内部依赖，安装依赖并生成唯一 lockfile。
3. 在既有目录中创建 admin、mobile、api 的最小运行入口及各自配置；删除被真实文件替代的 `.gitkeep`，不清理仍为空的已确认目录。
4. 创建 `packages/shared` 最小 public entry；保持 `packages/api-client/src/generated` 未生成且不被 app 消费。
5. 增加 ESLint、依赖图、各应用测试和根 Playwright smoke 测试，接通根 scripts。
6. 从干净依赖状态执行 frozen install、`pnpm verify`，分别采集 admin 浏览器启动、mobile Expo 启动/bundle、Nest application init/close 证据。
7. 更新工程启动文档，明确哪些只是 bootstrap evidence、哪些仍未实现；不修改产品 acceptance 或 release 状态。

回滚以本 change 的新增 manifest、lockfile、工具配置和 smoke 入口为边界；保留原有 rules、docs、OpenSpec 与目录结构。由于没有数据库、API contract、远程 CI 或部署状态，本 change 不需要数据迁移和生产回滚。

## Open Questions

- 使用 GitHub、GitLab 或其他远程平台；确定后决定 CI adapter 文件位置和分支保护方式。
- 未来是否需要 Git LFS；只有 Figma 导出或媒体资产确实需要进入 Git 且尺寸达到约定阈值时再决定。
