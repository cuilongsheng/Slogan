## Context

动机见 [proposal.md](./proposal.md)。当前 `rooms` 已实现 create/list/detail/join，repository 使用 PostgreSQL 房间行锁，membership 唯一 `(roomId,userId)` 并保存 `joinOrder`。Room 只有 `OPEN/ENDED`；voice、LiveKit 基础仍是空骨架，当前 API 依赖没有 LiveKit、Redis 或 BullMQ。

原混合提案按用户确认拆分。本文及本 change tasks 只拥有实时基础；[房主管理设计](../implement-host-controls-backend/design.md) 消费这些基础，不能反向成为本 change 的实施依赖。当前产品 requirements 没有被削减，分阶段交付不等于完整产品已接受。

## Goals / Non-Goals

**Goals:** 建立授权、最小权限 token、可信 presence、到期结束、审计/outbox 与 provider 补偿闭环，并提供可供下一 change 调用的真实边界。

**Non-Goals:** 不提前实现房主权限变化、成员主动离开/重进、移除/邀请状态、房主 60 秒 timer 或管理 endpoint；不把前端/设备验收当作后端测试结果。

## Decisions

### 1. 模块边界与依赖交付

`rooms` 拥有房间、membership、容量、joinOrder、Room 状态与所有数据库事务。`voice` 拥有凭证、Webhook 编排、任务 handler 与 provider reconciliation，通过 rooms 的公开 application API 工作。LiveKit SDK 只进入 infrastructure adapter，domain 和 Controller 不依赖 SDK。

不建立 `rooms <-> voice` 循环导入：rooms 只提交业务事实和 provider-neutral outbox，voice dispatcher 消费；不建通用事件平台或假想多 provider 抽象。下一 change 复用下表，不能另建同名基础：

| 本 change 交付 | 后续房主管理的使用方式 |
| --- | --- |
| 当前成员/房间授权快照与锁内事务 API | 扩展 leave/remove/invite/transfer policy，复用容量和版本保护 |
| 验签、幂等、按 identity/session 和 provider 时间归一的 presence 更新 | 在同一持久处理事务中接入房主断线/恢复规则 |
| RoomEvent、RealtimeCommand、身份历史与补偿 dispatcher | 新增管理事件和 revoke command 的业务生产者 |
| `OPEN -> ENDING -> ENDED` 与结束事务入口 | host end、无接任者和超时调用同一入口 |
| provider revoke/list/delete、BullMQ、到期任务和 reconciliation | 增加 host-timeout handler/deadline，不复制 queue 或 adapter |

交付记录需写出实际公开入口、参数、事务归属、事件字段和验证证据，不能只保留占位接口。

### 2. 实时数据与状态

Room 增加 `ENDING`、`stateVersion`、`endedReason/endedAt`。membership 增加随机 `participantIdentity`、`credentialVersion`、presence 状态及 provider session 标识/时间水位；初始 identity 使用随机 UUID，不含 user ID、昵称等资料。保留历史已授权 identity 及撤销状态，用于结束时覆盖旧 token；不保存 JWT。

现有 membership 继续代表有效且占容量的资格。presence 仅描述连接观察，断线不能删除 membership 或释放容量。LEFT/REMOVED/INVITED、离开时间、重进 joinOrder 与 memberCount 的 lifecycle 过滤，全部在房主管理 change 新增；本次不提前建立不可用的管理状态。

Room 终态与到期检查必须同时约束 join、凭证和成员查询。`ENDING` 立即拒绝新 join/token，provider 清理完成后成为 `ENDED`，状态不能倒退。`endsAt` 到点即拒绝授权，worker 延迟不能延长资格。

### 3. Token、provider 与撤销边界

`POST /v1/rooms/{roomId}/realtime-credentials` 从 access identity 校验账号资格、membership、Room 状态和到期时间。响应只含 `serverUrl`、`participantToken`、`expiresAt`、opaque `participantIdentity` 和 `roomId`。provider room 名使用不复用的 `room-<UUID>`，首次签发前幂等确保 provider room 存在，以业务 capacity 设防御性上限。

TTL 默认 5 分钟，可配置 60–600 秒；grant 仅有目标 room 的加入、订阅与 microphone publish，显式禁用 data、metadata 自修改，以及 admin/create/record/video/screen 权限。不得将 PII 放入 identity、room name 或 metadata，也不记录 token/secret/raw webhook。默认静音是未来 client 行为。

沿用原提案的 LiveKit Cloud 撤销目标：adapter 的 remove/revoke 使用每次执行时的显式 cutoff，覆盖已离线 identity；清理完成必须代表旧 token 不能重新连接。具体 SDK 参数、离线返回语义、时钟容差和并发发证竞态必须在实现时验证；单独收到 not-found 不能当作已撤销证据。不以短 TTL 替代撤销，不静默改为 self-hosted。

发证前后用房间/credential version 校验，结束与发证竞争时禁止返回过期授权；provider 副作用在事务外执行。对已发出或可能暴露的旧 identity 均保留可追踪撤销记录。若 provider 无法证明目标，停止相关验收并报告，不降低安全目标。

### 4. Webhook 与 presence reconciliation

`POST /v1/webhooks/livekit` 仅用 provider 签名鉴权；NestJS 保留 raw body，接受 `application/webhook+json`，由 SDK `WebhookReceiver` 验证 Authorization 与原始内容。验签失败 401，无业务 mutation；用户 Bearer token 不能代替签名。

