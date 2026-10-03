## Context

动机与确认范围见 `proposal.md`。本 change 为认证/授权 Level 2，仅完成规划，不连接任何实际数据库。

已读代码显示：

- `EmailAuthService.login()` 校验用户名和密码、消费 Redis 配额，经正常 `SessionService` 建立会话，不发送邮件。`environment.ts` 的 `EMAIL_PASSWORD_AUTH_ENABLED` 却要求 SMTP、AES/HMAC 密钥环、可信邮件链接和 Redis；邮件请求、配额实例和 worker 也共用此开关。
- `EmailCredential.verifiedAt` 非空，正常注册只有邮件确认后才创建正式 User/credential。`EmailCredentialView` 与会话签发需同步识别凭据来源，不能仅因数据库存在一行就放行无验证凭据。
- `/v1/me/login-methods` 的 `verifiedAt` 当前非空，controller 调用 `toISOString()`；因此新增来源并让体验账号验证时间为空必须联动 domain、repository、DTO、OpenAPI 和生成客户端。
- 两个 Web 应用均已有 `/v1/auth/web/password/exchange` 与 Google 登录；后台 `SignInView` 已有密码表单，登录后通过 `/v1/backoffice/me` 验证实时角色，不存在“后台仅 Google”的冲突。
- Web 密码、Google、刷新和退出都经 `BrowserAuthController.requireOrigin()`；现有实现要求来源同时匹配 `GOOGLE_OAUTH_REDIRECT_URIS` 与 `CORS_ALLOWED_ORIGINS`，不能只配 CORS 后声称密码会话可用。
- 后台四角色为 `PLATFORM_ADMIN`、`SAFETY_OFFICER`、`OPERATIONS_ANALYST`、`AUDITOR`；本 change 只使用前两个。管理员不自动有安全处置权，安全员不自动有角色管理权。
- 当前 bootstrap 给首个 ACTIVE 用户同时授予管理员和安全员，且仅在最终仍有两角色时支持同一目标重试。角色 grant/revoke 是有原因、请求 UUID、审计、最新权限重查和最后管理员保护的现有能力。
- `seedAdult()` 等仅为隔离测试 fixture；相关 cleanup 含全表删除，不能作为实际环境 seed/清理工具。现有 API scripts 没有普通体验账号命令。
- active email/mobile/admin changes 尚未完全同步；发布准备文档提及较宽的无邮件注册/恢复，但它不是当前需求授权。本 change 仅为限定试用模式，普通用户邮件验证要求不变，Google 新用户继续现有 onboarding。

## Goals / Non-Goals

**Goals:**

使用现有认证和持久 RBAC，通过明确的预置来源与环境绑定提供五个独立账号；邮件关闭可安全运行，账号创建、角色初始化和清理可核对并恢复。所有可执行数据库、凭证和环境操作放在审核后实施/运维阶段。

**Non-Goals:**

不引入新认证系统、公开 seed API、全局房主角色、永久演示房间或无邮件账号恢复服务；不修改后台权限矩阵，不自动合并 Google 与密码身份，不把当前源代码/CLI 验证作为公网、SMTP 或真机证明。

## Decisions

### 1. 独立配置密码与邮件，保持旧配置兼容

新增邮件流程开关 `EMAIL_AUTH_MAIL_ENABLED`。旧部署未显式设置时按 `EMAIL_PASSWORD_AUTH_ENABLED` 推导，以保持已有邮件模式；本次试用必须显式设为 false。旧密码开关保留，控制正常密码登录、Redis/HMAC 配额、密码注销 proof 与会话边界；邮件为 true 但密码为 false 属于非法组合并启动失败。

新增 `PREVIEW_ACCOUNTS_ENABLED`（默认 false）、`PREVIEW_ENVIRONMENT_ID`（显式环境绑定，无默认实际数据库），初始化命令同时要求操作者明确提供目标连接与同一环境标识。公开试用仍使用 `NODE_ENV=production` 的 Cookie/TLS 安全行为，不借 `NODE_ENV=test` 或 `LOCAL_TEST` 放宽校验。

| 模式 | 密码开关 | 邮件开关 | 体验开关 | 启动必需配置 |
| --- | --- | --- | --- | --- |
| 全关闭 | false | false | false | 原 API 基础配置 |
| 普通邮箱模式 | true | true | false | Redis、HMAC/AES、SMTP、固定可信验证/重置 URL |
| 本次试用 | true | false | true | Redis、HMAC、明确体验环境标识；无需 SMTP/AES/邮件 URL |

基础配置继续包含 PostgreSQL、JWT 签名/issuer/audience、refresh pepper、CORS 和原房间配置；Google 使用独立 `GOOGLE_OAUTH_ENABLED`、client ID/secret、redirect 白名单及两端前端 client ID。trial 时保留 Google 配置，不重构 origin 机制。真实三人语音另需 LiveKit、Redis、HTTPS 和公网 webhook，不能通过初始化账号宣称已满足。

