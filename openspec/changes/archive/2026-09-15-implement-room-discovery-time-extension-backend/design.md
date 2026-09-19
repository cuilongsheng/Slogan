## Context

参见 [proposal.md](./proposal.md) 的 Why。当前 `Room` 已保存 `kind`、主题、CEFR、密码摘要、状态、`endsAt` 和单调 `stateVersion`，即时房间与预约房间分别通过 `/v1/rooms` 和 `/v1/appointments` 查询。两套列表目前只有游标与页大小，所有房间也没有可见性、分享标识或延长事实。

房间结束已经采用 PostgreSQL 状态、BullMQ 延迟任务和恢复扫描：请求路径按持久 `endsAt` 判断，旧或延迟任务进入结束服务后再次检查房间时间。LiveKit 控制面已有 provider port 和 PostgreSQL `RealtimeCommand`，但只支持移除身份、删除房间和房主超时，没有房间元数据更新。

预约房间业务代码和 change 已存在，但其主 spec 尚待独立 sync/archive；本 change 使用已存在的 `RoomKind=APPOINTMENT`、预约开放和结束实现，不重新定义预约、爽约或提醒规则。API 继续采用 NestJS code-first 生成并校验唯一的 `openapi/openapi.yaml`。

## Goals / Non-Goals

**Goals:**

- 用同一份 Room 持久事实支持即时与预约房间的可见性、分享和延长。
- 在不破坏现有无筛选调用和旧游标的前提下增加 CEFR/主题筛选。
- 让链接房间从公开发现中隔离，同时只把高熵分享标识当作定位入口。
- 使延长在数据库内线性化，并让到期调度和 LiveKit 元数据最终收敛到最新版本。
- 复用现有 Rooms、Voice、LiveKit、BullMQ 和恢复扫描边界，不新增微服务或第二套 API contract。

**Non-Goals:**

- 不把分享标识设计成授权凭证，也不增加链接撤销、一次性链接或访问名单。
- 不增加全文搜索引擎、模糊相关性排序或主题标签体系。
- 不实现客户端深链路、系统分享面板、倒计时 UI 或成员确认流程。
- 不修改预约创建时间、首次房主到场、空房结束、提醒或处罚规则。

## Decisions

### 1. 可见性和分享标识属于 Room

在 `Room` 增加 `visibility`、`shareCode` 和 `extensionCount`：

- `visibility` 使用 `RoomVisibility.PUBLIC | LINK_ONLY`，数据库默认 `PUBLIC`；
- `shareCode` 使用独立随机 UUID，并建立唯一约束；它与内部 `Room.id` 不相同；
- `extensionCount` 默认为 0，并以数据库约束限制在 0–3。

两类房间共用同一模型，因此创建、列表、详情和分享解析只需要扩展现有 Rooms 模块。密码继续保存在 `passwordDigest`，不与可见性组合成更多枚举。

选择独立 `shareCode` 而不是直接暴露 `Room.id`，可以避免把内部资源标识当作公开入口并提供足够枚举阻力。V1 不支持撤销，所以一个房间只有一个稳定标识；未来若需要撤销或多链接，再引入独立 ShareLink 聚合，不提前建表。

### 2. 分享 URL 由受控公共基址和 shareCode 组成

配置层新增经 Zod 校验的 `ROOM_SHARE_BASE_URL`，服务端按固定路径和编码后的 `shareCode` 生成 `shareUrl`。创建与有权访问的详情响应返回分享 URL；公开列表只需要返回可见性和现有摘要，避免扩大响应。

新增无需 bearer token 的 `GET /v1/room-links/{shareCode}`。该查询只接受 UUID 形状的 code，并按数据库当前时间投影尚处于 `SCHEDULED` 或 `OPEN` 且未过 `endsAt` 的房间。响应使用专用字段白名单，不复用包含 membership、reservation 或内部状态的 DTO。未知、取消、ENDING、ENDED 或已过期房间返回稳定的不存在/不可用错误。

