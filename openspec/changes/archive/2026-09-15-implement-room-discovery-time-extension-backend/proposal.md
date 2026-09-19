## Why

当前房间后端只能分页浏览公开的即时房间，缺少链接房间、可分享入口和 CEFR/主题筛选；即时房间及已开放预约房间也不能由房主延长结束时间。补齐这些能力后，用户才能按水平和主题找到房间、通过外部链接进入，并在真实交流需要继续时安全延长会话。

## What Changes

- 为即时房间和预约房间增加 `PUBLIC`、`LINK_ONLY` 可见性；已有房间兼容迁移为 `PUBLIC`，密码保护继续作为独立入房条件。
- 为每个房间生成不可枚举的稳定分享标识，提供最小公开分享信息；分享链接不得绕过登录、资料、年龄、安全限制、密码、容量、预约或房间状态校验。
- 公开的即时房间和预约房间列表支持 CEFR 精确筛选与规范化主题查询；链接房间不进入公开列表，分页游标与当前筛选条件绑定。
- 允许当前房主延长仍处于 `OPEN` 的即时房间或预约房间：单次增加 1–60 分钟，每个房间最多成功延长 3 次，从数据库当前 `endsAt` 累加。
- 延长命令使用客户端 UUID 幂等键并在同一数据库事务内更新结束时间、计数和事件事实；并发请求不能突破次数上限或丢失时间。
- 延长后的结束时间通过可恢复的 LiveKit 控制面更新同步给在线成员，并重新安排到期任务；Redis、队列或 LiveKit 暂时不可用时，PostgreSQL 中的新结束时间仍立即决定加入、发证和到期行为。
- 保持已确认的产品边界：本 change 不增加预约提醒、爽约处罚、候补、迟到处罚或“开始后 10 分钟”规则。

## Capabilities

### New Capabilities

- `room-discovery-sharing`: 定义跨即时与预约房间的可见性、公开列表筛选、稳定分享链接、最小公开解析和不绕过入房校验的边界。
- `room-time-extension`: 定义房主延长已开放房间的权限、单次和累计上限、幂等并发、持久时间事实、到期重排与在线成员同步。

### Modified Capabilities

- `instant-room-discovery`: 扩展现有即时房间创建、列表和详情，增加公开/链接可见性、CEFR/主题筛选及分享字段，同时保持未传新字段的现有调用兼容。

## Impact

- API contract：`openapi/openapi.yaml` 中的即时房间和预约房间创建/列表/详情 DTO，以及分享解析和房间延长 endpoint。
- 后端：`apps/api/src/modules/rooms` 的房间策略、查询、事务命令、Prisma repository、presentation DTO/controller；`apps/api/src/modules/voice` 与 LiveKit adapter 的可恢复时间同步和到期调度。
- 数据：Room 可见性、分享标识、延长次数及延长命令/事实；需要向前迁移、既有数据回填、索引和恢复说明。
- 验证：筛选与分页、链接隐私和权限绕过、两类房间的延长边界、幂等并发、旧到期任务、Redis/队列恢复及 LiveKit metadata 同步。

## Impacted delivery stages

- Architecture
- Backend / API
- Test / Acceptance

## Non-goals

- 不实现移动端或后台管理界面，也不定义系统分享面板的视觉和交互。
- 不提供分享链接撤销、一次性邀请、好友邀请、房间编辑或预约提醒。
- 不改变既有密码、成员容量、房主移交、安全限制、预约占位和实际 membership 规则。
- 不要求本 change 在归档前完成生产部署；真实 LiveKit Cloud 同步作为依赖外部配置的验收证据单独记录。
