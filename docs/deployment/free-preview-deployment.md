# 免费网页试用部署

更新时间：2026-10-03。状态：`planned / not deployed`。

本文用于招聘方面试试用和海外用户的首轮网页测试，不表示正式生产上线。当前已注册 Cloudflare、Render、Neon 账号，尚未创建线上资源。仓库为 [cuilongsheng/Slogan](https://github.com/cuilongsheng/Slogan)，部署分支已确定为 `main`；2026-10-03 核对的 `9da06b9` 已包含最新前端和浏览器认证。每次发布仍需记录当时实际 commit。待实现方案须通过适用的 OpenSpec 实施与验收，本文不替代需求或实际执行授权。

首轮复用现有 Google OAuth 和 LiveKit Cloud；邮件发送停用，AI 配置暂停，相关功能保持关闭。不购买服务器或独立域名。本文只记录部署步骤，未执行资源创建、迁移、账号初始化或部署。

## 现在从哪里开始

账号注册完成后，还需要创建平台资源。建议按下表推进，不用一次操作全部平台。

| 顺序 | 操作 | 当前阶段 |
| --- | --- | --- |
| 1 | 本地实现并测试五账号方案、密码与邮件开关拆分 | **等待代码完成**；另一个聊天正在实施，尚无完成证据 |
| 2 | 选地域，创建 Neon 免费 Project/Postgres | **现在用户可做**；先建空库，不迁移或导入本地数据 |
| 3 | 同地域创建 Render 免费 Key Value，选择 `noeviction` | **现在用户可做** |
| 4 | 完成同源 API 转发、冷启动/任务恢复适配，并将发布代码合入 `main` | **等待代码适配** |
| 5 | 准备 Render Web Service、Cloudflare 两个 Pages 的创建设置与线上配置 | **代码适配后操作**；最终创建/Save and Deploy 会触发构建部署 |
| 6 | 核对已创建的 Neon 目标后迁移、独立初始化线上五账号 | **数据库创建后执行**；使用届时验证过的运行说明，不等待 API 对外开放才迁移 |
| 7 | 完成 API/Pages 创建部署，验证登录、三人语音、公网 webhook、重连和失败恢复 | **待验收** |

可以先准备项目名和打开创建表单；API/Pages 配置未齐时，不必为了获得地址反复触发失败部署。资源名称以下只作建议，平台域名以实际返回为准。

## 资源与入口

| 平台 | 建议名称/资源 | 用途 |
| --- | --- | --- |
| Neon | `slogan-preview` Project；一个数据库 | 持久化身份、房间、权限、审计等事实 |
| Render | `slogan-preview-redis` Key Value | Redis 兼容协调、presence、限流、BullMQ |
| Render | `slogan-preview-api` Web Service | NestJS API 及当前进程内的实时/安全队列消费者 |
| Cloudflare | `slogan-preview-mobile` Pages | 移动 Web，平台 HTTPS `pages.dev` 地址 |
| Cloudflare | `slogan-preview-admin` Pages | PC 后台，独立平台 HTTPS `pages.dev` 地址 |

两个 Pages 项目分别需要同源 `/v1/*` API 转发到 Render。该转发拟用 Pages Functions 实现，不需要再购买域名或创建独立 API 服务器。当前尚无代理文件或最终打包命令；这是待实现方案。真实音频由浏览器直接连接 LiveKit Cloud。

## 1. 发布代码与本地账号前置

- [五账号提案](../../openspec/changes/add-preview-experience-accounts/proposal.md)、[设计](../../openspec/changes/add-preview-experience-accounts/design.md)、[任务](../../openspec/changes/add-preview-experience-accounts/tasks.md)：后台一名 `PLATFORM_ADMIN`、一名 `SAFETY_OFFICER`，移动三个普通用户。房主由正常创建房间产生，不是全局账号角色。
- 先在本地创建和测试，不等待 Neon。局部实现、任务勾选、本地账号存在，都不能替代线上初始化与验收证据。
- 线上使用独立环境标识和独立秘密输入重新初始化；不复制本地数据库、密码散列、session 或角色记录。现有测试 fixture 不是线上 seed，禁止复用全表清理流程。
- 当前密码登录仍受 SMTP 配置门控；完成开关拆分后，才可以在无邮件环境启用它。拟新增的 `EMAIL_AUTH_MAIL_ENABLED` 以最终实现为准；不存在的账号 CLI 不在本文编造命令。
- `main` 必须包含已验证的账号/代理实现、迁移、唯一 OpenAPI 与生成客户端。构建从源码生成，不上传本地 `dist` 作为发布依据。
- 目前 `dist-web` 和 `dist-ios` 曾被提交，应在后续代码整理中解除 Git 跟踪并加入忽略规则，保留本地所需产物。保持 `.env`、Prisma 生成实现、原生 `ios/android` 生成目录不入 Git；设计资产和验收截图不机械删除。

## 2. Neon：创建空的免费 PostgreSQL

1. 在 [Neon Console](https://console.neon.tech) 选择创建 Project，确认账号仍为 Free。
2. 项目名可用 `slogan-preview`；PostgreSQL 建议选 **17**，与仓库隔离测试的 PostgreSQL 17 基线一致。不要直接导入本地开发库。
3. 先对照 Render 可选地域，再选择同城或邻近的 Neon 地域。例如两端均提供时选 Oregon 或 Frankfurt；最终选项以控制台为准。Render API 与 Key Value 必须同地域，Neon 与它们尽量接近。参见 [Neon 地域](https://neon.com/docs/introduction/regions)。
4. 保留免费计算和自动休眠；先用最小计算规模，检查自动扩缩上限。数据库分支是 Neon 的资源概念，不必与 Git `main` 同名。
5. 在连接面板选择实际 branch/database/role，分别私下保存 **pooled** 与 **direct** 连接串。保留平台要求的 TLS 参数，如 `sslmode=require`；不要关闭 TLS 或证书校验来绕过连接失败。
6. 此时只记录项目名、地域、Postgres 版本及空库状态；连接串包含密码，不贴进 Git、截图、部署记录或普通日志。

运行时 `PrismaPg` 读取 `DATABASE_URL`；建议用 pooled 连接。迁移、备份和恢复使用 direct 连接。当前 [Prisma 配置](../../apps/api/prisma.config.ts) 同样读取 `DATABASE_URL`，**没有独立的 direct URL 配置**：执行迁移时在专用进程中注入 direct URL，API 进程仍使用 pooled URL，不随意互换。启动校验要求 URL 以 `postgresql://` 开头。SSL、连接池、事务和连接恢复须在目标环境验证，不能从候选兼容性推出已连接成功。[连接说明](https://neon.com/docs/connect/connect-from-any-app)

## 3. Render：先创建免费 Key Value

1. Dashboard → **New → Key Value**。
2. 名称可用 `slogan-preview-redis`，Region 与未来 API 服务相同，compute plan 明确选择 **Free**。
3. Maxmemory Policy 选 **`noeviction`**，不是缓存用途的 `allkeys-lru`；内存耗尽时写入会报错，需要观察并处理，不能靠驱逐队列数据腾空间。
4. 创建后，从 Connect 面板私下保存 internal URL，稍后注入 API 的 `REDIS_URL`。API 与 Key Value 同工作区、同地域时优先走内部连接；外部连接只在确有需要时限制来源，并使用平台 TLS URL。
5. 记录资源名、地域、计划和策略。不要输出 URL 内的认证信息。

新实例是 Redis 兼容的 Valkey。免费实例无持久化，重启会丢失全部协调/队列数据；它不是数据库备份。参考 [Key Value 创建、连接与策略](https://render.com/docs/key-value)。

## 4. Render：代码和配置齐备后创建 API

Dashboard → **New → Web Service**，连接 GitHub，仅授予所需仓库访问范围，选择 `cuilongsheng/Slogan`。Google 登录平台账号不等于已经连接 GitHub。

| 字段 | 设置 |
| --- | --- |
| Branch | `main`，再次核对 commit 含本轮已验收实现 |
| Runtime | Node |
| Region | 与 Key Value 一致 |
| Root Directory | 仓库根，留空；不要仅选 `apps/api`，需要 workspace/lockfile |
| Instance Type | Free |
| Build Command | `npm install --global pnpm@12.3.4 && pnpm install --frozen-lockfile --prod=false && pnpm --filter @slogan/api build` |
| Start Command | `pnpm --filter @slogan/api start` |
| Auto-Deploy | 首轮建议 Off，迁移和验收准备完成后手动发布 |
| Health Check | 当前先使用默认 TCP；不要填不存在的 `/health` |

以上是待平台验证的配置，本文没有执行。`--prod=false` 保留构建需要的开发依赖；[API build](../../apps/api/package.json) 已先执行 `prisma generate`，再执行 Nest build。无需安装终端数据库或运行 Docker 测试来启动服务。

环境中设 `NODE_VERSION=24.21.0`、`NODE_ENV=production`、`APP_HOST=0.0.0.0`；让 `APP_PORT` 与 Render 的 `PORT` 一致，例如默认 `10000`。当前应用读取 `APP_PORT`，不会自动读取 `PORT`。其他配置见下表。填写齐全且完成第 7 节目标数据库迁移后，才点创建 Web Service；创建会开始首次构建。启动成功后验证实际进程内存与三人负载，Free 的 512 MB/0.1 CPU 只是平台规格，不是项目容量证明。

当前没有匿名 HTTP readiness endpoint；后台受保护的 operations health 不能拿来作公开探针。后续需要 HTTP readiness 时先实现再配置。参考 [Web Service](https://render.com/docs/web-services)、[Node 版本](https://render.com/docs/node-version)、[健康检查](https://render.com/docs/health-checks)。

### API 最小配置表（只列键名，不保存凭证）

| 键名 | 用途/填写时机 |
| --- | --- |
| `NODE_VERSION`, `NODE_ENV`, `APP_HOST`, `APP_PORT` | 构建版本、生产模式与监听地址；服务创建时填写 |
| `APP_NAME` | 现有 start script 已设 `slogan-api` |
| `DATABASE_URL`, `REDIS_URL` | 创建资源后通过平台配置注入；不改本地 `.env` |
| `JWT_ACCESS_SECRET`, `REFRESH_TOKEN_PEPPER`, `ROOM_PASSWORD_PEPPER` | 三个独立的 32+ 字符部署秘密，安全生成并私下保存 |
| `ROOM_RULES_VERSION`, `ROOM_SHARE_BASE_URL` | 已批准规则版本；移动 Pages 的实际 HTTPS origin，根地址无查询/fragment |
| `CORS_ALLOWED_ORIGINS` | 两个稳定 Pages HTTPS origin 的明确 allowlist，逗号分隔，不用 `*` |
| `GOOGLE_OAUTH_ENABLED`, `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_OAUTH_REDIRECT_URIS` | 复用现有 Web OAuth client；启用 Google，服务器 secret 仅在 API；allowlist 含两个实际 Pages origin |
| `REALTIME_ENABLED`, `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` | 启用语音，复用已有 LiveKit Cloud WSS 项目；管理凭证仅在 API |
| `EMAIL_PASSWORD_AUTH_ENABLED` 和最终邮件/体验配置 | 无 SMTP 密码登录需等待五账号方案实施；按该方案最终 runbook 填写秘密与环境标识，不能用当前开关绕过校验 |
| `EMAIL_AUTH_TRUSTED_PROXIES` | 如启用来源 IP 限流，按实际代理链确认可信 IP/CIDR；不信任任意客户端提供的转发头，未知时待部署适配确认 |
| `PHONE_AUTH_ENABLED`, `WECHAT_OAUTH_ENABLED` | 首轮关闭 |
| `ASSISTANCE_ENABLED`, `ASSISTANCE_AUDIO_ENABLED`, `ROOM_SPEECH_DETECTION_ENABLED`, `POST_ROOM_KEYWORDS_ENABLED` | 首轮均关闭；不配置/调用大模型，不动已有本地 AI 字段 |
| `OPERATIONS_GOVERNANCE_ENABLED` | 首轮先关闭，不启动额外治理任务；后续单独验收启用 |

所有 `EXPO_PUBLIC_*`、`VITE_*` 都会进入浏览器构建，不能存数据库、OAuth secret、LiveKit 管理 key/secret 或账号密码。

## 5. Cloudflare：两个 Pages 项目与同源 API

### 先完成同源转发

当前 [浏览器认证](../../apps/api/src/modules/auth/presentation/browser-auth.controller.ts) 的刷新 Cookie 为 `HttpOnly`、`SameSite=Lax`，生产环境 `Secure`。直接从 `pages.dev` 调用 `onrender.com` 是跨站请求，不能靠 CORS 和 `credentials: include` 解决刷新 Cookie。[浏览器凭证规则](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch#including_credentials)

待实现转发需让两个 Pages 网站各自的 `/v1/*` 请求到固定 Render API，保留方法、路径、查询、请求体、原始 Origin、Authorization、Cookie 和响应 Set-Cookie，认证响应禁止缓存；固定上游，不能让访客指定任意转发目标。可信代理和来源限流需一并验证。仅 API 路径执行 Function，静态资产继续走 Pages。

可用 Pages Functions，或在构建输出中打包 advanced-mode worker；**最终路径、环境键名和代理打包命令尚未实现**。不要声称以下静态 build 已包含代理，也不要把 `_redirects` 的外部重定向当作反向代理。参考 [Functions](https://developers.cloudflare.com/pages/functions/get-started/)、[advanced mode](https://developers.cloudflare.com/pages/functions/advanced-mode/)。

### 创建与静态构建设置

代码准备后，在 Workers & Pages → **Create application → Pages → Connect to Git**，授权 Slogan 仓库。同一仓库分别创建移动和后台两个项目；Production branch 都选 `main`，Root Directory 都使用仓库根，preset 可选 None。官方流程的 **Save and Deploy 会实际部署**，不是只保存项目名。[Git integration](https://developers.cloudflare.com/pages/get-started/git-integration/)

| 设置 | 移动 Web | PC 后台 |
| --- | --- | --- |
| Build Command（当前静态部分） | `pnpm install --frozen-lockfile --prod=false && pnpm --filter @slogan/mobile exec expo export --platform web --output-dir dist-web` | `pnpm install --frozen-lockfile --prod=false && pnpm --filter @slogan/admin build` |
| Build Output Directory | `apps/mobile/dist-web` | `apps/admin/dist` |
| 公开 API base 配置 | `EXPO_PUBLIC_API_BASE_URL` | `VITE_API_BASE_URL` |
| Google 公开 client ID | `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | `VITE_GOOGLE_WEB_CLIENT_ID` |

两项目都设 `NODE_VERSION=24.21.0`、`PNPM_VERSION=12.3.4`、`SKIP_DEPENDENCY_INSTALL=1`，由上表命令按锁文件安装；mobile 可设 `EXPO_NO_DOTENV=1`，只读取平台注入的公开变量。[构建工具版本](https://developers.cloudflare.com/pages/configuration/build-image/)

代理实施后，各自 API base 填各自 Pages **完整 HTTPS origin**，不额外加 `/v1`；[生成客户端](../../packages/api-client/src/index.ts) 要求绝对 URL，接口路径已带 `/v1`，不能填 `/`。两个前端 Google client ID 与 API 的 Web client ID 一致。当前 mobile `build` script 导出 iOS，不用它代替 Web export。官方 [Web export](https://docs.expo.dev/router/web/static-rendering/) 支持指定 Web 平台。

完成代理打包后更新上表为最终 build，检查输出有 `index.html`、JS/资产和实际代理产物。当前 Web 导出以单页应用为基础；没有顶层 `404.html` 时 Pages 可作 SPA 回退，但 `/v1/*` 必须由代理处理，不能回退成 HTML。实际验证直接打开/刷新 `/sign-in`、`/rooms`、房间详情和 `/r/...` 分享链接，及后台受保护路由。[Pages 路由规则](https://developers.cloudflare.com/pages/configuration/serving-pages/)

## 6. 线上地址、Google 与 LiveKit

1. 得到三个实际 HTTPS origin 后，在两个前端构建配置、API CORS、Google redirect allowlist、房间分享 origin 和代理固定上游分别填入正确地址；改公开构建变量后重新构建，改 API 配置后重新部署。
2. 复用现有 Google Web OAuth client，在 Authorized JavaScript origins 加两个稳定 Pages origin。当前是 code popup：前端传 `window.location.origin`，不是虚构 `/auth/callback`；按 Google code-model 与当前 adapter 核对 redirect/origin 配置，再做真实登录。平台账号的 Google 登录和 Slogan 的 OAuth 是两件事，不自动关联。[Google code model](https://developers.google.com/identity/oauth2/web/guides/use-code-model)
3. 在现有 LiveKit Cloud 项目配置实际 Render API 的 `/v1/webhooks/livekit` HTTPS URL，使用服务端对应的签名凭证。当前 raw webhook body 和 SDK 验签需保留；不要在代理或中间件提前解析、重写 body。LiveKit 管理凭证不能进前端。验证合法、非法签名和重复事件，不能只证明 URL 可访问。[LiveKit webhook](https://docs.livekit.io/intro/basics/rooms-participants-tracks/webhooks-events/)
4. 首轮只授权稳定 Pages origin；临时预览子域不是自动受信入口。公网验收中记录脱敏 URL 与结果，不保留 authorization code、Cookie、token 或签名值。

## 7. 迁移、线上账号与回滚

以下命令来自现有 scripts，**只在明确目标、完成备份/恢复准备并另行执行发布时使用**，本文没有运行。先在仓库根 `nvm use`；专用执行进程安全注入目标 direct `DATABASE_URL`，先核对环境与库身份，不回显连接串。Prisma CLI 不会自动加载 Nest 的 `apps/api/.env`，未注入时配置会回退本地库，所以不能直接裸跑迁移。

```bash
DATABASE_URL="${DATABASE_URL:?先安全注入并核对目标 direct 连接}" pnpm --filter @slogan/api db:migrate:status
DATABASE_URL="${DATABASE_URL:?先安全注入并核对目标 direct 连接}" pnpm --filter @slogan/api db:migrate:deploy
DATABASE_URL="${DATABASE_URL:?先安全注入并核对目标 direct 连接}" pnpm --filter @slogan/api db:migrate:status
```

Free Render 没有 paid pre-deploy command、Shell 或 one-off jobs。首轮用明确目标的受控本地发布进程执行迁移，记录成功后再手动部署 API；后续自动化路径另行确定。不在前端 build、API build 或每次启动中偷偷加迁移/seed。[部署命令限制](https://render.com/docs/deploys)

线上五账号初始化使用账号 change 最终实现的 dry-run/初始化/角色分离命令，**当前不提供不存在的 CLI**。现有 `backoffice:bootstrap` 只给已有用户授后台角色，不能创建五账号，也不能保证管理员与安全员已分开。初始空库不得导入本地账号；真实用户名与密码通过确定的秘密渠道输入和交付。

已有 `backup:postgres`、`restore:postgres`、`recovery:check`，见 [恢复运行说明](../operations-data-governance-runbook.md)。备份需要 PostgreSQL 客户端工具、显式输出与完整备份策略。当前 backup script 生成 pg_dump 并记录 encryption key ID，**本身不加密文件**：实际加密、私有保存和保留期限必须完成并验证，不把 Render 临时文件系统当备份盘。恢复只对新建隔离库，外部 provider 禁用；不能覆盖活动库。

迁移前记录可恢复点和旧 commit/配置；应用回滚与数据库回滚分开。五账号来源/nullable verifiedAt 迁移可能不兼容旧二进制，按其设计验证回滚边界，不随意执行破坏性 down migration。发布失败时停止流量或关闭相关能力，恢复已验证兼容的版本；重新核对角色、会话、房间和审计不变量。

## 8. 免费限制与任务恢复

| 项目 | 限制及首轮动作 |
| --- | --- |
| Render API | 15 分钟无入站流量后休眠，唤醒约一分钟；每工作区每月 750 免费实例小时。创建一个 API，不额外创建付费 worker；预算耗尽/资源超限可能暂停服务 |
| Render Key Value | Free 为 25 MB、50 连接，无持久化；`noeviction` 满时写入失败。验证断连、重启丢数据后由 PostgreSQL 重建队列，不恢复过期资格 |
| Neon | 2026-10-02 新公告已升为每项目 **1 GB** 数据库容量，仍为每月 **100 CU-hours**；保留空闲休眠，监控计算/容量，不沿用旧 0.5 GB 快照 |
| Pages Functions | 与 Workers Free 共用每天 100,000 请求；静态资产免费且不限请求。代理只覆盖 API，观察限额失败和冷启动错误 |
| LiveKit Cloud | 复用现有项目，实际计划/分钟/传输等额度以该项目 Dashboard 为准；本轮未核对账号用量，不承诺无限免费音频 |

参考 [Render Free](https://render.com/docs/free)、[Render 规格](https://render.com/docs/compute-plans)、[Neon 2026-10-02 更新](https://neon.com/blog/neon-free-plan-1-gb-per-project)、[Pages Functions 额度](https://developers.cloudflare.com/pages/functions/pricing/)。不升级付费计划或开通额外付费服务；创建页面若显示收费，先停止核对。

接受冷启动不等于接受定时任务失效。当前 realtime/safety runner 每 15 秒访问数据库：API 醒着时会阻止 Neon 空闲休眠；API 睡着时预约开房、关房及安全处理暂停，需唤醒后恢复。按 0.25 CU 常驻 30 天推算是约 180 CU-hours，超过 100 免费额度；不要用无限保活规避休眠。

部署适配必须验证：空闲时能休眠，唤醒后补偿处理截止时间/持久命令，Redis 丢失后重建，不放行旧成员/旧 token。LiveKit 的独立音频连接本身不保证 Render 始终醒着。首轮无人访问期间的后台任务时效若仍无法保障，明确记为试用限制，不能声明满足 24×7 正式发布要求。额外邮件、语音处理和治理 worker 首轮不启动；这不代表内置实时/安全轮询已经关闭。

## 9. 验收与发布记录

所有项目前仍为 **待验收**。使用三个独立浏览器上下文和两个独立后台账号，按顺序记录：

1. HTTPS、直接链接和刷新路由可用；API 返回正确 JSON，代理没有把错误变成 HTML；冷启动有可理解的等待/重试，正常请求能恢复。
2. 正常密码与真实 Google 登录；未知/错误密码拒绝；邮件入口和直接邮件路由在停用时不产生假成功。刷新页能恢复 HttpOnly 会话，退出后不可恢复；token 不落普通浏览器存储。
3. 管理员/安全员职责分开，移动普通用户无后台权限；绕过 UI 直接调用也被后端拒绝。
4. 三个移动普通用户：一人正常建房、两人加入，真实麦克风发布/收听；验证静音、退出、房主结束、结束后换人建新房。
5. 踢人后旧 token/旧凭证不能重入；房间结束后所有旧凭证失效。网络断开、刷新和重连需重新确认成员资格。
6. 公网合法 webhook 经过验签并处理，非法签名拒绝、重复事件幂等；确认最终房间与成员状态，而非只看 HTTP 200。
7. 主动等待空闲休眠并唤醒，验证预约/到期/安全恢复；在受控试用环境验证 Redis 中断/丢数据恢复和资源限额失败。实际备份、隔离恢复和应用回滚可执行。

在 [docs/releases](../releases/README.md) 新建实际试用发布记录，例如 `free-preview-2026-10-03.md`（该文件目前未创建）。按记录规范填写状态、commit、非敏感资源名/地域/HTTPS origin、相关 change、迁移结果、独立线上账号初始化结果、验收证据、资源使用与限制、回滚点。创建资源不能标 `deployed`；完成适用验收后才记录真实发布状态。网页证据与原生真机、真实 SMTP、AI、正式生产验收保持独立。
