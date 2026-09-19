## Context

需求动机见 [proposal.md](./proposal.md)。当前 `moderation` 在一个 PostgreSQL 事务中写入 `Report` 和对应 `RoomEvent`，但没有后续案件；`backoffice` 已提供持久多角色、当前角色校验、角色修改幂等和管理员集合事务锁；`audit` 已提供追加式后台审计。即时房间、预约房间和实时凭证分别在各自事务中检查 `User.status`，还没有统一的临时限制事实。

本 change 是 Level 2 安全与广泛 schema 变更。它跨越举报受理、后台授权与审计、用户状态、即时/预约房间以及实时凭证。PostgreSQL 必须继续是案件和限制的持久事实来源；Redis/BullMQ 只能加速到期与重新分配，不能决定用户是否仍受限。唯一 API contract 继续由 NestJS code-first 确定性生成到 `openapi/openapi.yaml`。

## Goals / Non-Goals

**Goals:**

- 在不拆开现有举报事务的前提下，原子建立一对一案件、初始分配、参与者快照、处理活动和必要审计。
- 用明确状态机、当前角色和数据库并发控制实现可重试的人工案件处理。
- 让所有现有房间写入口在各自数据库事务内使用同一个临时限制判断，并以数据库时间处理边界。
- 让临时限制、申诉、提前解除、自动到期和永久禁用具有不可丢失的事实、稳定幂等结果和最小化响应。
- 对历史举报提供可部署的 backfill，对应用回滚保留数据兼容性。

**Non-Goals:**

- 不把安全处置抽象成通用规则引擎，也不预建 STT、用户屏蔽或房间禁用 provider。
- 不让后台任务主动修改 LiveKit 房间或撤销已经签发的凭证；活跃房间内处置留给房间安全动作 change。
- 不建立可编辑的证据文档或复制完整业务数据；证据包是允许事实的只读投影。
- 不为本次纯后端 change 制作 Figma、视觉或设备验收材料。

## Decisions

### 1. 新建 `safety` 业务模块，举报受理仍由 `moderation` 拥有

`safety` 模块拥有案件、分配、限制、申诉、恢复 runner、后台 controller 和本人限制 controller。`moderation` 保持举报校验和受理入口，并在现有 `PrismaReportRepository.submit()` 事务中调用无依赖注入的 safety persistence helper，写入案件、参与者快照、初始活动和系统审计。该 helper 接收现有 Prisma transaction client，不自行开启事务。

这样可以保留“举报 + RoomEvent + 案件”全有或全无，也避免 `ModerationModule` 与 `SafetyModule` 相互 import。另一方案是举报成功后发布队列事件创建案件，但它会产生已受理举报暂时或永久没有案件的状态，因此不采用。

### 2. 使用规范化关系表保存事实，用活动表保存案件处理轨迹

新增以下持久类型：

- `SafetyCase`：`reportId` 唯一，保存房间、目标用户、状态、当前处理人、处理时间、评估等级、终态类型、终态理由、版本和时间戳。
- `SafetyCaseParticipantSnapshot`：保存举报受理时可见的成员标识、角色、生命周期和已有时间字段，避免后续重新加入覆盖案件所需上下文。
- `SafetyCaseActivity`：追加保存创建、分配、重新分配、领取、开始和终态动作，供案件处理记录使用。
- `SafetyRestriction`：保存案件唯一终态处置、`TEMPORARY` 或 `PERMANENT` 类型、等级、开始/结束、提前解除、到期投影及决定人。
- `SafetyAppeal`：每条临时限制最多一条，保存用户理由、截止时间、`PENDING/UPHELD/LIFTED`、处理理由和处理人。
- `SafetyCommand`：以 `(actorUserId, clientRequestId)` 唯一保存 action、规范化请求 hash 和最小结果快照，为案件、限制和申诉命令提供独立幂等账本。
- `SafetyAssignmentState`：单例保存轮转游标，用于并列负载分配。

案件状态为 `OPEN -> UNDER_REVIEW -> RESOLVED|DISMISSED`。未分配是 `assigneeUserId = null`，不增加与案件状态重复的 `UNASSIGNED` 状态。评估等级只在终态决定时写入；无处罚和驳回不伪造风险等级。限制状态字段是便于查询的投影，实际有效性仍由类型、`startsAt`、`endsAt` 和 `liftedAt` 判断。

