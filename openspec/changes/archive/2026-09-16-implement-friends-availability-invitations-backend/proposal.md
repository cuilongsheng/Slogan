## Why

当前后端已具备房间、成员生命周期和安全限制，但没有双方同意的好友关系、可邀请用户的临时空闲状态、用户屏蔽隔离或普通房间邀请。补齐这些能力后，用户才能在不引入私信和群聊的前提下找到可交流对象，并由房主安全地邀请对方进入房间。

## What Changes

- 新增好友请求和双向好友关系：发起、查看、接受、拒绝、撤回和删除均由服务端校验，单方面请求不会直接建立好友关系。
- 新增用户对用户的定向屏蔽：屏蔽会原子解除双方好友关系、终止待处理好友请求和未完成邀请；解除屏蔽不会自动恢复历史关系。
- 新增基于短期心跳和房间 membership/presence 的空闲状态。空闲表示用户近期在线且当前不在任何房间；不公开精确在线时长、位置或房间活动细节。
- 新增好友列表和可邀请用户列表，使用稳定游标分页，并在两个方向执行屏蔽隔离和账号、年龄、安全限制过滤。
- 新增房主向好友或当前可邀请用户发送的房间邀请，以及受邀用户查看、拒绝和通过现有加入入口消费邀请的闭环。邀请不预占名额，也不能绕过密码、容量、年龄、账号、安全限制或房间终态检查。
- 邀请和好友写操作使用调用者生成的 UUID 请求标识，支持安全重试并阻止并发重复关系或重复邀请。
- 扩展 NestJS code-first OpenAPI、PostgreSQL 迁移、Redis presence、审计事件及自动化验收证据。

确认范围：好友能力仅用于好友/空闲状态和房间邀请，不提供私信、群聊、关注、联系人导入或推荐算法。用户屏蔽在本 change 中隔离社交列表、好友请求和普通房间邀请；是否隐藏双方的公开房间列表属于后续独立产品决策。

## Capabilities

### New Capabilities

- `friend-relationships`: 双方同意的好友请求、好友列表、关系解除、并发与幂等边界。
- `user-blocking`: 定向屏蔽、双向社交隔离、关系清理及解除屏蔽行为。
- `user-availability`: 短期在线心跳、空闲状态计算、最小资料投影和隐私过滤。
- `room-invitations`: 房主普通邀请、受邀列表、拒绝/消费、失效和现有房间资格复用。

### Modified Capabilities

无。

## Impacted delivery stages

- Architecture
- Backend / API
- Test / Acceptance

## Impact

- `apps/api/prisma/`：新增好友请求、好友关系、用户屏蔽和房间邀请的枚举、模型、约束、索引与迁移。
- `apps/api/src/modules/social/`：新增社交领域、application、HTTP DTO/controller、Prisma repository 和 Redis presence adapter。
- `apps/api/src/modules/rooms/`：在现有加入事务中消费普通邀请并复用房间资格、密码和容量规则；房主邀请继续通过 rooms 公开 application API 校验。
- `apps/api/src/modules/audit/`：记录屏蔽、好友关系和房间邀请的重要状态变化，不记录精确在线时长或多余资料。
- `openapi/openapi.yaml`：由 NestJS code-first 生成新增入口和稳定错误响应。
- 不新增外部 provider；PostgreSQL 仍为关系和邀请事实来源，Redis 只保存带 TTL 的临时 presence。
