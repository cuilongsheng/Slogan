## Context

动机与范围见 `proposal.md`，行为见本 change 的 `specs/basic-safety-reporting/spec.md`。

2026-09-12 检查到的当前代码事实：

- `rooms` 已有 controller、application service、domain policy 和 Prisma repository；`withLockedRoom` 使用 Room 行锁，`RoomMembership` 具有 `(roomId,userId)` 唯一约束。目前尚无 lifecycle 状态及 RoomEvent model。
- `moderation` 和 `audit` 仍是空目录骨架；现有 OpenAPI 没有举报接口。
- `AccessTokenGuard` 通过 `SessionService` 校验 token、持久会话及 ACTIVE 账号。全局 ValidationPipe 拒绝额外字段；ApiExceptionFilter 统一公开错误码。
- HTTP E2E 使用内存 repository，PostgreSQL 集成测试单独验证事务；不能用前者证明真实数据库原子性。
- `StructuredLogger` 会把对象序列化成字符串，不能假定 Pino 路径脱敏能清除已经串进 message 的举报正文。
- 最终核对时前置规划已拆分：`implement-livekit-voice-session-backend` 提供 RoomEvent 与实时基础，`implement-host-controls-backend` 提供保留历史 membership 的 LEFT/REMOVED/INVITED 和管理审计。二者均待实施；下述集成点是实施目标，不是现有 API。

## Goals / Non-Goals

**Goals:** 保证举报资格可追溯、重试不重复、记录与审计原子保存；沿用模块化单体、PostgreSQL 和唯一 OpenAPI contract。

**Non-Goals:** 不建立泛化审核工作流或全局事务框架；不把外部 provider 放进举报事务；其余产品边界见 proposal。

## Decisions

### 1. 以历史加入事实确定资格

举报人与目标都必须在指定 room 中存在实际加入事实。允许 ACTIVE、LEFT、REMOVED 和曾加入后重新获邀的成员；不能只判断是否存在 INVITED 行。保留的加入时间/事件用于区分“曾加入后被邀请”和“仅被邀请但从未加入”。当前前置设计的 membership 从实际加入产生；domain policy 测试仍覆盖纯邀请没有实际加入证据的输入，不为未来邀请流程新增模型。

双方曾在同一 room 即满足关系约束，不增加“必须同时在线或时间重叠”的要求。房间 OPEN/ENDING/ENDED、麦位、presence 和房主角色不参与举报资格。请求不复用 `RoomsService.detail()`：该方法会拒绝已结束房间。有效身份沿用全局 guard；不引入举报专用登录或改变被限制账号的认证边界。

备选按当前在线成员判断会阻断历史举报；信任客户端 userId/room link 则允许伪造关系。均不采用。

### 2. 接口与输入边界

新增 `POST /v1/rooms/{roomId}/reports`，沿用 Bearer 认证。请求字段为：

| 字段 | 约束 |
| --- | --- |
| `roomId`（路径） | UUID |
| `targetUserId` | UUID，由服务端解析为该房间真实成员 |
| `clientRequestId` | 必填 UUID；同一举报人的一次提交及其重试共用 |
| `category` | `HARASSMENT_ABUSE`（骚扰辱骂）、`HATE_DISCRIMINATION`（歧视仇恨）、`SEXUAL_CONTENT`（色情低俗）、`SPAM_ADVERTISING`（垃圾广告）、`OTHER`（其他） |
| `description` | 只接受字符串；trim 后 1–2000 Unicode 码点，不做 HTML 执行或富文本处理 |

路径/UUID 统一规范化；说明只 trim，不合并中间空白。DTO 与 domain policy 使用一致码点计数，测试 emoji 边界。未知字段（包括 reporterUserId、submittedAt）返回 `VALIDATION_FAILED`，校验响应禁止包含输入值。

新建和幂等重试均返回 HTTP 201，业务 body 仅 `{ id, submittedAt }`，submittedAt 为首次提交的服务端 UTC 时间。不返回正文、举报人/目标个人资料、审核状态或其他举报记录。

