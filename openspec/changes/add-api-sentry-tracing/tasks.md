## 1. API Sentry 接入

- [x] 1.1 实现官方 instrument、环境配置和只发送 Error + Tracing 的隐私白名单，以配置和 transport 单元测试验证。
- [x] 1.2 注册 SentryModule，复用现有 filter 官方装饰器，保留直接 NestFactory 入口与错误合同，以 HTTP runtime 和 Vercel 入口产物验证。
- [x] 1.3 添加配置、去敏、异常响应、真实 SDK HTTP tracing 与禁用产品的本地测试；提供 Vercel 环境说明。
- [x] 1.4 对本次提交快照执行 build/typecheck/lint/test 和实际 Vercel 本地编译，记录证据并提交 develop；不 push / merge / deploy。

## 2. 已授权的云端性能验收

用户后续授权配置及发布 Preview / Production，并要求继续第二步中的性能追踪。原 1.4 保留当时授权边界。

- [x] 2.1 修复出站白名单误删 /v1 路由模板的问题，仅保留 instrumentation 提供的 http.route，不从原始 URL 推导；验证带版本前缀的根 span 接口名称和隐私白名单。
- [x] 2.2 隔离提交验证后发布两个环境，用只读请求验证真实 Sentry trace，记录环境、采样率和耗时证据；不新增公开故障接口，不启用 Logs/Profiling/Metrics。