provider event ID 唯一持久化。验证 room/当前 identity、provider session 与时间水位，处理 joined、left、connection-aborted、room-finished；迟到的旧 session left 不能将新连接标成断开，重复事件返回 2xx 且不重复副作用。未知或旧 identity 不创建 membership，记录最小诊断字段并撤销可确认的失效 identity。重连仅更新 presence，不移交房主。

room-finished 需核对当前 provider room 实例；对已开放且确实结束的实例推进公共结束路径，对无法判定的事件先 reconciliation，不能凭迟到信号终结后续实例。provider presence 不是授权来源，周期 list reconciliation 补齐丢失事件、清理 stale identity 并恢复 pending commands。

### 5. 到期、事务与 durable command

领域状态、RoomEvent 和 RealtimeCommand 在同一 PostgreSQL transaction 保存；唯一 `(type, aggregateId, stateVersion)` 或等价业务幂等键去重。提交后同步首试 provider 操作，失败保留 pending 并由 BullMQ 有限指数退避，失败记录可诊断且不含敏感原文。worker 支持安全 claim/lease、崩溃重取和重复执行，不在数据库锁内等待 provider。

到期任务以 room ID 和 endsAt 形成合法的确定性 job ID（实现须遵守所选 BullMQ ID 限制）；worker 重新锁房、校验版本和数据库时间，进入 ENDING，撤销全部未撤销 identity 后 DeleteRoom，全部成功才 ENDED。DeleteRoom 本身不作为旧凭证全部失效的证明。

Redis 只协调任务；数据库保存 endsAt、Room 状态和 command 状态。启动/周期 reconciliation 补排遗失 expiry job 和 pending command。Redis 中断可延迟实际断开，但资格检查在 endsAt 无宽限地关闭；如实记录清理延迟，不将基础设施故障说成即时 provider 成功。

### 6. HTTP 与唯一 contract

只新增下列三个 endpoint：

- `POST /v1/rooms/{roomId}/realtime-credentials`：用户鉴权和 membership 校验。
- `GET /v1/rooms/{roomId}/members`：只向当前有效成员返回 membership ID、昵称、CEFR、角色、麦位、presence 与当前 opaque identity，不返回出生、地区、provider SID 或历史私密原因。
- `POST /v1/webhooks/livekit`：provider 验签，无用户 Bearer guard。

现有 join 保持幂等与资格/密码/规则/容量检查，补上 ENDING 与到期拦截。稳定错误包括 `ROOM_MEMBERSHIP_REQUIRED`、`REALTIME_PROVIDER_UNAVAILABLE`、`REALTIME_WEBHOOK_INVALID` 和既有房间错误。leave/removals/invitations/end、重进与 `ROOM_HOST_RECONNECTING` 在下一 change 增加。

沿用 NestJS decorator/DTO code-first 确定性生成唯一 `openapi/openapi.yaml`；不维护手写副本。

### 7. 验证与受控交付

本地证据覆盖真实 PostgreSQL migration、授权/发证/结束竞争、事件幂等与倒序、真实 Redis 重试及恢复、SDK token claims/签名、fake provider HTTP E2E、OpenAPI drift 和模块边界。真实 Cloud smoke 验证连接、最小权限、在线及离线 identity 撤销后的旧 token 拒绝、DeleteRoom 断开和签名 webhook；无凭证时写 BLOCKED，不能用 fake adapter 替代 provider PASS。

验收矩阵将 host end 触发、leave/rejoin、移除/邀请、房主移交与断线窗口标为由下一 change 覆盖，不能声明整个 current voice-session/host-controls 已完成。前端静音、双向音频、重连 UI、设备权限留给后续真机验收；未实现房主管理前只允许受控基础联调。

## Risks / Trade-offs

- [Risk] 分阶段基础还没有房主管理 → 在交付记录明确后续依赖，完整产品发布前必须完成 host-controls；不把移出的 requirement 标 PASS。
- [Risk] Webhook 丢失/倒序 → 持久 inbox、session/时间水位与 provider reconciliation；后续房主 timer 复用相同事件处理。
- [Risk] 数据库提交后 provider/Redis 失败 → 授权先关闭，durable command 补偿；状态如实保持 ENDING/pending，不伪报断开完成。
- [Risk] 撤销与发证并发或 Cloud 行为不符 → 版本校验、身份历史、真实在线/离线旧 token smoke；未证明前不可接受安全边界。
- [Trade-off] worker 与 API 同进程 → 减少部署单元，保留可恢复任务与失败观测；不提前拆微服务。

## Migration Plan

1. 固定 SDK、Redis、BullMQ 版本，按 `.nvmrc` 验证安装；增加 `REALTIME_ENABLED`、`LIVEKIT_URL/API_KEY/API_SECRET`、TTL、`REDIS_URL` 条件校验与日志脱敏。
2. additive migration 只增加本 change 实时字段、状态、身份历史、RoomEvent/RealtimeCommand 与索引，保留现有 membership、joinOrder 和外键；对空库和含即时房间 fixture 的升级库验证。
3. 先迁移数据库、部署 Redis 与关闭 realtime 的应用，再在隔离环境启用 adapter、Webhook 与 worker，验证恢复和 Cloud smoke。实际部署由独立发布工作执行，本次不声称上线。
4. 输出供 host-controls 使用的依赖证据。因真实 provider 验证未完成而 BLOCKED 的项必须传递给下一 change，不能因任务勾选或归档而被消除。

回滚先停发新凭证，通过仍可工作的 provider 清理撤销已发 identity 并删除活动 provider room，再停止 worker/退回旧应用；provider 故障时保持隔离与补偿进程，不能关闭恢复路径后宣称安全回滚。保留新增数据库字段、事件与命令，采用 forward fix，不破坏审计事实。
