## Context

动机与范围见 `proposal.md`，行为见本 change 的 `backoffice-access-control` 和 `backoffice-audit` delta specs。

2026-09-14 检查到的当前代码事实：

- `AccessTokenGuard` 是全局认证 guard，通过 `SessionService` 校验 JWT、持久会话和用户状态，并只向请求写入 `userId`、`sessionId`；token 与身份上下文没有角色字段。
- `auth` 已有 OAuth、access/refresh token、会话撤销和公开模块入口；`users` 仍是空目录骨架，Prisma `User` 只有 `ACTIVE`、`DISABLED`、`DELETED` 状态，没有后台角色关系。
- `audit` 目前只有供房间事务复用的 `appendRoomEvent` infrastructure 入口，`RoomEvent` 服务房间生命周期与举报关联，不能承载所有后台资源和权限事件。
- 全局 DTO 校验拒绝额外字段，`ApiExceptionFilter` 提供稳定错误体；`StructuredLogger` 和日志脱敏已有基础，但后台 role/reason/filter 仍需字段白名单与实际输出测试。
- 当前没有 `/backoffice` API、角色 bootstrap、后台审计查询或 PC 管理端业务实现。OpenAPI 由 NestJS Swagger decorators 确定性生成。

## Goals / Non-Goals

**Goals:** 以 PostgreSQL 角色事实为每次请求的授权依据；提供首个管理员建立、最小角色管理和即时撤销；让角色变更与审计具备原子性；为后续安全案件提供可复用的后台权限与审计公共入口。

**Non-Goals:** 不建立第二套认证、策略语言或租户系统；不在 JWT/LiveKit token 中缓存角色；不预建案件、指标或房间处罚接口；不把 `RoomEvent` 改造成通用后台审计表。

## Decisions

### 1. 认证与后台授权分层

现有 `AccessTokenGuard` 继续只负责身份认证。新增 `backoffice` 模块拥有角色分配、角色策略、管理 API 和授权查询；后台 controller 及后续安全模块通过其公开 decorator/guard 声明所需权限。授权 guard 在认证完成后按 `userId` 查询当前有效角色和用户状态，不读取客户端角色，也不把角色放入长生命周期 token。

本 change 定义当前真实端点需要的三个权限：查看当前后台身份、管理角色、读取后台审计。角色到权限的映射集中维护：任一后台角色可查看本人最小后台身份，`PLATFORM_ADMIN` 可管理角色并读取审计，`AUDITOR` 只可读取审计；`SAFETY_OFFICER` 和 `OPERATIONS_ANALYST` 的业务权限由后续实际 capability 增加。用户拥有多角色时取权限并集，但管理员角色不会自动获得安全员权限。

备选把角色写入 access token 会使撤销延迟到 token 过期；每个 controller 手写角色判断容易漂移；引入通用 ABAC/策略引擎超出四个固定角色的实际需要。均不采用。

### 2. 独立角色分配模型保留授权事实

新增 `BackofficeRoleAssignment`，保存 UUID id、userId、固定角色、grantedAt/grantedByUserId、revokedAt/revokedByUserId 和 version，并对 `(userId,role)` 建唯一约束。bootstrap 的 grantedBy 为空并由对应后台审计的 `SYSTEM_BOOTSTRAP` actor 解释；普通角色修改必须有关联 actor。目标和 actor 用户关系使用 RESTRICT，软删除不会抹掉角色历史。

角色撤销保留原分配行并设置撤销字段；重新授予更新同一分配和版本，不创建无法区分当前状态的重复行。授权查询只接受未撤销且用户仍为 ACTIVE 的分配。API 不直接暴露 Prisma enum，domain 与 transport 做显式映射。

备选在 `User` 上增加单个 role 字段无法支持管理员兼安全员；使用 Redis 或 JWT 作为事实不能跨重启并保证即时撤销；删除 assignment 会丢失授权时间线。均不采用。

### 3. 首个管理员由一次性 CLI bootstrap

