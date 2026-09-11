## Why

项目目前只有 `pnpm` monorepo 的目标目录和工程规则，没有 workspace manifest、依赖锁定、TypeScript 配置或统一验证命令，因而三个应用仍无法安装、启动、构建或测试。开发业务前需要建立一个最小但可运行、可检查的工程基线，让后续 OpenSpec change 在同一套边界和命令上交付。

## What Changes

- 建立根 `pnpm` workspace，纳入 `apps/admin`、`apps/mobile`、`apps/api`、`packages/api-client` 和 `packages/shared`，并用唯一 lockfile 和 `workspace:` 依赖表达本地包关系。
- 为 PC 管理端创建最小 React + TypeScript 可运行壳，为移动端创建最小 React Native + Expo Router 可运行壳，为后端创建最小 NestJS modular monolith 可运行壳；不实现登录、房间、审核或其他产品功能。
- 建立根级安装、开发、lint、typecheck、test、build 和 verify 命令，并保留按 workspace 单独执行的能力；当前规模不引入 Nx 或 Turborepo。
- 建立共享 TypeScript、ESLint、Prettier、环境变量示例和依赖边界配置，自动发现跨应用深层导入、非法依赖方向和循环依赖。
- 建立工程技术栈登记表，按 `adopt-now`、`adopt-on-trigger`、`deferred`、`rejected` 记录每项技术的职责、采用时机和替代方案；不把尚未使用的数据库、队列、实时或状态管理依赖提前装入 bootstrap。
- 将本 change 已确定的 adopt-now 技术边界同步到 admin、mobile 和 backend 稳定规则；完整依赖清单和未来技术仍只保留在技术栈登记表，避免规则膨胀。
- 建立分层测试基线：应用级快速测试与根 Playwright Web E2E；移动端真机行为不以 Playwright 代替。
- 建立 `.gitignore`、单 lockfile、私有 workspace package、版本锁定和产物排除策略；不默认引入 Git LFS 或 package 发布工具。
- 将 CI 所需检查收敛为 provider-neutral 的 `pnpm verify`。CI provider 和远程 Git 平台尚未决定，因此本 change 不创建特定平台 workflow；确定平台后由独立 change 接入同一验证入口。
- `packages/api-client` 只建立 package 边界，不生成客户端、不创建第二套 DTO，也不决定 API-first 或 NestJS code-first generated OpenAPI。

### Confirmed scope

- 工程必须可从干净环境完成安装，并分别启动 admin、mobile 和 api 的最小壳。
- 根验证命令必须能够统一执行格式检查、依赖边界、lint、typecheck、测试和构建。
- 各 workspace 必须显式声明直接依赖，禁止依赖根目录偶然提升的包。
- Bootstrap 只安装完成最小运行壳所需的技术；已经选定但尚无真实消费者的业务基础设施必须记录触发条件，不得通过空配置或占位 service 伪装完成。

### Non-goals

- 不修改 `PRD_V1.md`、baseline migration、产品 requirements 或 Figma。
- 不实现业务 API、数据库 schema、Redis、LiveKit、OAuth、STT、AI 或部署环境。
- 不创建或生成 `openapi/openapi.yaml`；OpenAPI 产生方式仍由首个 API Architecture change 决定。
- 不选择 CI provider、部署平台或正式发布机制。

### Unresolved decisions

- CI provider 与远程 Git 平台；该决策不阻塞本地可运行和 CI-ready 的验证入口。
- 精确 Node、pnpm 和各框架版本在 apply 开始时按相互支持的稳定版本组合确定，并写入版本文件、manifest 和 lockfile，不能使用未记录的本机隐式版本。

## Capabilities

### New Capabilities

<!-- 无。本变更只建立工程工具链和最小运行壳，不改变产品可观察行为。 -->

### Modified Capabilities

<!-- 无。skip_specs=true。 -->

## Impact

- Impacted delivery stages: Architecture、Test / Acceptance。
- 将新增根 workspace/tooling 配置、三个 app 的最小启动代码、两个 package manifest、测试配置和包含技术采用状态的工程说明，并更新相关稳定工程规则。
- 将替换相关目录中的 `.gitkeep`，但不删除已确认的目录边界。
- 会引入并锁定开发依赖；不引入生产业务数据迁移，不改变 API contract，不产生 deployment release state。
