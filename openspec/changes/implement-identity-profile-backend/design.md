## Context

参见 [proposal.md](./proposal.md) 的 Why。本设计实现现有 [identity-and-profile spec](../../specs/identity-and-profile/spec.md)，不修改产品 requirements。

当前 `apps/api` 只有 NestJS + Express 的 ESM 启动壳和 Zod 环境配置校验；尚无数据库、公开 API、认证、OpenAPI contract 或业务模块实现。该变更横跨 auth、users、profiles、database、OAuth 和 HTTP bootstrap，并首次引入持久化及公开接口，因此按 Level 2 处理。

## Goals / Non-Goals

**Goals:**

- 建立可被后续 rooms、voice、moderation 复用的可信 `userId`、会话和用户准入结果。
- 保证第三方登录幂等、refresh token 可撤销且轮换安全、出生年月修改后立即重新计算准入资格。
- 生成唯一的、机器可校验的 OpenAPI contract，并让实现、测试和后续 generated client 对齐。
- 让 domain policy 与 OAuth、Prisma、NestJS transport 解耦，但只创建当前真实需要的抽象。

**Non-Goals:**

- 不建立通用 IAM、RBAC、微服务、事件总线或第二种数据库抽象。
- 不保存 OAuth provider access/refresh token；当前只消费一次性授权结果以建立平台身份。
- 不处理公开个人资料、账号合并、手机号注册、管理员兴趣配置或房间权限实现。
- 不用自动化 fake provider 结果替代 Google/微信真实环境验收。

## Decisions

### 1. 采用 NestJS code-first generated OpenAPI

使用 NestJS controller/DTO、`@nestjs/swagger` 和 validation metadata 作为实现输入，由确定性脚本生成 `openapi/openapi.yaml`。仓库只发布该 YAML 作为唯一 API contract；不得再维护一份手写 OpenAPI。

CI/本地检查会重新生成 contract 并与已提交文件比较，避免 controller 已变而 contract 未更新。首批接口使用 `/v1` 前缀，错误采用稳定结构：`code`、`message`、可选 `details` 和 `requestId`，不统一包裹成功响应。

备选 API-first 能更早冻结协议，但当前是单人 NestJS greenfield 项目，手写 schema 与 DTO 映射会增加重复维护。若未来需要 API-first，必须通过独立 Architecture change 切换，不能并行保留两套来源。

### 2. 认证流程使用 provider authorization code exchange

移动端从 Google 或微信获得一次性 authorization code，并调用 `POST /v1/auth/oauth/{provider}/exchange`。后端 provider adapter 使用允许的 redirect URI 和 PKCE/provider 所需参数完成交换与身份校验，只接受 provider 验证后的 `issuer + subject`，不使用 email 作为账号唯一键。

`OAuthProviderPort` 只暴露当前需要的 `exchangeAndVerify()`；Google、微信分别实现 adapter。测试环境通过依赖注入使用 deterministic fake，非测试环境缺少 provider 配置时对应接口返回 `AUTH_PROVIDER_UNAVAILABLE`，不得自动降级为假登录。

不持久化 provider token。provider 昵称或头像只可作为首次资料表单的建议值，不能绕过用户提交和服务端资料校验。

备选“客户端直接提交 provider 用户资料”无法证明身份；完整 Passport strategy 在当前只有两个交换入口时增加隐式控制流，因此不采用。

### 3. 平台会话使用短期 access JWT + rotating opaque refresh token

- access JWT 默认 15 分钟，包含 `sub=userId`、`sid=sessionId`、`iat`、`exp` 和签发方/受众；服务端 guard 同时校验签名、issuer 和 audience。
- refresh token 为至少 256 bit 随机值，默认 30 天；API 只返回明文一次，数据库保存带服务端 pepper 的 HMAC-SHA-256 digest。
- 每次刷新都在事务内替换 digest 并更新轮换时间。已使用 token 再次出现视为重放，撤销该 session 并返回 `REFRESH_TOKEN_REUSED`。
- `POST /v1/auth/logout` 撤销当前 session；用户可有多个独立设备 session，本批次不设置设备数上限。
- access/refresh TTL、issuer、audience 和 pepper 由经过 Zod 校验的环境配置提供；上述值是安全默认值，不是产品 requirement。

