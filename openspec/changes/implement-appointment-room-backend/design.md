## Context

动机与确认记录见 [proposal.md](./proposal.md)。2026-09-12 当前代码：Room 仅有 OPEN/ENDING/ENDED，没有 kind 或 reservation；即时创建同时建立房主 ACTIVE membership，默认两小时。rooms 的两个 Prisma repository 共用 Room 行锁；实际 join 只统计 ACTIVE，重进保留 membership 并换 identity。RoomRealtimeService 仅向 ACTIVE 发证，使用实际 membership 作为举报历史基础。

RealtimeRunner 复用一条 BullMQ 队列，启动及每 15 秒恢复到期/host-timeout/outbox。当前 runner 整体受 REALTIME_ENABLED 控制；不能直接将预约业务时间依赖于 provider 配置。历史 PRD 的“预约只表意向”与本次用户明确选择不一致，以本次占位决定为提案输入，不修改历史文档。

本 change 涉及生命周期、资格与共享容量，按 Level 2 给出迁移及回退边界。实现基于已交付的工作区，不把前置未完成 Cloud smoke 当作本次媒体验证。

## Goals / Non-Goals

**Goals:** 一个持久 Room 关联独立预约记录，保证时间边界、席位转换和失败恢复；维持现有实际 membership、房主管理和举报的含义。

**Non-Goals:** 不创建第二个运行时房间或第二套 provider/queue，不引入通用日历系统、改期、提醒、爽约处罚、分布式事务框架或不必要依赖；首次到场的 5 分钟接任和满 5 分钟后空房立即结束按用户补充纳入。产品范围及供审阅的细节见 proposal。

## Decisions

### 1. 同一 Room，独立预约记录

为 Room 增加 kind=INSTANT/APPOINTMENT，原记录默认 INSTANT；RoomStatus 追加 SCHEDULED/CANCELLED，现有 OPEN/ENDING/ENDED 继续使用。开始时间复用 startedAt，预约房间将其解释为计划开始时间；不以实际首次连接覆盖计划时间。取消用 cancelledAt 与固定 cancelledReason；取消不得伪装为 provider 清理已完成。另存 initialHostDeadline=startedAt+5min 与首次房主到场/接任完成标记；同一个 startedAt+5min 同时是空房保留期限，不从首次 HTTP 请求重新起算，不需要首次成员上线历史标记或另一套计时。

独立 RoomReservation model 保存 id、roomId、userId、status、version、bookedAt、cancelledAt、consumedAt；状态为 BOOKED/CANCELLED/CONSUMED/EXPIRED，(roomId,userId) 唯一。保留记录用于幂等与未来追踪，不实现历史查询界面。预约创建时房主自动占一个 BOOKED 席位，但不创建 RoomMembership；真正 join 成功时仍为指定房主才创建 role=HOST 的 membership；若已经移交则为 MEMBER。其他预约用户同样在实际 join 时创建 MEMBER。

这使“房主已排定房间”和“房主实际进入”不再混淆：创建者没有 membership 就不能借预约访问当前成员、取得实时凭证或举报。保留 Room.hostUserId 表示当前指定房主；本类型 OPEN 房间在房主首次加入前可以没有 ACTIVE HOST，这一明确例外不影响即时房间。用户选择允许此时成员交流，不能创建占位 HOST membership 假造加入事实。

备选在开始时另建即时 Room 会产生两个 ID、复制密码/容量、割裂预约与举报关系，故不采用。仅增加 membership=INVITED 也会污染已有历史加入和举报边界，故不采用。

### 2. 同一事务的席位预算

所有预约、取消预约、实际 join、邀请容量检查与房间状态变更共用 Room 行锁。定义：

- A：ACTIVE membership 用户集合。
- R：BOOKED 且尚未实际使用的预约用户集合（房间取消/结束后不再有效）。
- 已占容量 = |A ∪ R|，对外分别提供 memberCount=|A|、reservedCount=|R−A|、availableCount=capacity−|A∪R|。

预约用户 join 时，从 BOOKED 转 CONSUMED 与创建/恢复 membership 同一事务完成；既有 ACTIVE 的重复 join 不重复消耗。普通 join 仅能使用 availableCount；LEFT/被重邀用户重进也遵循此预算，不能抢未到场预约人的席位。现有 HostControlsService.invite 的容量检查同步调用相同预算，以免显示可以邀请而实际使用了别人的保留席位；邀请本身依旧不占位。

