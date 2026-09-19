## Context

动机与拆分范围见 [proposal.md](./proposal.md)。当前代码只有即时房间 create/list/detail/join、Room 行锁与唯一 membership；`implement-livekit-voice-session-backend` 仍是未实现计划。因此下面的 provider、presence、事件/outbox 和结束流程是前置交付要求，不是当前代码已具备的能力。

本 change 属于 Level 2：涉及房主权限、成员授权状态、旧 token 和并发移交。需求来自 current `host-controls`、`voice-session`、`basic-safety-reporting` 及本 change 两份 delta。它不改写 main specs，规划完成后仍需独立实施与验证。

## Goals / Non-Goals

**Goals:** 以 PostgreSQL 为事实来源，复用 LiveKit 基础形成可重试的成员退出、移除、邀请、房主移交、60 秒恢复和主动结束闭环；明确授权生效与 provider 清理完成的区别。

**Non-Goals:** 不另建 provider 或 queue；不在 domain 引入 SDK；不新增独立管理服务；不以本地 fake provider 测试代替真实撤销和设备证据。

## Decisions

### 1. 前置依赖与模块所有权

严格先实施 [LiveKit change](../implement-livekit-voice-session-backend/design.md)。开始本 change 前核对其验收记录中的实际公开 application API、provider revoke/list/delete、签名/幂等 presence、RoomEvent、RealtimeCommand、身份历史、BullMQ 和公共结束入口。缺项回到前置 change 解决，不在本 change 创建平行实现；前置 Cloud smoke BLOCKED 时继承该限制，不能声称旧 token 边界通过。

`rooms` application/domain 拥有成员与房主规则、事务和管理 HTTP。`voice` 接收可信 presence 事件并调用 rooms 公开 API，在原有 worker 中执行 host-timeout 和 provider commands；rooms 不导入 voice 内部 service，不形成循环。复用真实已存在的基础优于第二套 host-control adapter 或共享全局业务 service。

### 2. 成员 lifecycle 与独立迁移

在前置 membership 上增加 `ACTIVE/LEFT/REMOVED/INVITED`、`leftAt`、`removedAt` 和可选规范化原因；现有行 backfill 为 ACTIVE，保留 `(roomId,userId)`、joinOrder、provider identity 历史与外键。Room 增加 `hostDisconnectedAt`、`hostReconnectDeadline` 和独立 `hostReconnectVersion`；通用 `stateVersion` 沿用前置字段。

独立 reconnect version 只随房主身份或断线窗口变化，避免普通成员动作使仍有效的超时任务作废。其余状态冲突仍使用 Room 行锁/stateVersion；不复制 RoomEvent/RealtimeCommand 表或前置迁移。

- ACTIVE 占容量且在授权条件满足时可发证，断网仍保持 ACTIVE。
- 普通成员显式 leave 转 LEFT，释放容量、失效旧 credential version，并原子追加旧 identity 撤销命令。
- LEFT 重进必须再次通过账号、规则、密码、房间与容量校验，分配全房历史最大 joinOrder 加一和全新 identity/version。
- 房主移除目标后转 REMOVED；被移除者不能自助加入或签发 token。
- 房主重邀 REMOVED 成员转 INVITED；邀请时与实际 join 时均校验账号、房间状态和容量，邀请不预留席位。重邀不绕过现有平台限制判断，也不在此实现安全员处罚系统。
- INVITED 成功 join 转 ACTIVE，分配新 identity 与末位 joinOrder。历史 identity 的重试撤销只针对原 identity，不能伤及新会话。

当前列表、详情与容量统一只统计 ACTIVE；成员投影按 joinOrder 排序，离开后显示序号前移但不重写历史 order。presence 与资格分离，异常断线不等价于主动离开。删除 membership 再创建会损失移除链与审计，故保留原行。

### 3. 房主管理授权、幂等与并发

每次管理事务锁住 Room，并从数据库读取当前 hostUserId/role 与 actor 的 ACTIVE membership；不信任客户端声明或旧 token 中的房主身份。目标必须属于同一房间，禁止通过移除自己绕过房主退出流程。结束/过期状态拒绝新管理动作，账号资格继续使用已有公开 eligibility 边界。

主动 leave、remove、invite、transfer、host end 与 join/expiry 共用 Room 锁，保证唯一房主和容量。重复动作依据 actor、目标 lifecycle/credential generation、房间版本与已有 command 识别，返回已提交结果或稳定冲突；不得对重进后的新 session 重放旧移除、对新房主重放旧移交。已提交旧命令的结果可以返回原 actor，但不能据此授予新的管理权限。