提供仓库命令，输入一个已有平台 UUID。事务先取得固定的 PostgreSQL transaction advisory lock，再读取目标账号和现有有效管理员：

- 没有有效管理员时，为目标原子授予 `PLATFORM_ADMIN`、`SAFETY_OFFICER` 并追加一条系统 bootstrap 审计；
- 指定目标已经完整持有两个角色时返回幂等结果，不重复审计；
- 目标不存在/不可用、已有其他管理员，或当前状态只部分匹配时稳定失败，不自动修补或替换管理员。

命令不接受邮箱、provider subject 或显示名，不创建用户、不修改账号状态，也不在日志输出数据库连接、token 或 provider 信息。后续角色变更只能走已认证管理员 API；bootstrap 不能充当日常 break-glass 绕过。

备选 migration seed 不知道目标用户；环境变量每次启动自动授予会在撤销后重新提升权限；直接手改数据库缺少不变量和审计。均不采用。

### 4. 角色命令使用数据库幂等和最后管理员锁

授予/撤销请求携带 `clientRequestId`、role 和 1–500 Unicode 码点的 reason。`BackofficeAuditEvent` 对普通 actor 的 `(actorUserId,clientRequestId)` 建条件唯一约束，并保存规范化命令字段；重试先比较 action、target、role 和 trim 后 reason，相同返回首次结果，不同返回 `BACKOFFICE_REQUEST_CONFLICT`。

角色 mutation 在同一事务中锁定目标 assignment。涉及 `PLATFORM_ADMIN` 时，再用固定 advisory lock 串行化管理员集合检查，保证并发撤销不能将有效管理员降为零。幂等 no-op 仍返回当前分配，但只保留首次接受命令的一条审计。已通过管理员授权但因最后管理员规则拒绝的命令提交一条 `REJECTED` 审计后，再映射为稳定冲突；未通过认证/角色 guard 的请求只写脱敏安全日志，避免未授权流量填满持久审计。

备选仅使用内存/Redis 幂等无法在进程重启后保证结果；单纯先 count 再 update 存在并发撤空管理员；把异常抛出事务会连拒绝审计一起回滚。均不采用。

### 5. 后台审计与 RoomEvent 分开拥有

新增 `BackofficeAuditEvent`，至少保存 id、actorType、actorUserId、actorRoles 快照、action、targetType、targetId、reason、result、clientRequestId、requestId、occurredAt 和有限的结构化 details。action/target/result 在 domain 使用显式允许值；details 由每类事件的白名单构造，不接收 controller DTO 或异常对象。

`audit` 模块拥有审计追加和查询。为满足角色 mutation 与审计原子性，它通过公开的 infrastructure integration 接受调用者已有的 Prisma `TransactionClient`；Prisma 类型只在 `backoffice`/`audit` 的 infrastructure 边界传递，不进入 controller、application 或 domain。现有 RoomEvent 保持房间事件模型，两个审计事实不互相复制。

角色列表和审计列表在事务内先按稳定 `(occurredAt,id)` 或 `(grantedAt,id)` 游标读取，再追加对应查看审计；审计写入失败则整个请求失败且不返回已读数据。本批次不提供审计 update/delete/export API，也不承诺永久保留；后续数据治理只能通过独立 change 制定保留和受控清理规则。

### 6. HTTP 与稳定错误

新增以下 `/v1/backoffice` contract，全部复用 Bearer 认证：

- `GET /v1/backoffice/me`：任一后台角色可读，返回 `{userId,roles}`；
- `GET /v1/backoffice/role-assignments`：平台管理员分页读取，可按 userId/role/active 过滤；
- `POST /v1/backoffice/users/{userId}/roles/{role}/grant`：平台管理员授予；
- `POST /v1/backoffice/users/{userId}/roles/{role}/revoke`：平台管理员撤销；
- `GET /v1/backoffice/audit-events`：平台管理员或审计员分页读取允许的过滤条件。

