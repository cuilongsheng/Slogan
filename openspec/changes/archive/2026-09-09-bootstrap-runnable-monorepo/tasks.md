## 1. Runtime 与 Workspace 基线

- [x] 1.1 根据 React/Vite、Expo、NestJS、Playwright 的官方支持范围确定兼容的 Node LTS、pnpm 和 adopt-now 框架精确版本；在 `docs/architecture/toolchain.md` 按 `adopt-now`、`adopt-on-trigger`、`deferred`、`rejected` 记录职责、理由和触发条件，并验证 adopt-now 版本与后续 manifests、版本文件一致。
- [x] 1.2 创建根 `package.json`、`pnpm-workspace.yaml`、`.npmrc`、Node 版本文件和 `tsconfig.base.json`，验证 `pnpm list --depth -1 -r` 只发现计划内五个 workspace 且所有 package 均为 private。
- [x] 1.3 为五个 workspace 创建 `package.json` 和平台级 TypeScript 配置，验证每个 workspace 能被 `pnpm --filter <package-name>` 精确选择，且不存在跨 app 相对路径或根级隐式运行依赖。
- [x] 1.4 安装已批准的依赖并生成唯一 `pnpm-lock.yaml`，删除 `node_modules` 后验证 `pnpm install --frozen-lockfile` 可以重建同一依赖图。
- [x] 1.5 审计根和五个 workspace 的 manifests，验证 adopt-on-trigger/deferred 技术未被提前安装、同一职责没有 Axios/fetch client 或多个状态/样式方案并存，并将审计结果记录为 acceptance evidence。

## 2. Shared Packages

- [x] 2.1 为 `packages/shared` 创建纯 TypeScript public entry、`exports`、build/typecheck/test scripts，验证其构建和测试通过且依赖图中不含 React、React Native、NestJS、DOM 或 Node-only runtime。
- [x] 2.2 为 `packages/api-client` 建立 private package 和生成边界，验证 `src/generated` 保持未生成、没有占位 DTO/endpoint、任何 app 都未依赖该 package。

## 3. PC Admin Bootstrap

- [x] 3.1 在 `apps/admin` 配置 React + TypeScript + Vite + React Router + Tailwind CSS，并按既有 `app/router -> views -> features` 边界创建最小入口和 semantic theme tokens，验证路由、Tailwind Vite 集成、`pnpm --filter @slogan/admin build` 与 typecheck 成功。
- [x] 3.2 创建明确标注为工程 bootstrap 的 admin smoke 页面，不加入产品状态、静态业务数据或未获批视觉设计，验证开发服务器可以打开且浏览器控制台无启动错误。
- [x] 3.3 配置 Vitest 与 React Testing Library，增加最小渲染测试，验证 `pnpm --filter @slogan/admin test` 可重复通过。

## 4. Mobile Bootstrap

- [x] 4.1 在 `apps/mobile` 配置 React Native + Expo + Expo Router，并保持顶层 `app/` 与 `src/features`/`src/services` 边界；建立 StyleSheet + semantic tokens 的最小样式入口，验证 Expo Router 能解析最小 route、未安装 NativeWind 且 typecheck 通过。
- [x] 4.2 创建明确标注为工程 bootstrap 的移动端 smoke route，不加入房间、权限或麦克风假实现，验证 Expo 启动检查和无签名 bundle/export 检查成功，并将其记录为运行时证据而非真机产品验收。
- [x] 4.3 配置 Expo 兼容的 Jest 与 React Native Testing Library，增加最小渲染测试，验证 `pnpm --filter @slogan/mobile test` 可重复通过。

## 5. NestJS API Bootstrap

- [x] 5.1 在 `apps/api` 配置 NestJS + TypeScript + Express adapter，创建只包含 bootstrap、`AppModule`、`@nestjs/config` 与 Zod 环境校验的最小 modular monolith 入口，验证 build 和 typecheck 成功且没有业务 controller、数据库、Redis 或 provider 初始化。
- [x] 5.2 配置 Jest 应用启动测试，验证合法环境下 Nest application 可以 init/close、缺失必需配置时启动失败，且 `pnpm --filter @slogan/api test` 不需要数据库或外部服务。
- [x] 5.3 检查 API 边界，验证本 change 没有创建公开 endpoint、`openapi/openapi.yaml`、generated client 或第二套 DTO，并在 acceptance evidence 中记录结果。

## 6. 自动化工程约束

- [x] 6.1 创建根 ESLint flat config 和各平台必要 overrides，验证根 `pnpm lint` 覆盖 admin、mobile、api 与 shared 且无跨平台解析错误。
- [x] 6.2 配置 `dependency-cruiser`，强制 app-to-app、package-to-app、shared 平台依赖、跨 feature/module 深层导入和循环依赖规则；用最小受控违规 fixture 验证规则会失败，再移除 fixture 并验证 `pnpm deps:check` 通过。
- [x] 6.3 创建 Prettier 配置和 `format`/`format:check` 命令，验证检查模式不修改文件且对所有受管源码和配置生效。
- [x] 6.4 创建 `.gitignore` 与安全的环境变量示例策略，验证依赖、构建产物、覆盖率、Playwright 报告、本地 env 和 Expo 缓存被忽略规则覆盖，而 lockfile、OpenSpec、rules 和 fixtures 未被排除。
- [x] 6.5 更新 `rules/admin.md`、`rules/mobile.md` 和 `rules/backend.md` 中与 adopt-now 技术直接相关的稳定边界，验证规则与 `docs/architecture/toolchain.md`、manifests 一致，同时不把完整依赖清单或 deferred 技术复制进规则。

## 7. 测试、统一命令与验收

- [x] 7.1 在根配置 Playwright，通过 `webServer` 启动 admin smoke app 并增加浏览器 E2E，验证 `pnpm test:e2e` 在 Chromium 中通过且失败时产生可诊断报告。
- [x] 7.2 建立根 `dev:admin`、`dev:mobile`、`dev:api`、`lint`、`typecheck`、`deps:check`、`test`、`build` 与 `verify` scripts，验证各命令可独立执行且不存在 `echo success` 一类伪检查。
- [x] 7.3 将 `pnpm verify` 接为 `format:check -> deps:check -> lint -> typecheck -> test -> build -> test:e2e`，从干净安装状态执行并记录每一步 PASS/FAIL，不把未执行的真机、CI 或 deployment 检查报告为 PASS。
- [x] 7.4 更新开发文档，列出安装、三端启动、单 workspace 过滤、完整验证和 Playwright 浏览器准备命令；由新终端按文档执行一次并验证无需未记录的全局工具。
- [x] 7.5 生成最终依赖清单并逐项对应 `docs/architecture/toolchain.md` 的职责，验证没有未声明直接依赖、无消费者依赖、重复职责库或被误报为 implemented 的 adopt-on-trigger/deferred 技术。
- [x] 7.6 运行 `openspec validate bootstrap-runnable-monorepo --strict`，核对变更只影响 Architecture 与 Test / Acceptance、`skip_specs=true`、无业务 requirement/API/Figma/release 状态改动，并提交给用户进行 acceptance review。