使用关系列而不是把证据、命令和活动全部塞进 JSON，便于建立唯一约束、外键和筛选索引。JSON 只允许用于幂等结果及审计的固定白名单小字段，不能保存举报正文或证据包。

### 3. 在数据库事务中计算最小负载并串行化轮转

案件创建和恢复分配先锁定 `SafetyAssignmentState` 单例，再查询账号为 `ACTIVE`、角色未撤销的安全员及其 `OPEN/UNDER_REVIEW` 已分配案件数。先选择最小负载集合，再从轮转游标后的稳定 `userId` 顺序选择一人并更新游标。没有安全员时保留空处理人和未分配活动。

恢复扫描处理两类案件：当前处理人不再可用的未结案件，以及没有处理人的未结案件。它复用相同锁和选择算法，每次事务重新检查案件状态与当前角色，所以多实例和重复运行不会产生两个当前处理人。允许安全员通过 compare-and-set 领取仍未分配的案件；自动分配和领取并发时只有一个更新成功。

只按 `userId` 选最小值虽然确定，但会持续偏向同一名并列安全员；随机选择难以复现并测试，因此均不采用。

### 4. 权限由粗粒度 guard 和服务层资源范围共同决定

扩展后台权限为案件全量读取、案件工作、限制工作和申诉工作：

- `PLATFORM_ADMIN` 获得案件和证据的全量只读权限。
- `SAFETY_OFFICER` 获得自己的案件/未分配案件读取、案件工作、限制工作和申诉工作权限。
- 同时持有两个角色时权限并集生效；任何角色均不隐含另一个角色。

guard 每次通过现有 `BackofficeService.authorize()` 读取当前 PostgreSQL 角色；服务层再次按 `assigneeUserId`、案件状态和目标资源约束动作。敏感查询在一个事务中完成“读取允许投影 + 追加访问审计”，审计失败时不返回结果。已认证后台用户的业务拒绝写入最小拒绝审计，普通用户在后台入口的基础拒绝沿用现有边界。

### 5. 后台 API 使用资源型路由和统一命令信封

新增 API：

- `GET /v1/backoffice/safety/cases`、`GET /v1/backoffice/safety/cases/{caseId}`、`GET /v1/backoffice/safety/cases/{caseId}/evidence`
- `POST /v1/backoffice/safety/cases/{caseId}/claim`、`/start`、`/dismiss`、`/resolve`
- `GET /v1/backoffice/safety/restrictions`、`POST /v1/backoffice/safety/restrictions/{restrictionId}/lift`
- `GET /v1/backoffice/safety/appeals`、`POST /v1/backoffice/safety/appeals/{appealId}/decide`
- `GET /v1/me/safety-restrictions`、`POST /v1/me/safety-restrictions/{restrictionId}/appeal`

所有列表采用时间与 UUID 组成的不透明稳定游标，limit 限制为 `1..100`。案件命令使用 `clientRequestId`；要求理由的动作把理由限制为 1..500 个 Unicode 字符，申诉理由限制为 1..2000 个 Unicode 字符。`resolve` 明确传入 `NO_ACTION`、`TEMPORARY_RESTRICTION` 或 `PERMANENT_DISABLE`；临时限制必须带等级，永久禁用必须带 `SERIOUS/HIGH_RISK` 和 `factsConfirmed: true`。客户端不能传持续时间或服务端时间。

`SafetyCommand` 在业务事务内保存规范化 hash 与结果标识。相同命令返回持久结果，不重新计算时间；相同请求标识不同 hash 返回冲突。唯一约束和版本 compare-and-set 处理首次并发，不能只靠进程内锁。

### 6. 证据包在读取时组合不可变来源和受理快照

证据查询以案件为根，组合原 `Report`、举报对应 `RoomEvent`、`SafetyCaseParticipantSnapshot`、该房间已有 `RoomEvent`、目标用户相关举报/案件/限制摘要和 `SafetyCaseActivity`。返回项带来源标识与发生时间，集合采用稳定顺序并设置有界数量；超出部分返回计数和分页/截断标志，避免一个高频账号产生无界响应。