预约前校验当前账号、成年资料、规则和密码；join 再校验，不能把预约时的资格快照当作长期通行证。预约用户后续被停用则无法实际 join，席位按本次未设迟到/处罚释放的边界保留，直到其合法取消或房间结束；不自动发明新的账号处罚副作用。

创建者的一个 BOOKED 席位在首次 join 时消耗。普通用户未用预约可以在开始前或开放后取消；已 CONSUMED 的预约不能代替 leave。房主不能单独取消自己的未用保留位；开始前可取消整个房间。实际 join 后的 leave/remove 不重新创建 BOOKED，旧 reservation 不能绕过 REMOVED 或新 credential generation。

重用 reservation 行但递增 version：首次预约 expectedVersion=0；新建后 version=1，取消/再次预约继续增加。请求绑定 expectedReservationVersion；当前状态证明同一版本操作已完成时返回当前结果，否则冲突，防止旧取消删除新预约、旧预约复活已取消席位。实际消耗、整房取消和结束也更新 version，使旧请求失效。公开列表只给计数，本人详情给 reservation id/status/version，不暴露他人 userId。

### 3. 时间事实和房主首次缺席

创建使用带显式时区的 ISO 时间戳并规范化 UTC，start>数据库当前时间、end>start；复用已有主题/CEFR/2–6/密码校验。不开启新预约的边界为 now>=startedAt。未开始的房间可取消；取消请求锁内先比较数据库时间，到开始时刻不再接受整房取消，后续结束由真实入房后的现有房主管理入口处理。

统一的 rooms 时间转换入口在 Room 锁内执行：先判断 endsAt，再处理 startedAt；now>=endsAt 永不先开放，start<=now<end 才 SCHEDULED→OPEN。该入口供预约详情/列表、join、预约 mutation 和后台 job 共用。列表不能只筛物理 status 而漏掉 worker 延迟的到点房间；候选按时间获取后通过同一公开转换入口核对并投影。READ 路径触发时间结算属于服务器事实更新，不创建 membership 或 provider room。

- 开始前 join 返回 ROOM_NOT_STARTED 和 startsAt；预约记录不允许发证。
- 到点普通预约成员可以先入房，无需 creator 已到场；首次缺席不创建 60 秒 hostDisconnectedAt/deadline，也不伪造 left 事件。首次到场独立使用 startedAt+5min。
- 房主真正 join 才产生实际 membership，但是否按时“到场”以验签、去重、当前 identity/session 的可信 CONNECTED 观察为准，预约、HTTP join 或签发 token 本身不等于上线。到场后不再执行首次接任，但 5 分钟空房检查仍然有效；此后 60 秒窗口、leave/transfer/end 继续适用，满 5 分钟后的空房立即结束优先于断线等待。重连窗口仍暂停非 ACTIVE join，包括未入房预约者；预约保障不绕过该窗口或账号限制。
- 满 5 分钟未收到指定房主上线事实时，选择在线、账号有效、ACTIVE 的非房主成员中 joinOrder 最小者（第二麦）接任；不按预约先后，也不选仅持预约的用户。原房主可能尚无 membership，也可能已通过 HTTP join 但未连上媒体：前者只改 hostUserId 与接任者 role，后者还要原子降为 MEMBER。不能直接调用假定 previous membership 必定存在的 transferLocked，需在 rooms 公共事务中兼容此首次场景并复用移交审计/版本规则。
- 从 startedAt 起未满 5 分钟允许空房；满 5 分钟的同一次结算先检查当前在线成员，为零直接结束（原因 EMPTY_AFTER_START_WINDOW），不再等待后续成员。若仍有人在线但指定房主从未上线，才执行上述第二麦接任。已发生过实际主动结束或更早到达 endsAt 时仍立即结束，不保证房间必须存活满 5 分钟。
- 满 5 分钟后，每次可信 presence 离线、leave、remove 或对账使当前在线成员归零，都在同一 Room 事务内启动结束并拒绝后续 join/token；即使此前有人上线也一样结束。最后一人断线不再额外等待 60 秒；仍有在线成员时继续既有房主断线规则。在线以当前有效 identity/session 的可信 CONNECTED 状态为准，BOOKED、仅 HTTP join 或离线 ACTIVE 都不算在线。
- 复用已有验签、事件去重和 provider 对账更新当前 presence，状态变化与空房判定共用 Room 锁；到点任务和请求时结算执行相同判断。provider 清理失败继续现有 ENDING/outbox 恢复，不新加到场历史查询、待核实状态或延后结束期限。迟到或旧身份事件不能复活已结束房间。
- 定时任务与迟到事件按持久初始 deadline、指定房主和独立版本重新校验；成员普通 stateVersion 变更不取消 timer。超过截止的 job 不赠送新等待窗口，房间已结束的迟到 joined 不能恢复资格。