稳定错误新增 `BACKOFFICE_ACCESS_DENIED`（403）、`BACKOFFICE_USER_NOT_FOUND`（404）、`LAST_PLATFORM_ADMIN_REQUIRED`（409）和 `BACKOFFICE_REQUEST_CONFLICT`（409）；格式、UUID、role、reason、filter 和 cursor 非法沿用 `VALIDATION_FAILED`。身份失败继续使用现有 401 边界，持久化失败对外为 `INTERNAL_ERROR`。错误不得回显 reason、游标、token、SQL 或 stack。

继续使用 NestJS code-first Swagger 生成唯一 `openapi/openapi.yaml`，不手写第二份 contract；前端 client 和 PC 管理页面不在本 change 范围。

### 7. 验收分层

domain 单元测试验证角色/权限映射、reason 规范化、幂等内容比较和最后管理员 policy。真实 PostgreSQL 集成测试验证 migration、bootstrap 并发、角色授予/撤销与审计原子性、并发最后管理员保护、重启后幂等和审计查询分页。HTTP E2E 验证认证、权限绕过、即时撤销、最小响应、稳定错误和 OpenAPI。

至少执行一次本地真实 PostgreSQL 闭环：建立普通用户 → bootstrap 为管理员兼安全员 → 授予/撤销其他角色 → 旧 access token 立即失权 → 管理员/审计员读取审计，并直接查询持久表核对角色与审计数量。该证据不需要真实 Google/微信 provider、LiveKit、前端或设备，不得把 fake OAuth 结果记成 provider smoke。

## Risks / Trade-offs

- [Risk] 通用后台审计 details 可能逐步装入隐私数据 → 每个 action 使用显式 schema/白名单，禁止原始 DTO、header、异常和自由 JSON 透传，并测试实际 logger/response。
- [Risk] 每次后台请求查询 PostgreSQL 增加少量延迟 → 当前后台流量低且即时撤销优先；先使用索引查询，不在没有证据时加入 Redis 缓存。
- [Risk] CLI 拥有生产数据库写权限 → 仅允许没有有效管理员时执行，按 UUID 定位、事务锁、固定角色组合和审计约束；凭证保管与执行人由部署流程控制。
- [Risk] 管理员账号被后续账号限制会导致后台不可用 → 当前 change 不改变账号状态；后续 restriction change 必须显式处理最后管理员和 break-glass 风险，不能静默绕过现有认证。
- [Risk] 角色撤销与并发请求交错 → 每个请求在执行受保护 use case 前读取当前角色；长事务不跨越外部 provider，角色 mutation 使用数据库锁和版本。
- [Risk] 当前工作区多个前置 change 尚未归档 → apply 前核对真实 auth/audit/schema 和迁移顺序，以现有代码为集成事实；不修改旧 migration，也不把 active planning 当作实现证据。

## Migration Plan

1. apply 前记录当前 Prisma migration 链、`User`/session 模型、audit 公开入口和后端验证基线；确认工作区修改归属，避免覆盖前置 change。
2. 添加后台角色 enum、角色分配和后台审计的 additive migration；不创建默认角色、不修改现有用户/会话/RoomEvent，验证空库与含完整前置数据的升级。
3. 实现服务、guard、API、CLI 和 code-first contract 后，先在隔离测试数据库创建普通测试用户并运行 bootstrap 闭环；真实生产用户不进入测试或仓库。
4. 部署时先应用 migration，再部署兼容新表的应用；由授权运维人员只执行一次 bootstrap，核对目标 UUID、两个角色和审计结果后再开放后台入口。
5. 应用回退时停止暴露新后台 API，保留角色和审计表及数据，不执行破坏性 down migration；旧版本不读取新表。通过 forward fix 恢复后续服务，避免删除安全审计。

## Open Questions

生产 bootstrap 的具体执行人、管理员 provider 凭证恢复和 MFA/break-glass 机制由部署安全加固 change 决定；这些选择不改变本 change 的数据模型、API 权限或任务边界，且当前不得在仓库保存真实身份或凭证。