举报说明只出现在有权限的案件证据响应；案件列表只返回类别和状态等摘要。证据和后台审计 DTO 使用显式字段映射，不序列化 Prisma 原对象。未来 STT change 只能以新的最小风险事件来源加入组合器，不能向本模型写入完整转写。

另一方案是在案件创建时复制整个证据包 JSON，但它会固化冗余个人数据、难以执行未来保留政策，也会遗漏之后才完成的房间事件，因此不采用。

### 7. 临时限制由持久时间区间决定，状态收敛与访问判断分离

临时限制在结案事务内使用 PostgreSQL `clock_timestamp()` 取得 `startsAt`，服务端按等级计算固定 `endsAt` 和 `appealDeadlineAt = startsAt + 30 minutes`。有效条件统一为：类型是临时、`startsAt <= dbNow < endsAt` 且 `liftedAt IS NULL`。多条重叠限制全部保留；错误摘要返回最高有效等级和最晚 `endsAt`，本人历史返回每条记录。

在 `safety/persistence.ts` 提供接收 Prisma transaction client 的资格查询。即时房间创建/加入、预约房间创建/预约和实时凭证预留必须在原事务内调用它，并使用同一数据库时间。这样限制与业务写入之间不存在“先检查、后另开事务写入”的窗口。未来房间邀请能力必须调用同一 helper。

只在 guard 或 Redis 缓存中检查会产生绕过和过期漂移，因此不采用。Redis 可以缓存提示信息，但不能参与授权结论。

### 8. 独立安全队列负责到期与分配恢复，数据库扫描兜底

新增独立 `slogan-safety` BullMQ queue 和 `SafetyRunner`，避免把安全作业放进 voice 模块。创建临时限制后尽力安排到期 job；应用启动和固定短周期扫描数据库中的到期 `ACTIVE` 限制、未分配案件和处理人失效案件。job 只携带 kind 和资源 id，不携带举报正文或证据。

到期 worker 通过行锁重新读取限制；若数据库时间已到且未解除，就把投影置为 `EXPIRED`，追加活动和 `SYSTEM_JOB` 审计。队列不可用时提交处罚仍可成功，因为 `endsAt` 已持久；请求路径达到 `endsAt` 后立即放行，扫描恢复后再收敛状态。结构化日志只记录固定事件名、资源标识和稳定结果码。

### 9. 提前解除和申诉共享一个不可重复的解除事实

直接提前解除与申诉通过都更新同一条限制的 `liftedAt/liftedByUserId/liftReason`。事务先锁限制；若已有解除或已经到期，则返回既有状态或稳定冲突，不覆盖原决定。申诉用 `restrictionId` 唯一约束保证每项限制最多一条，并用数据库时间判断 `submittedAt <= appealDeadlineAt`。

任一当前安全员可以查看和处理待处理申诉。`UPHELD` 只终结申诉；`LIFTED` 在同一事务终结申诉并写解除、活动和成功审计。由于产品没有确认处理 SLA，不建立会自动通过或自动驳回的定时任务。

### 10. 永久禁用复用账号状态，并扩展最后管理员事务不变量

永久处置写入 `SafetyRestriction(kind=PERMANENT)` 并把 `User.status` 更新为 `DISABLED`，同时撤销目标的未撤销 `AuthSession`。普通认证仍通过每次请求的账号状态拒绝旧 access token；refresh token 因会话撤销失效。已签发 LiveKit token 的主动撤销和房间内踢出不在本 change。

永久禁用前锁目标用户，并与角色修改复用同一个平台管理员集合 advisory lock。若目标是最后一个账号可用且角色有效的平台管理员，事务记录拒绝审计并不禁用；并发角色撤销与永久禁用也无法把有效管理员降为零。永久禁用没有恢复入口，避免在申诉规则未确认时引入不可审查的解禁路径。

### 11. 后台审计与业务活动承担不同职责

`SafetyCaseActivity` 是案件内可见的业务处理轨迹；`BackofficeAuditEvent` 是管理员/审计员可查询的高权限访问与操作轨迹。安全动作事务同时写业务事实、活动、`SafetyCommand` 和成功审计。审计 action 白名单增加案件读取/分配/处理、限制创建/到期/解除、申诉读取/提交/决定和永久禁用；actor type 增加 `SYSTEM_JOB`。

