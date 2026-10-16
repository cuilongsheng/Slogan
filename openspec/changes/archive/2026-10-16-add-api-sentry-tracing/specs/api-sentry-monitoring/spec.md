## Purpose

为 Slogan API 提供可控的线上错误监控和采样追踪，保持 HTTP 错误合同、受保护信息边界及当前平台入口兼容，确保本地验证不会被误认为云端上线。

## ADDED Requirements

### Requirement: API monitoring scope and configuration

API SHALL 仅发送 Error Monitoring 与采样 Tracing，使用环境变量提供连接配置和 0 至 1 的采样率；Preview 未指定时采样率为 0.1。环境优先采用 NODE_ENV，发布标识可采用平台提供的 commit SHA。

#### Scenario: Optional connection and bounded sampling

- **WHEN** 未设置 DSN，或 Preview 设置 DSN 但未设置采样率
- **THEN** 前者不初始化监控，后者以 0.1 采样；非法采样配置以不含原值的错误拒绝启动

#### Scenario: Restricted telemetry

- **WHEN** 错误或 span 将被发送
- **THEN** 不发送 Logs、Profiling、Application Metrics、请求正文、凭据、用户信息、SQL 或内容数据；后台错误不含 stack

### Requirement: Existing runtime compatibility

API SHALL 复用现有全局异常过滤器，保持原有 HTTP 响应和 Vercel NestJS 入口；不得增加公开测试接口、重复全局 filter 或改变业务结果。

#### Scenario: Existing exception responses

- **WHEN** 发生预期业务拒绝或非预期服务端错误
- **THEN** 保持原有响应；前者不生成错误事件，后者通过现有 filter 的官方捕获装饰器产生一次去敏事件

#### Scenario: Local platform verification

- **WHEN** 本次实现交付
- **THEN** 完成 API build/typecheck/lint/test 和本地 Vercel 打包，提交到 develop，不 push、merge 或 deploy；远端送达不计为已验证
