## Context

Admin 与 Expo Web 客户端均要求绝对 API base URL，接口路径自带 `/v1`。现有 BrowserAuthController 校验原始 Origin 同时属于 CORS 与 Google allowlist，并要求 Google redirectUri 与 Origin 相等；生产刷新 Cookie 为 HttpOnly、Secure、SameSite=Lax、Path=/v1/auth/web，无 Domain。Render 与 Pages 之间跨站，采用每站同源代理。

## Goals / Non-Goals

目标：两站构建可重复生成同一 Worker 与 API 路由，保留字节、状态码、会话和来源安全边界。非目标：视觉/业务认证改动、开放注册、原生应用代理、外部资源或真实 provider 验收、调度恢复。

## Decisions

- `scripts/pages-api-proxy.mjs` 是无依赖 Worker 源，构建复制为 `_worker.js`，`_routes.json` 仅 include `/v1` 与 `/v1/*`；其余请求交给 ASSETS。采用官方 advanced mode，不用外部 `_redirects` 重定向。
- `API_UPSTREAM_ORIGIN` 为 Pages 运行时配置，只接受无凭证/查询/fragment/非默认端口的单层 `https://*.onrender.com` origin。访客无法指定目标，配置错误立即 503；静态页面仍可用。
- `build:pages:admin` 与 `build:pages:mobile` 校验对应公开 API base 是完整 HTTPS origin，拒绝带 `/v1` 或路径的值。公开 API base 必须填各自稳定 Pages origin；构建关闭 dotenv 自动加载，复制 Worker 和路由后校验产物。上游是运行时配置，不写入浏览器 bundle。
- 原始方法、查询、请求体流、Origin、Authorization、Cookie 保留；删除 hop-by-hop 及其 Connection 声明字段、Host、内容长度和客户端转发/IP头。API 的可信代理和限流配置不放宽；未配置可信代理时仍按连接端 IP 限流，可能共享额度。真实客户端 IP 归因需发布时验证实际链，不允许任意 X-Forwarded-For。
- 请求使用 no-store，响应覆盖为 private, no-store，并移除实体缓存验证头。不读取或打印凭证、不记录请求/响应。90 秒首包截止允许 Render 冷启动；网络失败 502，截止 504，无重试，避免重复 POST。Render HTML 可用性页面转换为脱敏 JSON（保留 5xx，异常 2xx/4xx HTML 返回 502）。返回流不缓冲，已发出响应后 body 中断由浏览器感知，无法改写状态；HEAD/204/304 无 body。
- 手动处理重定向，不向任意重定向目标发送 Cookie/Authorization；仅允许固定上游或本网站的 API Location，重写为本网站 origin。外域、非 API、非 HTTP(S)、含凭证 Location 失败关闭为 502。现有 API 没有需要跨域重定向的端点。
- Set-Cookie 用 Workers getAll 或 Node getSetCookie 分条读取/append，绝不按逗号分割。现有 host-only Cookie 原样保留；任何 Domain 属性拒绝，避免上游域 Cookie 在 Pages 静默失效或扩大作用域。不改 Path、SameSite、Secure、HttpOnly、Expires；多个 Cookie 和清除语义保留。
- API 契约无 schema 改动，保持唯一 OpenAPI，不引入第二份。Redis 只更新到 Upstash 免费候选与原生 TLS REDIS_URL；不换客户端，不验证远程凭证，不保证免费额度可承载持续 BullMQ 轮询。

## Risks / Trade-offs

新 Worker 将认证凭证转发给唯一已配 Render 上游，配置需只给受控服务；不可只以 TLS 域名证明资源归属。代理故障将使两个网页 API 失败。Pages/Workers 免费配额、Render 冷启动、Neon 计算时长及 Upstash 命令额度仍需公网证据。Upstash 即使队列空闲也可能有 BullMQ 命令流量，不能据兼容性承诺预算或可靠性。

## Migration Plan

无数据库迁移。需五账号 change 单独合入 main。创建 Pages 时填各自公开 base/Google client，运行时 API_UPSTREAM_ORIGIN；API 的 CORS/OAuth allowlist 含两站稳定 origin。临时预览域不自动授权。发布前核对实际地址并完成独立线上账号初始化；本轮不执行。

回滚必须同时回滚网页产物和公开/运行时配置到已验证版本；保留同源认证拓扑，不能将旧静态产物直接指向跨站 Render 宣称会话正常。无已验证版本时禁用网页入口并返回维护状态。上游/API/数据库回滚独立，不删除或复制账号数据。

## Verification

使用 workerd 1.20261004.1、compatibilityDate=2026-10-04 运行两站实际 `_worker.js`；ASSETS 和上游只绑定本地测试服务，不接触平台账户。自动化验证请求字节/方法/查询/头、多个 Cookie、HEAD/204、错误/冷启动截止、固定上游、重定向及静态/API 路由。以现有真实 BrowserAuthController 和测试身份/session 服务运行本地 HTTP，再经 Worker 转发，用 Chromium 验证两站登录/刷新轮换/退出/跨源拒绝和生产 Cookie 属性。服务替身仅提供隔离身份，不能证明密码算法、真实 OAuth、DB/RBAC 或线上冷启动。

构建两站最终 Pages 产物，检查实际 index/worker/routes；执行改动文件 lint/format、前端 typecheck 及单元测试和代理测试一次。记录命令与结果到验收文件。无视觉变化，无新增真机验收；公网 Pages/Render、TLS Cookie、Google/LiveKit、上游来源 IP 和额度保持待验收。
