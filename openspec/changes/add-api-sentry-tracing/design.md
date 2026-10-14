## Context

当前 API 为 Node 24 / NestJS 12 / NodeNext ESM，已有 ApiExceptionFilter，由 configureApiApp 注册一次。Vercel 依赖 main.ts 直接 import NestFactory 并调用 create。工作区有大量其他未提交修改。

## Goals / Non-Goals

Goals: 完成用户明确批准的 API Error Monitoring + Tracing 本地接入和独立提交。
Non-Goals: 其他客户端、worker、云端配置、通知、source map 上传或部署。

## Decisions

- 使用固定版本官方 @sentry/nestjs，src/instrument.ts 为 main.ts 第一条 import。SentryModule.forRoot() 只注册 tracing interceptor，不添加第二个全局 filter。
- 保留现有 filter 的状态映射，在其中对非预期 5xx 的捕获方法使用 @SentryExceptionCaptured()。该方法接收固定消息和去敏后的错误，避免 SDK 将所有 HttpException（包括 5xx）都视为预期异常，也避免捕获业务 4xx；原 HTTP 响应逻辑不变。
- SDK 初始化时禁用自动内容采集，beforeSend 使用错误字段白名单；后台错误无 stack。beforeSendSpan 仅保留结构、耗时、固定操作与路由模板，不保留 SQL、参数、地址或任意 attributes。SDK 11 默认开启的 Logs/Metrics 以最终 beforeSendLog / beforeSendMetric 丢弃，并移除日志 integration，HTTP sessions 统计显式关闭；不加载 profiler。进程级异常使用 SDK integration 捕获后限时排空并退出，不使用会打印原错误的默认处理器。
- 配置位于 src/config，不依赖其他未提交 shared 改动。NODE_ENV 优先；VERCEL_GIT_COMMIT_SHA 为可选 release。DSN 缺失时不初始化。NODE_ENV=test 不读取本地 env；运行时使用与 Nest ConfigModule 相同的 envFilePath 顺序。
- OpenAPI 延用 NestJS code-first 唯一生成合同；本次不修改接口。
- 对本次提交内容生成隔离快照验证，使用文件及 hunk allowlist，保留其他工作区修改。

## Risks / Trade-offs

- 自动 span 可能携带敏感内容 → 出站白名单及 transport 测试；数据库 span 仅保留操作和耗时，降低 SQL 诊断细节。
- 采样与外部服务存在成本及传输失败 → Preview 默认 0.1，可设 0；本地 transport 验证不能证明云端额度和送达。
- ESM / Vercel 入口兼容 → 保持直接 NestFactory 调用，验证实际 Vercel 编译产物与隔离 HTTP runtime。

## Migration Plan

无需数据库迁移。后续由负责人在 Vercel 配置 SENTRY_DSN、SENTRY_TRACES_SAMPLE_RATE。回滚时移除 DSN 并重新部署以关闭初始化，或 revert 本次提交。本次仅本地提交。