| 场景 | HTTP / code |
| --- | --- |
| 无效身份或会话 | 401 / `ACCESS_TOKEN_INVALID`（沿用现有） |
| 格式、类别、说明、额外字段非法 | 400 / `VALIDATION_FAILED` |
| 合法成员举报自己 | 400 / `REPORT_TARGET_INVALID` |
| 房间不存在、举报人未加入、目标未加入或跨房间 | 404 / `REPORT_CONTEXT_NOT_FOUND` |
| 同一标识对应不同有效内容 | 409 / `REPORT_REQUEST_CONFLICT` |
| 未恢复的持久化失败 | 500 / `INTERNAL_ERROR`，不暴露底层信息 |

先认证和校验 DTO，再验证房间/举报人关系，避免向非成员披露目标信息。对于已登记的请求标识，认证成功后只读取该举报人的既有记录并比较内容：相同则返回凭据，不同则冲突；不查询或返回其他举报人的记录。

沿用 NestJS Swagger DTO/decorators code-first 生成 `openapi/openapi.yaml`，不手写第二份 contract；生成客户端不在本次范围。

### 3. 持久模型与重试

新增 `Report` model，独立 `prisma/models/report.prisma`：UUID id、roomId、reporterUserId、targetUserId、clientRequestId、category、description、submittedAt。类别使用显式映射的领域值与 Prisma enum，文本上限与数据库约束一致。

- 唯一约束 `(reporterUserId,clientRequestId)`；不按“房间+目标+类别”去重，因为新发生的事件可以是新的举报。
- 使用 `(roomId,reporterUserId)` 和 `(roomId,targetUserId)` 引用 membership 已有复合唯一键，确保同房间关系；关系采用 RESTRICT，禁止级联删除已保存举报。迁移若需要补充关系约束，保持现有数据有效。
- 建立 `(roomId,submittedAt,id)` 索引，便于审计关联；不因此增加查询接口。
- 扩展 RoomEvent 的举报类型及可空 `reportId` 唯一关联，历史事件该字段为空；举报事件必须关联 Report。审计只写 actor、target、room、category、result、occurredAt 和 reportId，不写正文。

同一 clientRequestId 比较 room、目标、类别和规范化正文。并发依靠数据库唯一约束；唯一冲突后结束失败事务，在新事务中按当前举报人重读并比较，返回原结果或稳定冲突。不得在已失败的 PostgreSQL 事务中继续查询。不同 room 的同一标识并发也必须通过该路径，不能仅依赖 room 行锁。

备选内存/Redis 去重不能跨重启保证数据库一致性；永久按目标去重会吞掉新的事件。两者均不采用。

### 4. 模块职责和同事务审计

`moderation` 拥有 Report、提交用例、输入策略与 repository port。薄 controller 只传入当前身份和 DTO，application 只使用无框架 domain 类型。

采用现有 `withLockedRoom` 的局部回调模式，新增举报专用的 repository 操作：在一个 PostgreSQL transaction 中获得 rooms 提供的举报上下文，调用 domain policy，保存 Report，再追加 RoomEvent。提交结果只能在事务成功之后返回。审计失败必须回滚 Report；不采用提交后再异步追加成功审计。

跨模块协作只通过公开入口：rooms 提供包含历史加入事实的最小上下文；audit 提供追加举报事件的能力。为复用同一个 transaction，两个模块可暴露专用 infrastructure 集成入口供 moderation adapter 调用；Prisma TransactionClient 只在这些 infrastructure 文件间传递，不进入 application/domain/controller 或全局 common。这里的例外仅服务当前原子事务需求，不创建泛化 UnitOfWork。不得深层导入 rooms/audit 的 repository 或复制其 lifecycle 规则。

前置 RoomEvent 如果暂归 rooms adapter 写入，本次把可共享的最小事件写入部分交给 audit 并通过公开入口复用，保留既有调用行为和事务。依赖方向为 moderation → rooms/audit，rooms → audit，audit 不依赖 moderation/rooms application；不使用 forwardRef。具体导出名与上游实现对齐，禁止为本次规划修改未完成上游文件。

事务只做数据库工作，无 LiveKit、Redis、webhook 或通知 side effect。数据库按统一 room 锁顺序读取上下文；唯一约束和外键是最后防线。leave/remove/end 并发只改变现状，不抹掉历史举报资格。