### 4. 取消、到期和恢复调度

SCHEDULED→CANCELLED 只由房主在开始前取消触发，取消后所有未用预约转 CANCELLED，记录 audit。此时没有已授权 membership 或 provider room，不能为清理创建 LiveKit room。取消重复请求幂等；到开始时刻或之后返回稳定已开始冲突。

开放后的主动结束与到期复用 RoomRealtimeService 的公共结束事务：失效所有 BOOKED（转 EXPIRED），拒绝 join/token；存在 providerRoomSid 或 identity 历史则走既有 ENDING/revoke/delete。对于一直无人实际加入、从未建立 provider 的预约，包括服务停机跨过整个时间段的 SCHEDULED，允许在同一公共结束入口直接完成 ENDED 并审计，不调用 provider 的 create/delete；这一优化不得仅凭“当前无人在线”跳过已签发身份的撤销。

向现有 RealtimeQueue 增加 appointment-open 和 appointment-start-window（5 分钟，先空房结束、再判断首次房主接任）job，用 room ID、计划 deadline/独立版本组成合法确定性 ID；计划结束仍由原 expiry 处理。数据库 Room 的 kind/status/time 是持久调度事实，启动及周期扫描补排 job；重复、取消后的旧 job 和服务重启均重新锁房确认。不新建一套 Redis 队列或预约 worker 进程。

将业务时间结算与 provider 对账的启用条件分开：REALTIME_ENABLED=false 时预约创建/显示/时间边界仍可运行；Redis 缺失也不能提前开放、允许过期加入或永久卡住 SCHEDULED。周期数据库结算和请求时结算均可执行；只在实际配置 Redis 时排队加速，媒体侧仍使用原开关。检查当前 runner 的启动条件与独立 publisher/consumer 生命周期，避免为了预约偷偷要求 Cloud key。此处仅拆已有职责，不引入新的调度框架。

### 5. HTTP 与唯一 contract

新增预约专用路由，复用 Bearer、全局验证和稳定错误。所有 DTO/decorator 由 NestJS code-first 生成唯一 `openapi/openapi.yaml`，不在 planning 阶段修改 contract。

| Endpoint | 提议请求/结果 |
| --- | --- |
| POST /v1/appointment-rooms | topic、cefrLevel、capacity、startsAt、endsAt、可选 password；201 预约详情及房主 reservation |
| GET /v1/appointment-rooms | 有限 cursor/limit；展示 SCHEDULED 和未结束 OPEN 预约，时间结算后投影 |
| GET /v1/appointment-rooms/{roomId} | 返回预约状态、计数和本人 reservation；包括已取消/结束的已知 ID，不提供其他人的预约名单 |
| POST /v1/appointment-rooms/{roomId}/reservations | rulesAccepted、可选 password、expectedReservationVersion；201 本人预约结果 |
| POST /v1/appointment-rooms/{roomId}/reservation-cancellations | expectedReservationVersion；200 本人取消结果，已使用或房主单独取消受限 |
| POST /v1/appointment-rooms/{roomId}/cancellations | 仅房主且未开始；200 房间取消状态，重复取消幂等 |

实际 join 仍是 POST /v1/rooms/{roomId}/memberships，发证、当前成员、leave/remove/invite/end/report 继续使用已交付路由。GET /v1/rooms 默认只列 INSTANT，原 POST /rooms 不新增必填字段；预约已经开放后用统一实际会话接口，但未开始/已取消不被误判成普通可加入房间。

稳定错误补 ROOM_NOT_STARTED、ROOM_CANCELLED、APPOINTMENT_ALREADY_STARTED、APPOINTMENT_BOOKING_CLOSED、RESERVATION_CONFLICT、RESERVATION_ALREADY_USED、RESERVATION_OWNER_REQUIRED、ROOM_RESERVED（物理空位被其他预约保护），复用 ROOM_FULL、ROOM_HOST_REQUIRED、ROOM_ACCOUNT_RESTRICTED、ROOM_HOST_RECONNECTING/retryAt、ROOM_ENDED 及资格/密码错误。未开始错误带 startsAt；已取消/已结束不包含密码、provider 细节。房主原 end 的 provider pending/unavailable 语义保持一致。

