## Context

动机与范围见 [proposal.md](./proposal.md)，可观察行为见 [spec.md](./specs/room-history-notes/spec.md)。当前即时房间创建即产生 host membership，实际加入为每个 `(roomId,userId)` 保留一条 membership；预约房间另有 RoomReservation，并在真正加入时转为 CONSUMED。两者已经能区分“实际参与”和“仅预约”。Room、membership 与 reservation 都是 PostgreSQL 持久事实，不需要额外复制历史快照。

现有举报资格同样以历史 membership 为依据，证明 LEFT、REMOVED 等生命周期不会抹去实际参与事实。新能力必须保持这一含义，同时避免历史查询暴露其他成员、预约人、密码摘要、provider identity 或举报内容。

## Goals / Non-Goals

**Goals:** 通过稳定游标查询本人房间经历；用独立持久记录保存一人一房一份私人笔记；在数据库事务内保证并发编辑不会覆盖较新内容。

**Non-Goals:** 不创建通用活动流、全文搜索、历史快照仓库或内容协作系统；不从音频、转写、举报或 RoomEvent 自动生成笔记。

## Decisions

### 1. 历史是现有关系的投影

历史查询以 RoomMembership 和 RoomReservation 的并集为候选，以 `userId` 在服务端限定所有行。若同一用户既预约又实际参与，同一 room 只返回一项，relationship=PARTICIPATED；否则为 RESERVED_ONLY，并返回本人 reservation status。实际参与的排序时间使用 membership.joinedAt，仅预约使用 reservation.bookedAt，再以 roomId 作为稳定次序，游标编码这两个值。

返回 roomId、kind、topic、CEFR、计划/实际开始和结束时间、当前 room status、本人 relationship、membership lifecycle/role 或 reservation status，以及本人笔记是否存在。不会返回密码摘要、provider 标识、其他成员/预约人、举报或笔记内容。笔记正文仅由单房详情入口读取，避免历史列表扩大敏感内容和响应体。

备选方案是写入 RoomHistory 快照，但这会复制可从持久关系推导的数据，并引入 room 状态同步问题；目前没有删除 Room 或修改历史标题的已批准行为，因此不采用。

### 2. 独立 RoomNote 保留版本栅栏

新增 RoomNote：id、roomId、userId、nullable content、version、createdAt、updatedAt，并以 `(roomId,userId)` 唯一。roomId 和 userId 均使用 RESTRICT 外键，使笔记不会因清理 membership 而失去所有者或房间上下文。数据库约束保证 version>0，content 为 null 或长度不超过 2000 个字符；应用层对 Unicode code point 计数并拒绝控制字符，仅空白输入规范化为清空。

不存在记录时 GET 返回 `{content:null, version:0, updatedAt:null}`。PUT 接受 `{content, expectedVersion}`：首次 expectedVersion=0；后续必须匹配当前版本，同一事务内递增。清空不删除行，而是 content=null 并递增版本，确保清空前的迟到请求无法复活旧文本。相同 expectedVersion 的完成请求可以按保存后的内容识别安全重试；不同内容或版本返回稳定冲突。

备选直接覆盖或物理删除空笔记会丢失并发栅栏，无法阻止旧客户端写回，因此不采用。笔记不关联 membershipId，因为实际参与资格由唯一 `(roomId,userId)` membership 查询即可证明，且 membership 生命周期变化不应改变私人笔记所有权。

### 3. 写入资格与状态边界

历史读取和笔记入口都从认证 userId 派生主体，不接受目标 userId。笔记 GET/PUT 要求存在实际 membership；仅 RoomReservation 不满足资格。房间必须为 ENDING 或 ENDED 才允许读写，使“会后笔记”不会演变成房间内文字聊天。LEFT、REMOVED 或角色变化不撤销已发生的参与事实，也不允许访问他人的笔记。

对不存在 room、缺少 membership 和他人资源统一使用 HISTORY_CONTEXT_NOT_FOUND，降低资源枚举信息。房间仍在 SCHEDULED/OPEN 返回 ROOM_NOT_ENDED；非法文本返回 VALIDATION_FAILED；版本不匹配返回 NOTE_VERSION_CONFLICT。所有授权与版本判断和 upsert 共用数据库事务。

### 4. HTTP 与唯一 contract

新增三个 Bearer 入口：

| Endpoint | 行为 |
| --- | --- |
| GET /v1/me/room-history | `cursor/limit` 分页返回本人去重后的实际参与与仅预约历史 |
| GET /v1/rooms/{roomId}/note | 返回本人会后笔记；从未保存时返回空内容和 version=0 |
| PUT /v1/rooms/{roomId}/note | 保存或清空本人笔记，要求 content 和 expectedVersion |

使用 NestJS code-first DTO/decorator 生成唯一 `openapi/openapi.yaml`。不手写第二份 contract，不新增前端专属类型；后续客户端从 contract 生成。

## Risks / Trade-offs

- [Risk] membership 与 reservation 并集造成重复、跳页或漏页 → 在数据库侧按 room 去重并定义 relationship 优先级，以 `(occurredAt,roomId)` 做确定性倒序游标；用跨页并发插入测试固定边界。
- [Risk] 查询泄露其他用户信息 → repository 所有候选先绑定当前 userId，DTO 使用显式白名单，HTTP 测试验证无密码、身份、其他成员和他人笔记字段。
- [Risk] 两个设备覆盖笔记或清空后旧文本复活 → 行锁/条件更新结合 expectedVersion，保留 nullable tombstone 行，并验证并发写入和迟到重放。
- [Risk] 当前没有已批准的历史展示期限 → 本 change 不新增保留或自动删除策略，验收明确这是当前数据库可用记录的查询能力，不承诺永久保存。
- [Trade-off] 仅在 ENDING/ENDED 后允许读取笔记 → 边界简单且符合“会后”定位，房间进行中不能把接口当文字聊天使用。

## Migration Plan

1. 添加单独 RoomNote model 与 additive migration；不改写前七段迁移，不回填历史笔记。
2. 在空库完整升级，并对含即时/预约 Room、各类 membership、reservation、identity、report 和 event 的 fixture 升级，确认历史关系、举报外键及旧 API 不变。
3. 同批部署 schema、history/note repository、service 和三个 endpoint；旧实例忽略新表不会破坏房间运行，但新 endpoint 仅路由到新实例。
4. 回退时先移除新入口，保留 RoomNote 数据和新增表；不执行破坏性 down migration，优先 forward fix。

## Verification and Acceptance

- 单元测试覆盖文本规范化、Unicode 长度、状态与资格规则、游标解析及稳定错误。
- PostgreSQL 集成测试覆盖 membership/reservation 去重、不同生命周期、分页稳定性、并发写入、幂等重试、清空墓碑和事务回滚。
- HTTP E2E 覆盖三个入口、本人隔离、仅预约拒绝写笔记、字段最小化和唯一 OpenAPI contract。
- 完成实现后只运行一次完整 `pnpm verify:api`，再运行格式和依赖边界检查；本 change 无外部 provider、设备或 Cloud 验证要求，前端和产品验收单独保留。
