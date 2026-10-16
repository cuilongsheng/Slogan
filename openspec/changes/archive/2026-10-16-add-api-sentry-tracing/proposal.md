## Why

当前 API 需要线上错误定位与性能采样。用户已明确批准只接入官方 NestJS Sentry Error Monitoring + Tracing，并在 develop 本地提交。

## What Changes

- 初始化官方 SDK，环境变量控制 DSN 和采样率，Preview 默认 0.1。
- 兼容现有全局异常过滤器和 Vercel NestJS 入口识别。
- 关闭 Logs、Profiling、Application Metrics，净化错误与 span 数据。
- 本 change 承接最新 API 指令，覆盖 add-production-observability 中 API HTTP 入口关闭 tracing 的旧设计；其他入口与其未完成外部验收不在本次范围。

## Capabilities

### New Capabilities

- `api-sentry-monitoring`: API 错误捕获、采样 tracing、隐私与入口兼容。

### Modified Capabilities

## Impact

API 初始化、基础设施、现有异常过滤器、SDK 依赖、配置说明及验证。不改变 OpenAPI，不新增公开测试路由。不配置云端、不 push / merge / deploy。

## Impacted delivery stages

- Backend / API
- Test / Acceptance
- Deployment

## Subsequent authorization

用户后续授权配置 Sentry/Vercel、发布 Preview 和 Production，并在 2026-10-15 要求继续原选型第二步。先完成当前 API 性能追踪的真实云端验收，包括修复 /v1 路由白名单；三端错误、通知、源码映射和语音质量聚合等更广范围不计为本 change 已完成。