公开解析只解决定位和展示。客户端登录后继续使用现有预约、join 和实时凭证 endpoint；这些入口仍按内部 `roomId` 执行所有资格校验。选择该边界，而不是签发 share ticket，是为了避免产生第二套会话或授权状态。

### 3. 两套公开列表复用同一规范化筛选值

即时和预约列表 DTO 增加可选 `cefrLevel` 与 `topic`：

- CEFR 只接受现有 A1–C2 单值并精确匹配；
- topic 去除首尾空白，限制为 1–120 字符，使用 PostgreSQL 大小写不敏感包含查询；
- 查询始终固定 `visibility=PUBLIC`，并保留各自现有 kind、状态、时间和排序范围。

新游标编码 `version`、排序键、room kind 和规范化筛选快照。解码后必须与当前 query 完全一致；旧游标只允许用于未提交筛选的原列表，以保持现有客户端翻页兼容。V1 数据量不引入全文搜索或 trigram 依赖；保留 kind/visibility/status/排序字段的组合索引，并通过受限 topic 长度控制查询。出现实际性能证据后再单独设计搜索索引。

### 4. 一个统一的延长 endpoint 处理两类已开放房间

新增 `POST /v1/rooms/{roomId}/extensions`：

```json
{
  "clientRequestId": "uuid",
  "additionalMinutes": 30
}
```

响应至少包含 `roomId`、`previousEndsAt`、`endsAt`、`extensionCount`、`remainingExtensions`、`stateVersion` 和 `providerStatus`。该 endpoint 先使用数据库 `clock_timestamp()` 和行锁收敛预约时间状态，再验证：

- 调用者是当前 `hostUserId`，账号和安全资格仍满足现有房间操作边界；
- 房间已处于 `OPEN` 且 `now < endsAt`；
- 分钟数是 1–60 的整数，`extensionCount < 3`。

新时间始终从锁内读取的当前 `endsAt` 累加，不从请求到达时间计算。这样连续或并发延长不会缩短房间，也不会丢失更新。统一 endpoint 避免为预约房间复制一套命令；`SCHEDULED` 预约必须等待现有开放流程完成。

### 5. RoomTimeExtension 保存幂等结果和不可变事实

新增 `RoomTimeExtension`，保存 `roomId`、`actorUserId`、`clientRequestId`、`additionalMinutes`、`previousEndsAt`、`endsAt`、`resultingCount`、`resultingStateVersion` 和服务端时间，并对 `(actorUserId, clientRequestId)` 建唯一约束。

延长事务按以下顺序执行：

1. 锁定 Room，并读取数据库时间；
2. 查找同一 actor/requestId；相同 room 和分钟数直接返回原事实，不同内容返回幂等冲突；
3. 校验当前房主、状态、时间和次数；
4. 更新 `endsAt`、增加 `extensionCount` 与 `stateVersion`；
5. 插入 RoomTimeExtension、最小 `room_time_extended` RoomEvent 和 `SYNC_ROOM_TIME` durable command。

步骤 4–5 在同一 Prisma transaction 中提交。选用独立事实表而不是只依赖 RoomEvent，是因为需要完整重放原结果和由数据库唯一约束封闭并发幂等；RoomEvent 继续服务审计、举报证据和时间线投影。

### 6. 新到期任务是协调提示，旧任务必须重新读取数据库

事务提交后，应用尽力把 `expiry` job 安排到新 `endsAt`，job id 保留运行时间版本。Redis 不可用不会改变 API 已提交结果；现有恢复扫描从 `Room.endsAt` 重建任务。

原结束时间对应的旧 job 可以保留。它调用现有结束服务时必须在房间锁内比较数据库时间：若 `now < endsAt`，不进入 ENDING、不撤销身份、不删除 LiveKit 房间，并确保最新到期任务可被调度或恢复。删除旧 job 只能作为优化，不能成为正确性条件。

### 7. LiveKit room metadata 承载成员时间同步

Realtime provider port 增加确保房间时携带元数据和更新房间元数据的能力。元数据只包含版本化白名单：

```json
{
  "schemaVersion": 1,
  "stateVersion": 12,
  "endsAt": "2026-09-15T04:00:00.000Z",
  "extensionCount": 2
}
```

