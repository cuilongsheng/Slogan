# Pages 同源 API 代理验收

日期：2026-10-05。Change：`implement-pages-same-origin-api-proxy`。状态：**本地验证通过，公网待验收**。

## 基线与交付

基线 `9da06b955aeed3b5c57eda57cc00a604bf77154e`，隔离分支 `codex/pages-api-proxy`，工作树 `/Users/cls/.codex/worktrees/pages-api-proxy/Slogan`。本轮改动未合入 main、未推送或部署；五账号独立工作树没有改动、读取或复制。本轮不修改 API 业务实现、DTO/OpenAPI、数据库、Figma 或视觉。

共享实现为 `scripts/pages-api-proxy.mjs`，构建为 `scripts/build-pages.mjs`。Admin pages 模式不自动读取 dotenv；Expo 构建设置 EXPO_NO_DOTENV=1。移动 Web 专用输出改为已忽略的 `apps/mobile/dist-pages`，不改动历史被跟踪的 dist-web/dist-ios。

| 网站       | 公开 API base（构建时）                             | 运行时上游                                          | 命令                      | 最终输出                 |
| ---------- | --------------------------------------------------- | --------------------------------------------------- | ------------------------- | ------------------------ |
| Admin      | `VITE_API_BASE_URL`：本网站完整 HTTPS origin        | `API_UPSTREAM_ORIGIN`：实际受控 Render HTTPS origin | `pnpm build:pages:admin`  | `apps/admin/dist`        |
| Mobile Web | `EXPO_PUBLIC_API_BASE_URL`：本网站完整 HTTPS origin | 同左                                                | `pnpm build:pages:mobile` | `apps/mobile/dist-pages` |

公开 API base 不带 `/v1`，缺失或不合法时构建失败。上游不含路径、凭证、查询或 fragment，限制为 Render 单层平台域。两个 Pages Functions compatibility date 设 `2026-10-04`。没有新增秘密变量；Google 公开 client ID、API CORS/Google allowlist 等现有键仍按 [部署指南](../deployment/free-preview-deployment.md) 设置。

## 已执行证据

Node `24.21.0`、pnpm `12.3.4`。`NODE_ENV=development pnpm install --frozen-lockfile` 成功，锁文件未修改。pnpm 12 拒绝旧说明的 `--prod=false`，部署文档已修正。