token pair 通过 JSON 返回，适合 Expo secure storage；管理端 cookie 会话不在本变更范围。后续房间接口除校验 JWT 外，还必须实时检查用户准入和处罚状态，不能只信任 access token 中的旧状态。

备选长期 JWT 无法及时撤销；服务端保存明文 refresh token 会扩大泄露影响；单一全局 session 会误伤多设备，因此均不采用。

### 4. PostgreSQL 是身份事实来源，Prisma 只存在于 infrastructure

首批 schema 使用 UUID 主键和 UTC 时间，至少包含：

- `User`：平台账号、账号状态、创建/更新时间。
- `OAuthIdentity`：`provider`、`issuer`、`subject`、`userId`，并对 `(issuer, subject)` 建唯一约束。
- `AuthSession`：`userId`、refresh digest、到期/轮换/撤销时间和最少设备描述。
- `UserProfile`：头像、名称、性别 code、国籍 code 或城市、兴趣 code 列表、CEFR、出生年/月、完成时间。

OAuth 首次登录在一个数据库事务中查找或创建 identity 与 user；唯一约束负责抵抗并发重复登录，adapter 将 unique-conflict 重新读取为同一账号。Prisma model 不越过 repository adapter 暴露给 application/domain。

本批次不建立动态兴趣目录表。`interestCodes` 以有数量、长度和格式上限的 code 数组保存；管理员可配置目录属于后续 capability，届时通过 migration 归一化，不把 frozen PRD 中尚未进入 current spec 的细节提前实现。

备选将 OAuth 身份字段直接放进 `User` 会阻塞未来多 provider 绑定；为所有 profile 选项预建配置中心属于过度设计，因此不采用。

### 5. profiles 模块拥有资料完整性和成年准入 policy

`profiles` domain 定义资料值对象、完整性规则与 `RoomEligibilityPolicy`；`auth` 只负责身份和 session，`users` 只负责平台账号生命周期。后续 rooms 通过 profiles 暴露的 application API 查询准入结果，不读取 profile repository。

出生信息只有年和月。为避免在生日未知时让实际未满 18 岁的用户提前进入房间，准入时间定义为“18 周岁出生月份结束后的下月 1 日 00:00 UTC”。这会最多延后不足一个月，但符合公开语音房的保守安全边界。每次资料提交都重新计算，不把年龄永久缓存进 JWT。

资料状态返回：

- `PROFILE_REQUIRED`：任一必填字段缺失或无效；
- `AGE_RESTRICTED`：资料完整但尚未达到保守成年时间；
- `ELIGIBLE`：资料完整且已达到成年时间。

首批 endpoint 为：

- `POST /v1/auth/oauth/{provider}/exchange`
- `POST /v1/auth/refresh`
- `POST /v1/auth/logout`
- `GET /v1/me`
- `PUT /v1/me/profile`

`PUT /v1/me/profile` 接受完整 profile 表示并保持幂等，既用于首次初始化，也允许本人纠正资料；出生年月变化会立即重新计算状态。当前不提供按用户 ID 查询他人资料的 endpoint。

### 6. 首批公开 API 同步建立最小安全与可观测基线

HTTP bootstrap 接入 Helmet、配置化 CORS allowlist、全局 validation pipe、异常 filter、request ID、Pino/pino-http 和认证入口限流。日志记录 provider 类型、内部 user/session ID、结果 code 和耗时，不记录 authorization code、token、手机号或完整 profile 内容。直接使用 Pino 而不增加 `nestjs-pino` 包装层，避免其 CommonJS 构建与 NestJS 12/Jest ESM runner 的兼容问题。