备选“填假 SMTP 配置但不启动 worker”仍开放邮箱申请和回收积压，不能满足邮件停用；关闭现有总开关会同时关闭密码，故不采用。

### 2. 单一密码凭据模型，来源和验证事实分开

扩展现有 `EmailCredential`，加入 `origin`（`EMAIL_VERIFIED` / `PREVIEW_PROVISIONED`），允许 `verifiedAt` 为 null；新增环境/账号槽位的受控初始化记录，关联现有 User 与凭据，用唯一 `(environmentId, slot)` 和唯一 userId 保证五个独立身份。记录包含创建/完成/退役时间、初始化批次和角色阶段命令 ID，不包含密码、hash 快照、token、完整邮箱或真实数据库 URL。

- 既有凭据回填 `EMAIL_VERIFIED`，保留原 `verifiedAt`，不变更 password hash/version 或 session。
- 新体验凭据为 `PREVIEW_PROVISIONED`、`verifiedAt=null`，真实 provision 时间在专用记录中。创建仅来自受控命令；注册/验证 API 不接受 origin、环境、槽位或角色输入。
- 因现有 email 字段及唯一索引仍必需，体验凭据使用命令生成的独立不可投递内部占位地址（保留 `.invalid` 域），不冒用第三方邮箱，不代表任何邮箱所有权。实际映射不写 Git/日志，普通 API 仍脱敏。
- 登录允许正常已验证 ACTIVE 凭据，或开关开启、环境匹配且受控记录有效的 ACTIVE 体验凭据。预置例外仅适用于五个已登记身份；pending 注册、伪造来源、缺初始化记录、注销/禁用、跨环境账号一律拒绝。来源判断覆盖会话签发、refresh 与 access 验证，不能用旧 token 绕过环境/体验关闭。
- 登录方式投影增加来源；体验方式 `verifiedAt=null`，不能把 provision 时间映射为邮件验证时间。正常手机/Google/邮箱身份时间保持原事实。所有现有消费者处理可空时间，前端只展示必要来源，不暴露占位地址。

备选填一个假的 `verifiedAt` 会混淆审计事实；独立第二套密码表会重复 hash/version/session 规则且扩大用户名跨表冲突，因此选择最小明确的来源扩展。

### 3. 五槽位创建与角色授权分阶段恢复

| 槽位 | 最终后台角色 | 移动房间行为 |
| --- | --- | --- |
| 后台管理员 | 仅 `PLATFORM_ADMIN` | 本轮不作为房间测试参与者 |
| 后台安全员 | 仅 `SAFETY_OFFICER` | 本轮不作为房间测试参与者 |
| 移动 A | 无 | 正常创建房间，本次成为房主 |
| 移动 B | 无 | 正常加入 |
| 移动 C | 无 | 正常加入 |

CLI 通过 auth 拥有的 application API 与 repository 事务初始化，不从 controller 或其他模块深层导入认证 repository；profiles 使用公开 service/policy 校验成年资料。新增脚本/命令不写公网运维 endpoint，不复用测试 fixture。

预检显式目标和环境；实际连接凭据仅从秘密环境传入，禁止默认回落到本机数据库。初次创建要求五个唯一用户名、五个独立秘密输入和合法资料，拒绝 username/email/User/槽位冲突、重复身份、弱密码及意外已有管理员。五账号和资料/初始化映射在一个事务内创建，密码计算在事务外，事务内重查唯一性与目标；失败不留下半套账号。重复执行只核对已有精确映射和有效凭据，不能覆盖密码/资料、恢复已撤销角色或复活 DELETED 账号。

数据库创建与合法角色授权不是伪装成单事务：

1. 五账号数据事务完成后，通过现有 `BackofficeBootstrapCommand` 为该批管理员建立首个后台账号，产生原有 SYSTEM_BOOTSTRAP 审计，暂时持有双角色。
2. 操作者以该管理员的真实用户名密码经正常会话登录，使用现有角色接口向安全员槽位授予 `SAFETY_OFFICER`，再撤销管理员的 `SAFETY_OFFICER`。每个命令使用稳定 UUID、原因和已认证 identity；禁止 CLI 仅从 manifest 取 actorUserId 伪装已认证管理员或直接插角色表。
3. 验证最终两角色分离、移动用户无角色后标记角色阶段完成。命令可输出非秘密的阶段/槽位状态及操作说明，不输出密码、hash、token 或完整邮箱。

