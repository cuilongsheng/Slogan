# API 性能追踪后续验收

日期：2026-10-15（Asia/Shanghai）。基线提交：e53b277f6ccb33c314bd9a9b73eec9a799dfccb1。

## 两阶段范围

原选型第一步包含三端/消费者错误、源码定位、探活与任务告警；第二步包含性能采样、语音质量聚合和跨服务 trace。当前真实交付仅 API Error Monitoring + Tracing；第二步中的 API 采样已在原提交开启为 0.1。本记录只验收该部分，不宣称两个完整阶段已交付。

## 修复与本地证据

真实 Sentry 页面已有新的 http.server trace、environment=production、client_sample_rate=0.1 和耗时，但无法按 /v1 接口区分。根因是 span 出站白名单正则没有允许数字，把 /v1 路由模板丢弃。最小修复为允许数字，仍只读取 SDK 的 http.route 模板，不取原始 URL/params/query，不增加 middleware/interceptor/filter。

单元测试使用 /v1/rooms/:roomId，修复前复现 http.server 而非接口名称的失败；修复后通过。HTTP harness 添加 v1 全局前缀，要求根 span 名称为 GET /v1/fixture/ok。另保证 HTTP 检查断言失败时退出 1，避免关闭 SDK 后丢失失败状态；在隔离副本中故意破坏断言已确认非零退出。

对 e53b277 的隔离快照只叠加以下三个实现/测试文件，核对所有 Git 跟踪文件，没有混入工作区其他改动：

- apps/api/src/infrastructure/observability/sentry-options.ts
- apps/api/test/unit/sentry.spec.ts
- apps/api/scripts/check-sentry.mjs

验证：API build/typecheck/lint 全部 PASS；完整 test 共 93 suites / 529 tests PASS（unit 39/237，integration 37/198，e2e 17/94）；test:sentry 为 2 个去敏错误、36 spans，4xx 不报错，未发送 Logs/Metrics/Profiling/sessions 或私有 canary。未改变 main.ts、异常 filter、依赖、OpenAPI 或数据库。

## 云端证据边界

原提交的 Preview 与 Production 仍能响应只读请求；Sentry 中已看到新 trace。修复提交 7e0eda53be4a738363e34dc81a0c8747909eb6ed 已完成两个环境云端构建及发布。Preview 20 次和 Production 40 次只读能力请求均返回 200，两个环境未登录 /v1/me 均为 401；Sentry 的两个独立请求时间窗口中分别确认 GET /v1/auth/capabilities、http.route、状态 200、client_sample_rate=0.1 和耗时。JSON 证据见 [cloud-tracing.json](add-api-sentry-tracing/cloud-tracing.json)，发布详情见 [发布记录](../releases/2026-10-15-api-sentry-tracing.md)。未进行真实 5xx 故障注入、source map 上传或通知测试。NODE_ENV 优先意味着 Preview 也可标为 production；两个部署不能仅凭该标签区分。
