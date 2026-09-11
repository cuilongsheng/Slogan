## Context

参见 [proposal.md](./proposal.md) 的 Why。当前身份/资料实现已经提供带 `userId`、`sessionId` 的服务端认证上下文，以及每次实时计算的 `PROFILE_REQUIRED`、`AGE_RESTRICTED`、`ELIGIBLE` 状态；PostgreSQL/Prisma、统一错误体、日志脱敏和 NestJS code-first OpenAPI 也已存在。

`apps/api/src/modules/rooms` 仍为空骨架。当前 requirements 要求即时房间创建、公开/密码加入、列表/详情和并发容量边界，但 LiveKit、presence、房主移交与处罚执行属于后续 change。本设计因此先建立持久房间控制面和可供前端生成客户端使用的 API，不把“数据库成员”冒充为“实时在线连接”。

## Goals / Non-Goals

**Goals:**

- 在不依赖 Redis 或 LiveKit 的情况下，以 PostgreSQL 事务保证房间创建、加入幂等和容量上限。
- 复用现有认证与 profile eligibility，不复制年龄算法或信任客户端提交的准入状态。
- 让房间密码在数据库泄露时仍不能被直接读取或仅靠 10,000 次离线枚举恢复。
- 生成稳定、可验证且能被后续前端 generated client 消费的唯一 OpenAPI contract。
- 为后续 LiveKit/host-controls 留下清晰的 room/member 事实边界，但不提前实现其状态机。

**Non-Goals:**

- 不用数据库成员数声称实时在线人数；本批次字段语义是“已取得当前房间成员资格的人数”。
- 不创建 Redis presence、队列、定时 worker、LiveKit adapter 或房间事件总线。
- 不定义普通成员离开、房主退出、移交、移除、邀请和断线恢复行为。
- 不新增临时处罚、申诉或管理员写接口。
- 不修改前端、Figma 或 generated API client，也不执行最终产品验收。

## Decisions

### 1. 房间控制面采用 `Room` + `RoomMembership` 持久模型

`Room` 保存 UUID、host user、topic、CEFR、capacity、可选 password digest、`OPEN/ENDED` 状态、开始/结束及审计时间。`RoomMembership` 保存 UUID、room/user、`HOST/MEMBER` 角色、加入顺序、规则确认版本和加入时间，并对 `(roomId, userId)` 建唯一约束。

创建房间时在一个事务内写入 Room 和房主 membership；容量包含房主，因此创建后的成员数为 1。加入顺序从 1 开始并由数据库事务分配，后续 host-controls 可以在此事实之上实现“第二麦”，本批次不实现离开后的前移。

房间的有效开放条件为 `status=OPEN && endsAt>now`。列表只返回有效开放房间；详情和加入若发现已到结束时间，按 `ROOM_ENDED` 处理，并允许 repository 在写事务中惰性落下 `ENDED` 状态。无需为了当前无实时连接的版本引入定时 worker。

备选将房间仅放 Redis 会失去持久事实与迁移能力；一次性创建完整 host-control 状态机会扩大当前 change，因此不采用。

### 2. 准入由 application 编排，domain policy 只判断明确输入

每个列表、详情、创建和加入 use case 都从认证 guard 获得服务端 `userId`，再调用 `ProfilesService.getOnboardingState()`。只有 `ELIGIBLE` 可以继续；`PROFILE_REQUIRED` 与 `AGE_RESTRICTED` 映射为稳定的 `PROFILE_REQUIRED`、`AGE_RESTRICTED` API code。

账号 `DISABLED/DELETED` 已由现有 access-token session 检查拒绝，房间模块不读取或复制用户状态。加入时再次检查 eligibility，避免用户在打开详情后修改出生年月绕过规则。

`RoomAccessPolicy` 接受 eligibility、房间状态、规则确认、密码校验结果和容量事实，返回明确 domain result；它不依赖 NestJS、Prisma、JWT 或环境变量。

备选让 Controller 拼接检查会造成接口间规则漂移；把 eligibility 放进 JWT 会产生过期授权，因此不采用。

### 3. 并发容量由 PostgreSQL 房间行锁与唯一约束保证

加入使用数据库事务：先锁定目标 Room 行，再检查有效状态和现有 membership；已存在 membership 直接幂等返回。新成员在同一锁内统计 membership、校验 `< capacity`、分配下一个加入顺序并插入。所有竞争同一房间的请求串行经过同一行锁，因此最后一个名额最多一个成功。

唯一 `(roomId,userId)` 约束是重复请求的最终防线。事务只重试 PostgreSQL 可识别的 serialization/deadlock 冲突，并设置有限次数；业务冲突返回 `ROOM_FULL`，不得以 500 或重复 membership 结束。

当前单实例、容量最多 6 人时，PostgreSQL 行锁比 Redis + PostgreSQL 双写更小且更可靠。未来引入多实例 presence 时 Redis 可以提供临时协调或缓存，但不得成为 membership 唯一事实来源，也不能削弱数据库约束。

### 4. 4 位密码使用 room-scoped HMAC 而不是普通哈希

4 位数字只有 10,000 种，单纯 SHA/Argon2 digest 在数据库泄露后仍可离线枚举。创建时后端生成 room ID，并计算 `HMAC-SHA-256(ROOM_PASSWORD_PEPPER, roomId + ':' + password)`；数据库只保存 64 位十六进制 digest。加入时重算并使用 `timingSafeEqual` 比较。

`ROOM_PASSWORD_PEPPER` 为至少 32 字符的启动必需 secret，并进入 Zod、`.env.example`、日志脱敏和 bootstrap tests。公开 API 只返回 `passwordProtected: boolean`，永不返回 digest 或密码。无密码房间不会产生占位 digest。