审计 `details` 只保存案件、限制、申诉、状态、等级、版本等标识性结果，不保存举报说明、申诉正文、证据、token、SQL、stack 或请求体。拒绝审计独立保存稳定 result code；如果已存在相同幂等命令，则复用原结果，不能产生第二条成功审计。

### 12. OpenAPI 和错误契约保持单一来源

DTO、controller 装饰器和稳定错误映射完成后运行现有生成脚本更新 `openapi/openapi.yaml`，不手写第二份 contract。举报响应保留原字段并增加 `caseId`；安全限制拒绝使用统一稳定业务码和最小 `effectiveSeverity/endsAt` details。校验、越权、窗口关闭、状态冲突和幂等冲突分别保持稳定 HTTP 语义，响应与日志不泄露内部错误。

## Risks / Trade-offs

- [Risk] 高频举报可能让全局分配锁成为短暂热点 → 只在选择处理人和更新游标的短事务区间持锁，案件证据与通知不在锁内执行，并用并发测试记录上限。
- [Risk] 多个房间入口漏接临时限制检查 → 用共享 transaction helper 集成每个当前写入口，并设置一组跨模块契约测试；代码搜索核对所有成员创建、预约写入和凭证预留路径。
- [Risk] 到期投影仍显示 `ACTIVE` 造成后台误解 → 所有投影先按数据库时间计算有效状态，runner 只做最终收敛；测试队列停机和边界时刻。
- [Risk] 重叠限制的用户可见截止时间容易取错 → 有效查询统一返回最高等级与最晚结束时间，解除一条后重新从所有持久记录计算。
- [Risk] 永久禁用后台账号破坏最后管理员保护 → 角色撤销和禁用共享 advisory lock 与有效管理员计数，并覆盖交叉并发测试。
- [Risk] 证据查询扩大敏感信息暴露 → 资源范围校验、固定 DTO、结果上限和读取审计同时生效；禁止原始 ORM 序列化和任意 JSON 请求快照。
- [Risk] 历史举报 backfill 后短时没有处理人 → 迁移先建立未分配案件，应用启动扫描再分配；未分配状态可查询且不影响举报事实。
- [Trade-off] 每条举报一个案件会增加人工重复查看 → V1 保持确定的一对一可追踪关系，证据显示相关信号；自动合并需要独立批准的匹配与误合并规则。
- [Trade-off] 本 change 只阻止新房间动作和新凭证 → 已在房间中的用户可能持续到现有会话结束；后续房间安全动作 change 再定义踢出和房主接任。

## Migration Plan

1. 添加 safety enums、关系表、唯一约束、外键和查询索引，并扩展后台审计 actor/action 接受范围；先不删除或重命名现有列。
2. 在同一迁移中为每条历史 `Report` 创建一个 `OPEN`、未分配的 `SafetyCase` 和最小创建活动；从现有 `RoomMembership` 复制当时仍可取得的参与者事实，并把缺失字段保持为空，不推测历史状态。
3. 运行 Prisma format/validate/generate 和迁移 smoke，验证举报数与案件数一致、`reportId` 无重复、外键完整且旧查询仍工作。
4. 部署包含新 schema 读写的应用；启动恢复扫描分配历史和新产生的未分配案件，并收敛到期限制。Redis 不可用时应用仍可启动和正确授权。
5. 生成并校验唯一 OpenAPI contract，运行模块测试、API 全量测试、格式/依赖/contract 检查，以及真实 PostgreSQL + Redis 的举报到申诉/到期完整 runtime smoke。
6. 回滚时先回退应用代码，保留新增表、枚举值和 backfill 数据；旧应用仍可写举报，重新前滚时再次执行幂等 backfill 补齐缺失案件。除非另有经批准的数据迁移，不删除案件、限制、申诉或审计事实。

本 change 没有 UI，因此没有视觉或设备验收；验收证据由 OpenSpec scenario 对照、OpenAPI diff、迁移结果、自动化测试和本地 runtime smoke 组成。LiveKit Cloud 真实连接不是本 change 的完成门槛，限制后的新凭证拒绝在 provider 调用前通过本地/伪 provider 证据验证。
