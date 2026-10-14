# NestJS API Sentry

本次只接入 Error Monitoring + Tracing。SDK 固定为 `@sentry/nestjs@11.7.0`。

## Vercel 环境变量

| 变量                        | 配置方式                                                                                                                             |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `SENTRY_DSN`                | 从 Sentry 的 API 项目复制 DSN，填入 Vercel 对应 Preview / Production 环境；不提交源码。未设置则不初始化 SDK。                        |
| `SENTRY_TRACES_SAMPLE_RATE` | Preview 建议 `0.1`（10%）；可设 `0` 关闭 Tracing、保留错误。合法范围 0–1，未设置默认 `0.1`。Production 按流量预算明确设置。          |
| `NODE_ENV`                  | 优先作为 Sentry environment。Vercel 通常自动设为 `production`，包括 Preview；若该值存在，Sentry 不会以 `VERCEL_ENV=preview` 覆盖它。 |
| `VERCEL_ENV`                | 平台已有变量；仅在 NODE_ENV 缺失时回退，之后回退为 development。                                                                     |
| `VERCEL_GIT_COMMIT_SHA`     | 平台自动提供有效完整 SHA 时生成 `slogan-api@<SHA>` release；不必手工填写。                                                           |

无需 `SENTRY_AUTH_TOKEN`、组织 slug 或 source map 上传配置。本次未引入上传工具，release 标签不等于已上传 source map。不要设置 `SENTRY_DEBUG=true`，初始化明确禁用 debug。

## 运行行为

`src/main.ts` 第一条 import 是 `./instrument.js`；其直接 import `@nestjs/core` 与 `NestFactory.create()` 保留，供 Vercel 识别。`SentryModule.forRoot()` 注册 tracing interceptor，现有 `ApiExceptionFilter` 仍是唯一全局 filter。

filter 使用原状态码映射，仅对 5xx 调用标注官方 `@SentryExceptionCaptured()` 的捕获方法。该方法接收固定消息的 Error，解决 SDK 默认跳过 HttpException 5xx 的问题，不更改 HTTP 响应。业务 4xx 不上报；后台异常不带 stack。

SDK 11 默认可收集 Logs 和 Metrics；本次通过最终 `beforeSendLog` / `beforeSendMetric` 返回 null 丢弃，integration 白名单不加载日志集成，也不安装 profiler；HTTP integration 的 request sessions 统计同样关闭。出站事件与 span 采用白名单，去掉请求正文、用户、cookie、header、URL/query、任意 attributes、SQL、局部变量、源码上下文及原异常消息。进程级未捕获异常和 Promise rejection 使用 SDK capture + 2 秒以内排空后退出，仅输出固定提示，不输出原异常；Tracing 保留结构、耗时、HTTP 状态和 route 模板；数据库 span 不带 SQL。现有 Pino 本地/平台日志继续工作。

## 本地验证和关闭

```sh
source ~/.nvm/nvm.sh && nvm use
pnpm --filter @slogan/api build
pnpm --filter @slogan/api typecheck
pnpm --filter @slogan/api lint
pnpm --filter @slogan/api test
pnpm --filter @slogan/api test:sentry
```

`test:sentry` 使用独立测试 module 和内存 transport，不接云端，也不会往 AppModule 注册测试路由。验证自动 HTTP spans、500/503 各一次错误、403 不上报，以及 Logs/Metrics/私有内容不出站。

关闭全部 Sentry：移除对应环境的 DSN 并重新发布。只关闭 Tracing：设置采样率为 `0`。无需数据库迁移。本次授权止于 develop 本地 commit；尚未配置 Vercel 或验证 Sentry 云端接收。
