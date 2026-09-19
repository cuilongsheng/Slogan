## Context

见 `proposal.md` 的 Why。当前 PostgreSQL 已保存用户、资料、房间、membership、安全限制和房间审计事实；Redis 已用于临时协调，房间级实时 presence 只描述 LiveKit participant，不代表应用用户近期在线。现有 `RoomsService.join` 在锁定房间的事务中执行账号、年龄、安全限制、状态、密码、规则和容量校验，`host-controls` 单独拥有被移除成员的重新邀请。

本 change 同时涉及新的双向关系、定向屏蔽、临时 presence 与加入事务，属于 Level 2 架构和安全边界变更。OpenAPI 继续由 NestJS code-first 生成，`openapi/openapi.yaml` 是唯一发布合同。

## Goals / Non-Goals

**Goals:**

- 用唯一持久事实表达好友请求、好友关系、用户屏蔽和普通房间邀请，并在并发和重试下收敛。
- 让任何社交读取和写入都从两个方向执行屏蔽、账号、资料、年龄及安全限制检查。
- 使用短期 Redis 信号生成空闲投影，Redis 故障时安全降级且不影响语音房。
- 让普通邀请在现有加入事务中消费，复用房间密码、容量和 membership 不变量。
- 保持现有客户端兼容：不带邀请的公开/分享链接加入流程继续工作。

**Non-Goals:**

- 私信、群聊、关注、联系人导入、推荐排序、推送或邮件通知。
- 修改公开房间发现对屏蔽双方的展示规则。
- 用普通邀请替代 `host-controls` 的被移除成员重新邀请。
- 把 Redis presence、客户端心跳或邀请当作房间容量和成员资格事实。

## Decisions

### 1. 关系使用规范化用户对和显式终态

新增 `FriendRequest`、`Friendship`、`UserBlock` 和 `SocialCommand`。好友请求和好友关系同时保存 `userLowId/userHighId` 规范化用户对；请求另存 `requesterUserId/recipientUserId`。数据库检查两个用户不同，并用部分唯一索引保证一个用户对最多一个待处理请求、最多一个有效好友关系。请求使用 `PENDING/ACCEPTED/REJECTED/WITHDRAWN/BLOCKED`，好友关系保留 `endedAt/endedByUserId`，屏蔽记录保留 `unblockedAt`，以支持审计和幂等结果恢复。

替代方案是为每个方向各存一行好友边。该方案会让接受、删除和并发互发需要跨两行保持一致，因此不采用。

### 2. 屏蔽在规范化用户对锁内原子清理

创建或解除屏蔽时，repository 在数据库事务中按规范化用户对获取事务级 advisory lock，再检查和改变屏蔽、好友、请求及待处理邀请。创建屏蔽会结束好友关系，把双方待处理请求置为 `BLOCKED`，并把双方之间所有 `PENDING` 普通邀请置为 `CANCELLED`。解除屏蔽只关闭调用者发起的方向，不恢复任何旧记录。

使用双向读取过滤仍不足以防止列表读取后到写入前新增屏蔽，因此所有好友和邀请写入在相同用户对锁内重新检查。

### 3. 通用社交命令保存幂等结果

`SocialCommand` 以 `(actorUserId, clientRequestId)` 唯一，保存命令类型、规范化请求摘要、状态和最小结果标识。application service 先在事务中锁定命令；相同摘要重放既有结果，不同摘要返回冲突。关系记录自身的唯一约束作为第二道并发保护。命令和领域状态在同一事务提交，日志不记录资料正文或屏蔽原因。

为每张表分别加入请求标识无法覆盖“接受/拒绝/撤回/删除”这些作用于既有记录的命令，因此采用独立命令表。

### 4. Social 模块拥有关系与 availability，Rooms 模块拥有邀请

新增 `modules/social`，提供好友、屏蔽、presence 和资格查询的公开 application API。普通 `RoomInvitation` 模型、repository、service 和 controller 位于 `rooms`，因为邀请有效性和消费依赖房间当前房主、状态、membership 和加入事务。Rooms 单向依赖 Social 的公开 API 和接收 Prisma transaction client 的最小资格 helper；Social 不反向导入 Rooms，从而避免 `forwardRef` 和循环模块依赖。

房主变更不会自动使既有普通邀请失效：邀请是房间发出的定向访问提示，加入时仍按当前房间事实重新校验。房间进入 `ENDING/ENDED/CANCELLED` 后，读取和消费路径立即把邀请视为不可用；后台收敛可批量标记 `CANCELLED`，但正确性不依赖任务准时运行。

### 5. 邀请不预留座位，消费加入保持单事务