管理 mutation、RoomEvent 和 RealtimeCommand 原子提交。事件保留 actor、target、reason、time、result/source，失败/拒绝动作记录规范化结果；不记录 raw webhook、JWT、secret 或无关个人信息。数据库立即关闭被移除者资格，provider 首试/重试沿用前置 dispatcher；失败返回稳定 `REALTIME_PROVIDER_UNAVAILABLE` 与已提交操作状态，不把“资格已撤销”误报为“连接已断开”。同一动作重试不得重复写成功审计或命令。

### 4. 主动离开、指定与默认接任

`POST /v1/rooms/{roomId}/leave` 普通成员不接受指定接任者；房主可以传 `successorMembershipId`。在同一事务中检查目标为当前房间 ACTIVE、connected 且非自己，指定目标无效时返回 `ROOM_SUCCESSOR_INVALID`，原房主保持不变，不静默改用默认接任者。

未指定时从除原房主外的当前在线 ACTIVE 成员中选最小 joinOrder（默认第二麦）；所有候选已离开/断线则调用公共结束入口。成功转移时原子更新 hostUserId 与双方角色，再令原房主 LEFT，并清理旧房主断线窗口；并发候选 leave、remove、host timeout 或 expiry 必须序列化重新校验，任何时候不能产生两个房主。

复用前置成员列表供后续 UI 获取候选，本 change 只提供数据和校验，不创建选择器 UI。

### 5. 60 秒窗口、暂停加入与恢复

把房主断线判定接入前置已验签、去重、按 session/事件时间处理的 presence transaction；持久接收事件与设置 deadline/审计/调度命令原子完成，避免“事件标记已处理后进程崩溃”漏设窗口。原始 webhook 自称主动 leave 无效，主动退出只能来自认证 HTTP。

当前房主异常断线后写 `hostReconnectDeadline=可信断线事件时间+60s`，递增 `hostReconnectVersion`，向已有队列提交包含 room ID/version 的合法确定性 job ID；事件明显过期时立即对账并按已有 deadline 执行，不重新赠送 60 秒。只有当前房主、当前 identity/session 的按时恢复才能清除窗口并使旧 timer 失效。迟到旧 left 不开启新窗口，迟到 joined 不从已移交状态夺回房主。

窗口内 ACTIVE 成员可继续交流/恢复 token；新用户、LEFT 与 INVITED 加入返回 `ROOM_HOST_RECONNECTING` 和 `retryAt`，不创建资格或占位。当前 ACTIVE 的重复 join 仍幂等。deadline 已过但 job 尚未运行时，加入路径先要求窗口结算或继续返回稳定重试结果，不能因时间到达就自行绕过未完成接任。

host-timeout job 重新锁房，核对 expected host、identity、reconnect version 和数据库 deadline；按时恢复/已移交/已结束则 no-op，仍超时则按在线 joinOrder 移交或结束。到 `endsAt` 时优先结束，不再接任。Webhook 完全丢失时由前置 provider reconciliation 的可信观察补入相同规则，不能凭空声称精确知道未观察到的断线时间。

启动与周期 reconciliation 从数据库补排遗失 host-timeout，Redis 丢数据不改变授权事实。Redis/provider 故障可延迟执行，记录 queue lag 和 pending；不提前转移，也不能无限暂停新加入而不安排恢复任务。

### 6. 主动结束与旧凭证边界

`POST /v1/rooms/{roomId}/end` 验证当前房主后，调用 LiveKit change 的公共结束事务，并记录 actor 与主动结束原因。无接任者、重连超时无候选也调用该入口；到期触发仍由前置 change 拥有，不新增第二个 expiry worker。

共用 `OPEN -> ENDING -> ENDED`：数据库先拒绝 join/token，复用身份历史撤销全部未撤销 identity，DeleteRoom 完成后结束。每个 revoke 使用正确的旧 identity 与执行时 cutoff，不因 provider 重试影响被邀请后分配的新 identity；结束流程重试不得重新创建 provider room。真实撤销和已离线 token 拒绝必须有 Cloud 证据，TTL 或 DeleteRoom 单独成功不足以证明。

### 7. HTTP 与错误 contract

所有新增入口使用用户 Bearer 鉴权：

| Endpoint | 请求/结果与验证 |
| --- | --- |
| `POST /v1/rooms/{roomId}/leave` | 可选 successorMembershipId；返回退出、接任或结束状态及 provider 执行结果 |
| `POST /v1/rooms/{roomId}/members/{membershipId}/removals` | 当前房主移除当前目标，返回 lifecycle/操作状态 |
| `POST /v1/rooms/{roomId}/members/{membershipId}/invitations` | 当前房主重新授予加入资格，不预留容量 |
| `POST /v1/rooms/{roomId}/end` | 当前房主发起公共结束，响应区分 ENDING 与 ENDED |