限流先使用进程内存储，因为当前没有跨实例部署或 Redis consumer；它只保护单实例。进入多实例部署或房间 Redis change 时再改为 Redis-backed storage，并补并发验证。

### 7. 验收证据与 requirement 可追溯

每个 HTTP e2e 场景在测试名称或测试描述中引用 `identity-and-profile` 的对应 Requirement/Scenario。必须提供：

- domain 单元测试：资料完整性、CEFR/字段校验、年月边界和三种准入状态；
- repository 集成测试：首次创建、并发幂等、事务回滚、session 轮换与撤销；
- HTTP e2e：首次登录、再次登录、资料未完成、资料完成、未满 18 岁、刷新重放、未认证访问和 provider 失败；
- clean database migration、lint、typecheck、build、test 和 dependency boundary 结果；
- 重新生成且无 drift 的 `openapi/openapi.yaml`；
- 使用真实 Google/微信测试应用得到的授权成功/取消/无效 code runtime 证据。缺少凭证时必须标记 BLOCKED，不得标记 PASS。

该变更没有 UI，不需要 visual/device evidence。OpenSpec criteria、contract、runtime 与测试证据共同构成 acceptance；production deployment 不是 archive 前置条件。

## Risks / Trade-offs

- [Risk] 微信与 Google 的 native OAuth 参数和审核条件不同，可能阻塞真实 provider 验收 → 使用独立 adapter 和稳定内部 identity，分别记录环境阻塞；不让一个 provider 的实现污染另一个。
- [Risk] self-reported birth month 无法证明真实年龄 → 明确这是轻量边界，使用保守月份算法；证件或第三方年龄验证留给后续 requirement change。
- [Risk] 进程内限流在多实例间不共享 → 当前只接受单实例运行；多实例前必须迁移 Redis-backed limiter。
- [Risk] code-first decorator、validation 和生成器版本可能造成 contract drift → 固定直接依赖版本，生成脚本排序输出，并在 CI 比较生成结果。
- [Risk] refresh token 被盗可能允许会话接管 → 高熵 token、仅存 digest、轮换、重放撤销、日志脱敏和 secure storage 降低风险。
- [Risk] `interestCodes` 后续需要迁移到管理员目录 → 保持字段有界并通过 profile repository 封装，后续使用加法 migration 和兼容读取迁移。
- [Trade-off] 保守成年算法会让当月已满 18 岁的部分用户延迟到下月 → 当前安全优先于最多一个月的准入延迟；如需精确生日必须先修改 requirements 和采集字段。

## Migration Plan

1. 增加依赖、环境 schema 和示例配置，不改变现有启动入口的默认监听行为。
2. 增加 Prisma schema，生成首个 additive migration，在空 PostgreSQL 上执行升级并验证重复执行策略。
3. 实现 modules、adapters、HTTP security baseline 和 endpoints；测试先使用 fake OAuth adapter 与独立测试数据库。
4. 生成 `openapi/openapi.yaml`，执行 contract drift、lint、typecheck、build、unit、integration、e2e 和 dependency boundary 检查。
5. 配置 Google/微信测试应用后补真实 provider runtime evidence；由项目所有者完成 acceptance review。

回滚时先回滚应用版本，使新接口不可达。未进入生产且无保留数据的开发环境可删除专用开发数据库并重新 migration；存在真实账号数据后不执行破坏性 down migration，保留新增表并通过 forward fix 恢复。OAuth provider 可按配置单独禁用，但不能启用 fake provider。

## Open Questions

- Google 与微信各环境的 client ID/secret、redirect URI 和测试账号由项目所有者何时提供？这只影响真实 provider evidence，不改变模块设计或自动化任务。
- access token 15 分钟、refresh token 30 天是否需要在首轮真实设备联调后调整？两者已配置化，调整不改变 contract。
