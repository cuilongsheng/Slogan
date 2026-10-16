# API Sentry 本地验收

日期：2026-10-14。范围：用户批准的 NestJS API Error Monitoring + Tracing。
基线：develop / 716cc0bd0fd4e0010721f0e0ac3c77eec4522436。

验证使用 HEAD 基线加本次允许文件/hunk 的隔离快照，离线 frozen-lockfile 安装；不依赖工作区其他未提交功能。未读取私有 env 文件、配置 Vercel/Sentry 账号或部署。

## 结果

| 检查                                           | 结果                                                                                                                                                                                                                                                                                        |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API build (`prisma generate && nest build`)    | PASS                                                                                                                                                                                                                                                                                        |
| API typecheck (`tsc --noEmit`)                 | PASS                                                                                                                                                                                                                                                                                        |
| API lint (`eslint src test --max-warnings=0`)  | PASS                                                                                                                                                                                                                                                                                        |
| `pnpm --filter @slogan/api test`               | PASS：unit 39 suites / 237 tests；integration 37 / 198；e2e 17 / 94。共 93 suites / 529 tests。                                                                                                                                                                                             |
| `pnpm --filter @slogan/api test:sentry`        | PASS：真实本地 Nest/HTTP、内存 SDK transport，500/503 各一次错误，403 不上报；36 spans，包含自动 HTTP root span 和路由模板，environment/release 标签保留；未捕获异常与 Promise rejection 子进程均先去敏上报再退出 1，终端仅固定提示；私有 canary、Logs、Metrics、sessions、profile 未出站。 |
| Vercel CLI 63.1.2 本地 Preview build           | PASS：Node 24.21.0，产物 `index.func` 的 runtime 为 nodejs24.x，handler 为 apps/api/src/main.js。编译后第一条 import 仍为 ./instrument.js，直接 NestFactory.create 保留。                                                                                                                   |
| OpenSpec strict validation / staged diff check | PASS                                                                                                                                                                                                                                                                                        |

最终 build/test/Vercel 生成流程串行运行，避免 Prisma 输出目录被多个生成任务同时写入。pnpm 自动更新两个 Vitest 的可选 OpenTelemetry peer 引用；版本不变，无 Admin/shared 源码或 package.json 改动进入本次提交。

## 异常过滤器和配置

仅 `configureApiApp` 注册一次 `ApiExceptionFilter`；未注册 SentryGlobalFilter/APP_FILTER。原状态映射决定是否为 5xx，官方装饰器置于现有 filter 的内部捕获方法，接收固定消息的 Error，避免 SDK 跳过 HttpException 5xx；HTTP catch 响应保持原行为。

Vercel 手工添加 `SENTRY_DSN` 和 `SENTRY_TRACES_SAMPLE_RATE=0.1`（Preview 建议）。采样率可设 0，非法值不回显。environment 优先 NODE_ENV，后备 VERCEL_ENV / development；完整 VERCEL_GIT_COMMIT_SHA 自动作为可选 release。无需 SENTRY_AUTH_TOKEN。详见 [runbook](../runbooks/api-sentry.md)。

## 修改文件

- `apps/api/src/instrument.ts`
- `apps/api/src/config/sentry.ts`
- `apps/api/src/infrastructure/observability/sentry-options.ts`
- `apps/api/test/unit/sentry.spec.ts`
- `apps/api/scripts/check-sentry.mjs`
- `docs/runbooks/api-sentry.md`
- `openspec/changes/add-api-sentry-tracing/.openspec.yaml`
- `openspec/changes/add-api-sentry-tracing/tasks.md`
- `openspec/changes/add-api-sentry-tracing/design.md`
- `openspec/changes/add-api-sentry-tracing/proposal.md`
- `openspec/changes/add-api-sentry-tracing/specs/api-sentry-monitoring/spec.md`
- `apps/api/src/main.ts`
- `apps/api/src/app.module.ts`
- `apps/api/src/common/filters/api-exception.filter.ts`
- `apps/api/package.json`
- `pnpm-lock.yaml`
- `docs/acceptance/add-api-sentry-tracing.md`

## 证据边界

已验证本地提交内容及 Vercel 编译/入口识别；没有执行 push、merge 或 deploy。未验证真实 Vercel 环境、Sentry 云端送达、配额或 source map 上传。关闭 DSN 后需后续发布才能关闭云端已运行版本。