恢复时根据 durable 阶段记录和实时角色核对：bootstrap 仅在尚未建立管理员时使用；最终管理员只有单角色后不能重新调用 bootstrap。原命令响应丢失优先用原 UUID 重放验证；已完成阶段不重复成功审计。未知管理员、额外角色、后续合法角色撤销或用户禁用均报告冲突供操作者处理，不自动“修好”并重授权限。该命令的成功定义为完成五身份和最终角色核验；只完成数据时明确为待角色授权，不能报告整体成功。

### 4. 资料完整与正常房间流程

移动三个槽位经当前 `ProfilePolicy` 校验并保存可实际加载的头像 URL、不同昵称、合法性别、国家或城市、1–10 个合法兴趣、合法 CEFR、明确成年出生年月和 `completedAt`；不能只写完成时间绕过校验。使用虚构体验资料，不引入真实访客个人信息。

登录后 `GET /v1/me` 应返回 `ELIGIBLE`。房间测试由 A 在 UI 正常创建容量至少 3 的房间、B/C 使用独立 session 加入并接受现有房间规则；结束后可以换人创建。seed 不新增 Room、membership 或固定 HOST 权限，不绕过容量、同意、封禁、麦克风和 LiveKit 资格。

### 5. 邮件停止与期限清理分开

邮件开关为 false 时，注册、重发、确认、密码恢复请求/提交、邮箱绑定及绑定专用 OAuth/phone proof 全部在产生持久申请、配额发送副作用或调用外部 provider 前返回现有 `EMAIL_AUTH_UNAVAILABLE`（503）。有效旧 token 同样不能消费，不能返回 202 伪装“已发送”。普通 Google exchange 与正常密码登录/密码注销 proof 保留。

worker 改为 cleanup-only 时钟与 delivery 开关独立：无邮件配置也能执行不需要解密的清理；邮件关闭不 claim/send，不把任何 row 记为 DELIVERED。部署关闭时先停止/排空投递进程，再通过明确的停用维护动作取消未终结投递、清空加密载荷和临时申请可还原信息、失效挑战/proof并递增 generation fencing，避免重开邮件后发送旧积压。保留既有审计与正式账号事实。清理只能覆盖邮件流程临时数据，不取消仍需使用的 ACCOUNT_DELETE proof；到期 proof 仍清理。

不能保证已向 SMTP 提交的邮件被撤回，runbook 需说明切换顺序与该边界。全新体验 DB 没有投递积压时动作幂等空操作；隔离测试必须另构造旧 PENDING/RUNNING 记录验证。仅关闭 worker 会延误旧申请/载荷清理，故不采用。

### 6. Web 入口与视觉边界

提供最小、非敏感的认证能力查询（建议 `GET /v1/auth/capabilities`），仅输出密码/Google/邮件流程可用布尔值，不输出五槽位、邮箱、环境 ID 或提供商秘密；错误/未知时邮件入口按关闭处理。这样 UI 和后端部署状态一致，不新增第二份合同。正常邮箱模式可保留原页面入口；本次试用登录页隐藏邮件注册/找回入口，保留密码与 Google。

直接打开注册、验证、找回、重置、绑定页时呈现统一的“当前试用暂不提供此功能”，提供返回登录，不触发网络邮件请求；从链接读到旧 token 时仍清除地址栏 fragment，并不自动确认。页面不展示“已发送”成功状态。登录方式页面能展示未邮件验证的体验来源。中英文文案使用已有 i18n，复用当前布局/组件；不创建新页面视觉体系。

UI 应用项目 `voice-room-figma-to-frontend` 技能。仓库证据目标为 Figma 文件 `56nIowZmvBhb0QJvOlDQdU` 的认证 V2 登录 `118:2970`、注册 `118:3001`、验证 `118:3063`、找回 `118:3186`（390×844）；来自 `docs/acceptance/implement-mobile-email-password-auth.md`，本轮没有实时核验。Desktop Bridge status 为无活动 transport/未连接，禁止 cloud/REST/browser fallback。实现 UI 前必须恢复 Bridge、核对实际页面/frame、在原页确认停用注释/状态；本次规划不授权编辑原稿。后台已有密码/Google 表单保持原视觉，仅使用现有状态做权限验收。

### 7. 唯一合同与证据

仍使用 NestJS code-first 生成 `openapi/openapi.yaml`，新增 capabilities 和可空来源投影后更新 `packages/api-client` 生成结果及所有消费者，不手写第二 DTO。静态生成与 openapi check 只证明合同一致。

实施中的最小检查：配置组合、原验证路径保留、来源/环境门控、错误密码/未知用户同错、Redis fail-closed、幂等/并发唯一性、停用邮件 HTTP 无副作用、worker cleanup-only、角色矩阵/最后管理员、注销旧会话与预置来源失效、清理不复活身份。Web 用 Playwright 验证五账号分开会话、HttpOnly Cookie、后台 direct-route/直接 API 拒绝、Google mock 边界与中英文停用状态；真实 Google 单独 smoke。