备选对 PIN 使用普通 password hash 增加计算成本但不能阻止低熵离线枚举；把密码放 Redis 或明文数据库均不可接受。

### 5. 规则确认随 membership 保存，但不由后端维护中英文文案

加入 DTO 必须包含 `rulesAccepted: true`；否则返回 `ROOM_RULES_NOT_ACCEPTED` 且不创建 membership。服务端在 membership 保存固定的 `ROOM_RULES_VERSION` 与 `rulesAcceptedAt`，用于证明用户加入时确认了哪一版规则。

当前中英文完整文案继续由前端 localization 资源和 Figma 视觉流程负责，后端只拥有版本和确认事实。规则版本通过环境配置固定并校验；后续若规则含义变化，应先修改 OpenSpec requirement，再更新客户端文案和服务端版本。

备选由客户端提交任意版本会使审计事实可伪造；由后端返回整套本地化文案会把当前前端语言职责转移到 API，因此不采用。

### 6. API 采用认证后的资源端点与稳定错误 code

首批端点：

- `POST /v1/rooms`：创建即时房间；body 包含 topic、CEFR、capacity 和可选 4 位密码。
- `GET /v1/rooms`：按 `startedAt desc, id desc` 游标分页返回有效开放房间。
- `GET /v1/rooms/{roomId}`：返回房间详情和当前 membership 资格信息。
- `POST /v1/rooms/{roomId}/memberships`：确认规则并加入；密码房可提交 password。

创建响应包含房主 membership；加入响应包含 membership ID、角色和加入顺序。列表/详情中的 `memberCount` 是持久 membership 数，不叫 `onlineCount`。列表默认 20、最大 50；游标是 opaque string，不向客户端承诺编码结构。

稳定错误至少包括 `PROFILE_REQUIRED`、`AGE_RESTRICTED`、`ROOM_NOT_FOUND`、`ROOM_ENDED`、`ROOM_FULL`、`ROOM_PASSWORD_REQUIRED`、`ROOM_PASSWORD_INVALID`、`ROOM_RULES_NOT_ACCEPTED` 和 `VALIDATION_FAILED`。不存在与无权限查看在本批次均返回 `ROOM_NOT_FOUND`，减少资源枚举差异。

OpenAPI 继续使用 NestJS DTO/decorator code-first 生成，更新 `openapi/openapi.yaml` 并执行 validation/drift check；不建立手写第二份 contract。

### 7. 展示数据实时读取 profile，rooms 不复制用户资料

Room 只保存 `hostUserId` 外键。列表与详情 repository 查询只选择 host profile 的 `displayName`，不返回出生年月、国籍、城市或兴趣。这样用户修改昵称后房间展示会同步更新，也避免跨模块复制资料快照。

Prisma join 仅存在于 rooms infrastructure adapter；domain/application 只接收映射后的 room view，不暴露 Prisma model。房间模块调用 profile application API 判断当前请求者 eligibility，不深层导入 profile repository。

### 8. 证据与延后验收分离

本 change 必须提供 domain 单元测试、真实 PostgreSQL migration/repository 并发集成测试、provider-neutral HTTP E2E、OpenAPI validation/drift、dependency boundary、lint、typecheck 和 build 证据。并发测试至少同时竞争一个剩余名额，并验证失败请求没有残留 membership。

该批次没有 UI、LiveKit 或真机行为，因此不制造 visual/device/audio evidence。按产品所有者当前决定，自动化 verification 完成后 change 保持未归档，最终 acceptance 与前端联调一起进行。

## Risks / Trade-offs

- [Risk] 数据库 membership 数与未来 LiveKit 在线人数不同 → 字段明确命名 `memberCount`，不暴露 `onlineCount`；presence 由后续 change 实现。
- [Risk] 行锁在热点房间造成等待 → 当前容量最多 6 且单实例，事务只做短查询与插入；记录冲突耗时，出现真实瓶颈后再引入 Redis 协调。
- [Risk] 房间到期没有后台任务立即写 `ENDED` → 所有读取/加入按 `endsAt` 计算有效状态，写请求可惰性持久化；实时通知留给 LiveKit/worker change。
- [Risk] HMAC pepper 丢失后密码房无法继续校验 → 配置作为部署 secret 备份与轮换项；轮换需要独立 change 和兼容窗口。
- [Risk] identity/profile change 尚未 product acceptance → 只依赖其已验证的公开 application API；如果统一验收要求修改 identity contract，本 change 在归档前同步调整。
- [Trade-off] 当前不引入 Redis，与历史建议不同 → archived inventory 已明确 Redis/Lua 属于实现建议而非 current MUST；PostgreSQL 事务直接满足可观察的并发上限并避免双写。

## Migration Plan

1. 扩展环境 schema 和示例配置，加入 room password pepper 与规则版本，并先补启动失败测试。
2. 在现有 schema 上增加 Room、RoomMembership、enum、外键和索引的 additive migration；在从 identity/profile migration 升级的测试数据库执行 `prisma migrate deploy`。
3. 实现 rooms domain/application/repository 与 HTTP API，保持 Controller 薄并复用现有认证/profile 边界。
4. 生成唯一 OpenAPI contract，执行 domain、repository concurrency、HTTP E2E 和 workspace verification。
5. 记录 verification evidence；不在本 change 中执行部署或 product-owner acceptance。

应用回滚先回退到不暴露 room routes 的上一版本。已存在房间数据时保留新增表，不执行破坏性 down migration；通过 forward fix 修复 schema 或逻辑。测试环境可停止并重建专用 tmpfs PostgreSQL 容器后重新执行全部 migrations。
