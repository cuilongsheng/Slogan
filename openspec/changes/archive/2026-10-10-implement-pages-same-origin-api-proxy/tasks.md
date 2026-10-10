## 1. 代理与构建

- [x] 1.1 实现共享固定上游 Worker；验证字节、查询、方法、认证头、Cookie、无缓存及静态路由。
- [x] 1.2 实现失败关闭、首包截止、重定向和 hop-by-hop/IP头策略；测试配置/网络错误、超时、不自动重放和外域拒绝。
- [x] 1.3 接入两站 Pages 构建，校验公开 HTTPS origin 并打包 worker/routes；验证配置拒绝和两站真实最终产物。

## 2. 认证与运行说明

- [x] 2.1 经真实 BrowserAuthController 和隔离服务替身进行 Chromium 两站会话验证：登录、刷新轮换、退出、跨源拒绝、Google redirectUri、生产 Cookie 属性；记录替身限制。
- [x] 2.2 更新部署说明为最终命令/配置和 Upstash TLS Redis，记录免费额度、轮询、可信代理、回滚及公网待验收；核对代码键名与官方资料，不操作线上资源。

## 3. 验证

- [x] 3.1 执行完整受影响范围验证一次：代理/构建自动化、认证浏览器测试、workerd 实际产物 smoke、两站 build/typecheck/unit、改动 lint/format 和 OpenSpec strict；记录证据和平台待验收边界。