UI 需要 Bridge 原稿截图与浏览器 390×844 比较；三人网页需要真实麦克风/LiveKit 发布订阅、结束/换房主的新房流程的 runtime 证据。Web 测试不替代 Android/iOS 真机；本轮正式上线/SMTP 与原 changes 的外部任务继续 BLOCKED/DEFERRED。全部实现完成后只运行一次完整受影响检查；失败或后续改动才重跑。

## Risks / Trade-offs

- [体验来源扩大到普通注册] → 只有受控 CLI 写来源/槽位映射，HTTP DTO 不接受这些字段；验证缺映射、跨环境、旧 token 和普通 pending 账号拒绝路径。
- [高权限账号被共享可改变角色或处置数据] → 保持真实服务端权限、原因/确认/审计、环境隔离、会话撤销和可核对回滚。建议限制分发对象，当前尚未获用户确认；不通过暗中删权限降低体验真实性。
- [旧版本把 null 当 Date 或仅凭 hash 发会话] → 同步发布后端/两端客户端并完成合同兼容检查；旧二进制不能直接回滚到包含体验凭据的状态，回滚版本需具备拒绝体验来源的兼容处理。
- [角色流程中断留下管理员双角色] → 明确阶段、真实管理员认证、稳定命令 UUID、只验证不自动重授、最终矩阵检查；部分完成不报告可交付。
- [邮件关闭后旧载荷长期残留/重开发送] → 独立 cleanup 与停用 drain/cancel/fencing，验证过期清理和 provider 不被调用；在发布记录中标明最后一次投递及切换时间。
- [共享移动账号互相修改资料/占用活跃房间] → 五个槽位身份独立，测试使用三个独立客户端并正常结束房间；不把共享体验凭据作为长期个人账号或生产用户资料。
- [运行 seed 指向错误 DB 或重复修改未知用户] → 无默认目标、环境标识匹配、备份/预检、dry-run、唯一映射、冲突拒绝；不调用测试全表 cleanup。
- [没有自动密码找回] → 首轮已关闭邮件且无自助恢复；不顺手加入无邮件找回。丢失凭证须另行批准受控轮换操作，初始化重跑不替换密码。

## Migration Plan

1. 审核本 proposal 与相关 active changes 的限定例外，确认不放宽普通注册验证；UI 实施前确认原稿状态。代码实施/测试与实际环境操作分开授权。
2. 在隔离测试库增加 origin、nullable verifiedAt、初始化记录的 additive migration 和约束：既有 origin 保持 EMAIL_VERIFIED 且有 verifiedAt；体验 origin 的验证时间为空并有可核验的映射。检查升级前后普通账号、hash/version、会话/审计完全保留。禁止改历史 migration。
3. 所有真实环境操作前由用户指定数据库/环境 ID、公网 HTTPS 来源和秘密注入渠道；备份并验证 dry-run、当前管理员集合、五槽位冲突及迁移状态。当前没有这些输入，不能执行此步。
4. 先迁移、发布能识别来源的 API/客户端，保持体验开关关闭；配置 Google、CORS、Cookie 安全及邮件关闭，排空投递并执行临时数据停用清理。再启用环境绑定体验能力，完成五身份初始化和合法 bootstrap/认证角色分离。
5. 核对三个移动用户 ELIGIBLE、后台最终矩阵、错误权限与旧凭据拒绝，再按用户决定的分发渠道提供秘密；runbook 和运行日志仅保留脱敏执行结果。目标环境五账号、真实 Google、三人 LiveKit、公开 webhook 的验收全部分别记录；无目标时保留 BLOCKED，不用本地 fake PASS 替代。
6. 回滚优先关闭体验能力并撤销其所有平台会话、结束/退出正常测试房间，保留 Google；保留表、来源映射和审计，不删表/恢复旧 hash/恢复注销身份。保持对体验来源的 access/refresh 拒绝。
7. 完全清理时先结束房间、撤销安全员；管理员只有在向受控承接账号合法移交并核验至少一个有效管理员后才能撤销自身角色。然后使用正常密码 proof/明确注销流程销毁 hash、撤销全部会话、保留唯一身份占用和审计，标记预置映射 RETIRED；重跑 seed 拒绝退役身份。若没有承接管理员，则管理员清理保持待执行，不绕过最后管理员规则。

## Open Questions

- 执行时选哪个独立体验数据库/环境标识、HTTPS API/admin/mobile 地址及备份位置？这些决定改变环境值，不改变认证与授权设计。
- 五账号实际用户名、秘密输入/交付渠道、体验者名单何时提供？高权限账号分发范围需由用户决定。
- Bridge 恢复后既有 frame 的停用状态注释是否可直接复用？具体视觉证据待 UI 实施前核验，不能以本文件当作已批准视觉设计。