普通客户端已经不能更新自身或房间元数据，因此只有后端 LiveKit Server API 可以发布该值。LiveKit 的 room metadata 更新事件用于通知在线成员；后续加入者从远端房间元数据取得最新快照。

`SYNC_ROOM_TIME` 复用现有 RealtimeCommand 租约、重试和恢复扫描。worker 领取命令后重新读取 Room 最新值并发送，而不是信任命令创建时的 payload；调用完成后再次比较 `stateVersion`，若期间出现新版本则保留或创建最新同步命令。客户端只接受不低于本地已观察版本的 metadata，避免迟到事件回退倒计时。

如果远端房间尚不存在，同步命令可以完成，因为下一次 `ensureRoom` 必须携带数据库最新 metadata。如果 provider 调用失败，命令保持可恢复状态，API 复用 `COMPLETED | PENDING | UNAVAILABLE` 语义返回控制面状态。业务成功不依赖 LiveKit 当次可用。

### 8. OpenAPI 继续由 NestJS code-first 单向生成

DTO、controller decorator 和稳定错误映射是实现输入，生成结果覆盖唯一 `openapi/openapi.yaml` 并通过现有 drift 校验。不得另建手写 contract。新增 public share resolver 必须显式移除 bearer requirement；创建、列表、详情和延长 endpoint 继续保留现有认证边界。

## Risks / Trade-offs

- [公开 share resolver 可能被探测] → 使用独立高熵 UUID、严格格式校验和最小字段白名单；本 change 不承诺通用限流，后续治理 change 可在有统一限流设施后补充。
- [大小写不敏感包含查询在数据增长后变慢] → 限制 topic 长度并使用现有关系库查询；先记录查询指标，有真实瓶颈后再引入 trigram 或搜索服务。
- [数据库已延长但 LiveKit 暂时显示旧时间] → API 返回 providerStatus，durable command 重试，恢复扫描和首次 ensureRoom 都读取最新数据库版本；客户端以 stateVersion 拒绝倒退。
- [旧 expiry job 在原时间运行] → 到期动作锁内重新读取 PostgreSQL `endsAt`，任何 Redis job 都不能单独决定结束。
- [新增 RealtimeCommand enum 与旧 worker 滚动部署不兼容] → 先部署能识别 `SYNC_ROOM_TIME` 的 worker/API，再开放延长流量；回滚前停止产生新命令并处理或保留待同步记录，禁止旧 worker 把未知命令当成功完成。
- [分享 URL 基址配置错误会生成不可用链接] → bootstrap 进行绝对 HTTPS URL 校验，测试环境允许明确的本地 HTTP 基址，部署 smoke 校验生成 URL 和解析路由一致。

## Migration Plan

1. 增加 RoomVisibility enum、Room 的 `visibility`、`shareCode`、`extensionCount`，以及 RoomTimeExtension 表、索引、约束和 `SYNC_ROOM_TIME` command 类型。
2. 在迁移内把全部既有房间回填为 `PUBLIC`、为每条记录生成唯一 shareCode、把延长次数设为 0；保留数据库默认值，使迁移后短暂运行的旧创建代码仍能插入房间。
3. 用隔离临时数据库验证全新建库和历史迁移链，确认 shareCode 唯一、既有房间仍能公开查询、旧 Room/appointment 数据不丢失。
4. 部署支持新 command 的 realtime worker 和 API，生成 OpenAPI；确认所有运行实例能识别新 command 后开放延长请求。
5. 运行本地 provider、Redis 停止/恢复与旧 expiry job smoke；具备 LiveKit Cloud 配置时再执行真实 metadata 更新和成员事件 smoke，并把未执行项记录为环境阻塞而非 PASS。

应用回滚时关闭新增 endpoint 和 public resolver，停止产生新同步 command，并回滚到兼容旧响应的应用版本；数据库字段和事实表保留，不执行破坏性降级。修复版继续读取已保存 `endsAt` 和 extension facts，避免回滚造成时间或幂等事实丢失。