`RoomInvitation` 保存房间、发送时房主、目标、`PENDING/DECLINED/CONSUMED/CANCELLED` 状态及时间。`RoomsService.join` 接受可选 `invitationId`。锁定房间后，它使用同一 Prisma transaction client 校验邀请、双向屏蔽和目标资格，再执行原有密码、规则、预约名额和容量检查；创建 membership 成功后才把邀请置为 `CONSUMED`。任何检查失败都会回滚消费。

普通邀请对 `REMOVED` membership 无效，继续返回现有 `ROOM_INVITATION_REQUIRED`，由 host-controls 的专用流程恢复。邀请不会签发 LiveKit token；实时凭证仍由 voice 的既有入口生成。

### 6. Availability 是 Redis 短期信号与 PostgreSQL 事实的交集

认证心跳只写 `social:presence:<userId>`，TTL 由服务端配置 `SOCIAL_PRESENCE_TTL_SECONDS` 控制，默认 90 秒并限制在 30–300 秒；响应返回服务端 `expiresAt` 和建议刷新秒数。客户端不能写 userId 或时间。空闲查询先按用户创建时间和 id 从 PostgreSQL 获取合格候选，排除有效 membership、禁用/删除账号、未完成/未成年资料和当前安全限制，再批量读取 Redis 信号并过滤双向屏蔽。

好友列表复用同一投影，只把 `isAvailable` 作为瞬时布尔值返回。游标绑定排序字段和查询类型；当 presence 在分页期间变化时，系统保证游标合法和用户 id 不倒退，不承诺跨页冻结实时状态。

不使用 Redis key scan 发现在线用户，因为其成本和分页语义不可控；PostgreSQL 决定候选集合，Redis 只回答候选是否近期在线。Redis 不可用时 heartbeat 返回稳定的临时不可用错误，列表返回空闲状态为 false 或空的可邀请列表。

### 7. HTTP 与隐私边界

计划入口：

- `POST/GET /v1/friend-requests`，`POST /v1/friend-requests/{id}/accept|reject|withdraw`
- `GET /v1/me/friends`，`DELETE /v1/me/friends/{friendUserId}`
- `POST/GET /v1/blocks`，`DELETE /v1/blocks/{blockedUserId}`
- `POST /v1/me/presence/heartbeat`，`GET /v1/people/available`
- `POST /v1/rooms/{roomId}/invitations`，`GET /v1/me/room-invitations`，`POST /v1/room-invitations/{id}/decline`
- 现有 `POST /v1/rooms/{roomId}/memberships` 增加可选 `invitationId`

列表只返回 user id、公开昵称、CEFR、允许展示的地区/主题和 `isAvailable`；不返回生日、会话、精确时间、IP、设备、屏蔽方向或房间成员详情。目标不可用和存在屏蔽统一映射为稳定的不可用错误。

## Risks / Trade-offs

- [Risk] 心跳过期前应用异常退出会短暂显示在线。→ TTL 上限 300 秒，进入房间由 PostgreSQL membership 立即覆盖为空闲 false，邀请与加入仍重新校验。
- [Risk] 大量离线候选会导致 availability 查询扫描过多数据库行。→ 使用有上限的分批 keyset 查询和 Redis `MGET`，记录扫描/返回比；达到扫描上限时返回较少结果和继续游标，不做全表扫描。
- [Risk] 屏蔽与好友/邀请并发可能留下可见关系。→ 规范化用户对 advisory lock、事务内资格复查、数据库唯一约束和集成并发测试共同保护。
- [Risk] Rooms 调用 Social 持久化 helper 可能扩大模块耦合。→ 只公开资格和 transaction helper，不导出 repository；邀请所有权保留在 Rooms，依赖保持单向。
- [Risk] 保留终态关系会增长数据量。→ 本 change 建立索引并保留最小字段；具体保留/清理期限进入后续数据治理 change。

## Migration Plan

1. 新增枚举、关系模型、外键、唯一/部分唯一索引和检查约束；空数据库及包含既有用户、房间、安全和预约数据的隔离 schema 执行升级验证，不回填好友或 presence。
2. 部署兼容旧客户端的读取/写入服务、Redis presence 和新增 HTTP 入口；`invitationId` 保持可选。
3. 生成并检查唯一 `openapi/openapi.yaml`，执行 domain、repository、并发、HTTP 权限和迁移测试；Redis runtime smoke 验证 TTL、过期和故障降级。
4. 回退时先下线新增入口和 join 的邀请消费分支，停止 heartbeat；Redis key 自动过期，PostgreSQL 新表和数据保留以便向前修复，不执行破坏性 down migration。

产品验收需要覆盖好友双方同意、屏蔽后双向消失、在线/入房/过期状态切换、房主邀请到加入、容量竞争和密码/限制拒绝。此 change 不依赖真机推送或外部 provider；生产部署状态单独记录。