### 5. 隐私与权限失败

正文只存在 Report；审计保存标识，不复制正文。不注册查询/修改/广播接口，也不触发房主通知或任何处罚。必要技术日志采用固定事件名、requestId、reportId 和稳定结果码白名单，禁止把整个 DTO、异常对象或正文 JSON.stringify 后写日志。补 `description` 路径脱敏作为辅助防线，同时测试实际 logger 输出及错误响应，不能只测试配置数组。

本 change 不规定最终保留时长或自动清理；添加 FK 的目的是防止意外级联丢失，不代表已确定永久保留策略。后续删除/注销流程需独立方案处理。

## Risks / Trade-offs

- [Risk] 上游实时与房主管理 change 尚未落地 → 按 LiveKit → 房主管理 → 安全举报执行；proposal 可先评审，apply 首项核验实际 schema、公开接口、RoomEvent 与前置后端证据，缺失时停止依赖实现，不伪造临时 membership 模型。
- [Risk] 历史举报不要求同时在线，用户陈述未被平台验证 → 只标记提交成功，不认定事实、不自动处罚；后续审核另立 change。
- [Risk] 同一事务跨模块写入可能导致边界渗透 → 只通过明确的 infrastructure 公共集成入口共享 transaction，保留 domain 纯净，并执行 dependency check 与既有房间审计回归。
- [Risk] 新增唯一关联或 RESTRICT 影响历史数据/删除路径 → additive migration 在干净库和前置版本 fixture 上验证；拒绝破坏性删除，不改旧 migration。
- [Risk] 当前未定义举报频率限制 → 本次只保证单次请求幂等和字段上限，不声称已完成反滥用能力；限流参数列为后续产品决策。
- [Risk] 假 repository 无法证明并发、事务、外键 → PostgreSQL 集成测试与真实数据库 HTTP smoke 提供证据。

## Migration Plan

1. apply 前确认 LiveKit 的 RoomEvent 基础和房主管理的历史 membership lifecycle 已实现、两阶段迁移均可用，记录各自实际 revision 与测试证据；不要求它们先生产部署或归档，不把未完成的 provider 验证记作已通过。
2. 在固定 Node 24.21.0 下新增 Report、事件关联/类别与索引的 additive migration；历史 RoomEvent 的 reportId 保持空，原 room/membership 数据不变。
3. 对空数据库和带前置房间、历史 membership、审计事件的升级 fixture 应用 migration；验证外键、唯一约束、历史数据，以及失败时回滚。
4. 实施 endpoint、模块 wiring、错误映射和 code-first contract 后执行受影响范围验证。实际生产发布由后续 deployment 工作负责。
5. 应用回退到部署前版本时停止提供新举报 endpoint，保留新表、enum/可空列及已写审计，不做删表/删数据 down migration；旧版本在加法 schema 上的 room 基础流程需验证兼容。通过 forward fix 修复问题后恢复提交。

## Verification and Acceptance

- 单元：五类映射、码点长度、trim、身份字段拒绝、当前/历史资格、self/cross-room、请求内容比较、纯策略不依赖 NestJS/Prisma。
- PostgreSQL：正常写入、双边失败注入回滚、并发同标识、跨房间标识冲突、不同举报人隔离、FK/删除保护、leave/remove/end 并发与重启后重试。
- HTTP：有效身份与失效会话、历史成员和结束房间、非法 DTO、权限绕过、最小响应、稳定错误、没有新增查询或通知路径；至少一个基于真实 PostgreSQL 的登录→加入→离开/结束→举报→重试闭环。
- 回归：前置房主管理和事件审计、现有 auth/rooms HTTP、日志正文/凭证不泄露、OpenAPI drift、模块边界及格式。
- 全部实现完成后运行一次 `pnpm verify:api`、`pnpm format:check`、`pnpm deps:check`；失败后先做最小范围修复再重跑必要最终检查。
- `docs/acceptance/implement-safety-reporting-backend.md` 记录逐场景 PASS/FAIL/BLOCKED、命令、版本、实际数量与真实数据库 smoke。UI、真实设备与生产发布由后续对应 change 验证，本次不得把后端测试等同于整套产品已验收。