无新增公开预约人列表、他人预约取消或自动通知 API；客户端在后续 Figma change 中适配，不在这里手改 generated client 或前端。

## Risks / Trade-offs

- [Risk] 预约与 ACTIVE 双计或普通 join 抢位 → Room 行锁内统一集合预算，覆盖保留一席时的预约/取消/join/rejoin/invite 竞争；回归即时容量。
- [Risk] 无 membership 的首次房主被当作断线 → 不为预订生成 membership 或伪造 presence；显式测试成员先进入、5 分钟接任或空房结束、满 5 分钟后末人退出/断线即结束、仍有成员时房主 60 秒断线四类路径。
- [Risk] 未到场预约长期持有席位 → 本次用户选择保障预约，不擅自引入迟到释放；无 show-up/处罚自动化，不把这描述为已解决反滥用问题。
- [Risk] 时间任务停机或 Cloud 配置关闭 → 数据库与请求时结算独立于媒体服务；先结束后开放，Redis 只加速，扫描从持久时间恢复。
- [Risk] 已签发但离线的身份被误当作空房跳过撤销 → 快速结束仅限无 provider SID 且无 identity 历史，其他情况完整复用 revoke/delete。
- [Risk] shared RoomStatus 扩展影响旧客户端和授权 → 即时 API 默认隔离 kind，新增预约 DTO 明确状态，逐一回归 detail/join/token/host/report 与末位规则。
- [Trade-off] 预约会保留房主一个名额，即便从未到场 → 容量包括房主，保证其晚到时不会挤掉预约用户；细节随提案审阅，不宣称已获产品验收。

## Migration Plan

1. apply 前确认前置六段迁移、rooms 公共事务、审计、provider/outbox 和 196 测试验收基线仍有效。只添加新的迁移，历史 Room backfill INSTANT，时间/身份/举报不重写。
2. 新增 kind、两个状态、取消元数据和 RoomReservation model/enum/索引/外键；为历史房间保持 reservation=0。使用数据库约束限制日期关系与预约版本有效值，不改变历史即时房间的时间含义。
3. 在空库完整升级链，以及带 OPEN/ENDING/ENDED、LEFT/REMOVED、identity/outbox/Report/RoomEvent 的 fixture 上升级，核对数据、RESTRICT 防线与旧即时创建/查询/join 兼容。
4. 将新 schema 和理解 kind/席位预算的 join/预约/worker 同批部署；未支持预约的旧 join 不能与新实例混跑接收预约房间请求，否则可能忽略保留位。
5. 回滚先关闭预约创建、预约 mutation 及预约房间 join/token；停止新开放并取消未开始房间，已开放会话通过现有撤销结束后退出新版。保留新增列、reservation 和审计数据，不做破坏性 down migration；provider 不可用时保持入口关闭并保留补偿 worker，优先 forward fix。

## Verification and Acceptance

- 定向规则/数据库：UTC与时区输入、开始/结束前后1毫秒、容量/预约消耗、版本重放、房主保留位、事务失败回滚、无实际加入者无举报资格；5 分钟前后1毫秒、满 5 分钟无人在线、之后末人退出/断线/移除、曾上线后为空、房主到场未取消空房检查及迟到旧房主。
- HTTP：六个新入口的鉴权、最小信息、取消/开始冲突、预约用户及普通用户实际 join、密码/资格复查、首次房主缺席/晚到、已取消/过期拒绝、既有接口兼容。
- 运行时：真实 PostgreSQL/Redis，丢任务/重启/跨过整个时间段、REALTIME_ENABLED=false 和 Redis 不可用、无 provider 的快速结束与已有 identity 的完整 cleanup。
- 完成全部实现后运行一次 pnpm verify:api、pnpm format:check、pnpm deps:check；开发中仅跑当前受影响的最小检查，失败先定向修复。验收记录按场景和准确数量归档证据，不将规划校验当作功能通过。
- 本 change 提案阶段不运行业务测试或媒体 smoke。实施可先交付本地 fake-provider + 真实数据库/队列证据；两成员在预约时间窗口内的真实音频、实际到期断开与 provider 故障恢复需后续隔离 Cloud/设备证据，明确保留未完成项，不冒充已部署或产品已接受。