扩展既有 memberships join、members 查询和 realtime-credentials 授权，不重复创建 endpoint。HTTP DTO 携带防止延迟管理请求作用于新 generation 所需的目标版本，并将已提交结果/冲突语义写入生成 contract。稳定错误至少有 `ROOM_HOST_REQUIRED`、`ROOM_MEMBER_NOT_ACTIVE`、`ROOM_INVITATION_REQUIRED`、`ROOM_SUCCESSOR_INVALID`、`ROOM_HOST_RECONNECTING`，复用既有 membership、容量、结束与 provider unavailable 错误。

NestJS code-first decorator/DTO 确定性生成 `openapi/openapi.yaml`；验证 401/403、跨房间目标、旧房主直接请求、无效接任者、超时/到期冲突与 provider pending，不保留第二份手写 contract。

### 8. 验收覆盖与拆分交接

| 需求/场景 | 本 change 的可观察证据 |
| --- | --- |
| 房主移除/重新邀请、限制不可绕过 | 权限 E2E、并发容量测试、移除旧 token 拒绝与新 identity 重入 smoke |
| 指定/默认接任、无接任者 | Room 行锁集成测试、唯一 host/角色一致性、公共结束调用 |
| 麦位离开前移、重进末位 | repository/成员 DTO 与 join/leave E2E |
| 60 秒恢复、超时接任或结束 | 冻结时钟、乱序/丢失 webhook、真实 Redis job/restart、边界竞争 |
| 窗口内已有会话继续、新加入暂停 | ACTIVE 恢复和新用户/LEFT/INVITED 拒绝的 HTTP 测试；设备音频后续验收 |
| 房主主动结束、到期竞争 | 复用结束路径、全部旧 identity 撤销、没有重复 expiry worker |
| 关键事件审计与服务端鉴权 | actor/target/result 审计断言、非房主/旧房主/跨房间请求均不改变状态 |

最终记录本地测试、真实 provider smoke 和未来产品验收的各自状态。前置 revoke adapter smoke 不代替本次“移除 → 阻断 → 重邀 → 新会话”业务 smoke。没有隔离 Cloud 凭证则 provider 项保持 BLOCKED；当前代码无变更，规划校验不能被写为上述测试通过。

## Risks / Trade-offs

- [Risk] 依赖尚未实施 → 第一任务核验 LiveKit 交付，不并行修改同一底层能力；保持这两个 change 的依赖顺序。
- [Risk] 普通成员操作意外作废断线任务 → 独立 hostReconnectVersion、行锁及启动补排，并测试窗口内成员 leave/remove 与 timeout 竞争。
- [Risk] 旧 webhook 或旧管理请求影响新会话 → 前置 session 水位、当前 identity/版本校验；管理请求绑定目标 generation。
- [Risk] provider 已失败但数据库已提交 → 资格先关闭、durable command 补偿、返回 pending/unavailable，验证恢复后最终断开。
- [Risk] 并发移交、退出和到期冲突 → 同一 Room 锁，结束优先，重复/过期任务无副作用。
- [Trade-off] 独立 change 增加一次迁移与交接 → 换取明确所有权；不得重写已落地的 LiveKit migration 或复制其 schema。

## Migration Plan

1. 在前置 LiveKit 实现的数据库上追加 membership lifecycle、退出/移除字段和 hostReconnect deadline/version；以单 model 文件维护 Prisma，backfill ACTIVE 并保留既有身份历史、命令、joinOrder 与外键。
2. 验证空库完整升级链，以及含连接中成员、ENDING 房间、历史 identity、pending command 的升级 fixture。更新列表/详情/容量查询，确保旧数据不丢失且 inactive 不再占位。
3. 部署时先迁移，再发布 rooms lifecycle、管理 API、窗口授权检查和 worker 的同一兼容版本；受控联调完成前不开放完整产品。旧版本不认识 REMOVED/INVITED 或窗口语义，禁止与新版本混合接收 join/token。
4. 执行本地验证、隔离 Cloud 管理业务 smoke 和运行时恢复检查，记录 release state 为未部署，除非另有实际发布证据。

回滚必须先关闭新加入/发证与管理入口，完成活动 provider 会话撤销/结束后再退回前置版本；不能退回不认识 REMOVED 的旧应用继续对外发证。provider 不可用时维持授权关闭并保留补偿 worker，等待恢复或 forward fix。数据库保留新增字段、RoomEvent 和 command 历史，不做破坏性 down migration；迁移恢复演练验证限制不会丢失。