| 检查                                                               | 结果                   | 覆盖                                                                                                                                                                                                                     |
| ------------------------------------------------------------------ | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm test:pages`                                                  | 10/10 通过             | 原始请求字节/查询/方法、认证头、Origin、转发/IP头删除、多个 Set-Cookie/Expires/清除、Domain 拒绝、固定上游、503/502/504、POST 不重放、手动重定向、HEAD/204、流式返回、429 Retry-After、HTML 故障页、公开 base 校验和打包 |
| `pnpm test:pages:browser`                                          | 1/1 场景通过           | Chromium 两个独立 HTTPS 网站，经真实 BrowserAuthController 登录、刷新轮换、旧刷新凭证拒绝/清除、退出、缺失/未授权 Origin、Google redirectUri 匹配、生产 Secure/HttpOnly/Lax/path/host-only 属性                          |
| `pnpm test:pages:runtime`                                          | 1/1 smoke 通过         | workerd `1.20261004.1`，直接读取两站实际 `_worker.js` 并验证与源码一致；原生 fetch 接受请求体流/duplex/no-store，Workers Headers.getAll 保留两个 Cookie，ASSETS 服务绑定、API 404、缺失配置 503、固定上游及重定向拒绝    |
| `pnpm --filter @slogan/admin typecheck` / `test`                   | 通过，1 文件/3 测试    | Admin 受影响配置与既有回归                                                                                                                                                                                               |
| `pnpm --filter @slogan/mobile typecheck` / `test`                  | 通过，42 文件/115 测试 | Mobile 既有认证和产品回归                                                                                                                                                                                                |
| `pnpm build:pages:admin`                                           | 通过                   | fixture HTTPS base；生成页面、资产、Worker、API-only routes                                                                                                                                                              |
| `pnpm build:pages:mobile`                                          | 通过                   | fixture HTTPS base；Web 导出到 dist-pages，同上                                                                                                                                                                          |
| 改动文件 ESLint / Prettier / `git diff --check`                    | 通过                   | scripts、测试、Vite 配置、package、部署说明及 change 文档                                                                                                                                                                |
| `openspec validate implement-pages-same-origin-api-proxy --strict` | 通过                   | 规划/规格结构校验，不作为公网证明                                                                                                                                                                                        |

构建中的 `fixture-admin.pages.dev` 与 `fixture-mobile.pages.dev` 仅为非秘密测试值，不是已注册入口或发布地址。两站产物的 `_worker.js` 均已检查可执行且与最终源码相同；`_routes.json` 为 version=1、include=[/v1,/v1/*]、exclude=[]。代理协议测试进入根 `pnpm test`，浏览器回归进入根 `pnpm test:e2e`；runtime smoke 需先构建两个 Pages 产物再单独运行。

本地 workerd 全局 fetch 出站只绑定 loopback HTTP 上游，并禁用 internet network；ASSETS 是本地服务替身。它验证 Cloudflare 开源运行时语义，没有运行 Pages 公网路由分发/CDN，没有创建 Cloudflare 资源或使用平台凭证。workerd 通过固定版本 `pnpm dlx` 执行，不修改 workspace 依赖/lockfile。浏览器证书为临时本机自签证书，测试后删除；忽略它的 CA 错误不等于验证公网 TLS。

认证测试保留真实控制器、验证管道、认证限流 guard 和错误过滤器；身份与 session 服务是隔离替身，不连接数据库、不执行实际密码散列/RBAC、Google code exchange 或 LiveKit。不能用该测试代替五账号 change 的本地或上线验收。

补充执行 `pnpm deps:check` **失败**：基线 `apps/admin/package.json` 已安装 `@tanstack/react-query`，`scripts/audit-workspaces.mjs` 仍将其列为 deferred 禁止项；两文件和 lockfile 本轮均未修改，已用 `git show HEAD:<path>` 核对。单独运行 `pnpm exec depcruise apps packages --config dependency-cruiser.config.cjs` 通过：648 modules、2543 dependencies，无架构依赖违规。该仓库级基线问题未在代理范围内修复，不能声明 `pnpm verify` 总体通过。

## 风险与待验收

- 实际 Pages 路由、Functions 配置/兼容日期、Render 固定 origin、公网 TLS 和 Cookie 属性待验收；上游地址必须属于用户受控服务，域名格式检查不证明归属。
- 两站原始 Origin 必须同时在 API 的 CORS 与 OAuth allowlist；不自动允许临时 Pages 预览域。API 的来源与 Google redirectUri 校验没有放宽。
- 代理删除客户端 forwarding/IP头，未放宽 Nest trust proxy。未配置可信链时按连接端 IP 限流，可能共享额度；Cloudflare→Render 的真实 IP 归因和伪造头拒绝须公网验证。
- 90 秒为响应首包截止，没有自动 POST 重放。已发出响应后的 body 中断由浏览器感知，不能改写已发出的状态。
- Render 冷启动和内置实时/安全轮询恢复、Neon CU 消耗、Upstash TLS/命令配额/BullMQ 重连、五账号合入 main/独立线上初始化、真实 Google/三人 LiveKit/webhook、备份恢复/应用回滚尚待对应验收；本轮没有将这些项勾选完成。

代理无数据库迁移。回滚同时恢复网站产物及配置到已验证同源版本；没有可用旧版本时关闭入口维护，不能回退为跨站静态直连并宣称刷新有效。账号与数据库的回滚按独立 change 处理。
