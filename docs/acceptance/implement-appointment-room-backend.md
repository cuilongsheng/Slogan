# 预约房间后端验收记录

## 范围和基线

2026-09-13，基于当前未提交工作区实施。前置身份资料、即时房间、LiveKit、房主管理及举报后端的六段迁移均保留；既有安全举报验收基线为 196 个本地测试，本次未将其视为新增实现的验证结果。

用户确认：预约占位；到点成员可先进入；满 5 分钟无人在线立即结束，有在线成员且房主从未到场则由加入最早的在线成员接任；此后末人退出或可信断线使房间为空，立即结束。取消 10 分钟规则，不做爽约处罚。

## 实现与证据

- 六个预约 API：创建、分页列表、本人详情、预约、取消预约、开始前房主取消整房。预约仅投影本人的 id/status/version，不返回密码摘要或他人预约名单。
- 创建者保留一席但无 membership；实际 join 同一事务消耗 BOOKED。普通加入、重进和邀请容量检查保护未用预约。失败请求不消耗席位。
- 共享 RoomLifecycle 与行锁内上下文供预约、join、实时发证、事件及房主管理使用；到期和空房结束在拒绝请求后仍提交，不能因为抛出业务错误回滚结束事实。
- 使用既有 RealtimeQueue，增加开始和 5 分钟检查；Redis 丢任务由数据库扫描恢复。REALTIME_ENABLED=false 不禁用预约时间规则。
- 满 5 分钟仍空房不等待接任；已到场房主不能取消空房检查。既有 60 秒断线窗口仅在仍有在线成员时保留其作用。
- 已签发身份或创建过媒体房间走原 ENDING/revoke/delete；无身份历史且无 provider SID 时可直接 ENDED，避免为结束而创建媒体房间。

### 定向证据

- `test/integration/appointments.spec.ts`：真实 PostgreSQL 席位竞争、版本重放、取消、实际加入、接任、空房结束、provider 失败与真实 Redis 丢任务恢复。
- `test/unit/appointment-lifecycle.spec.ts`：开始、5 分钟、计划结束前后 1 毫秒及已到场后空房、已签发身份清理。
- `test/e2e/appointments.e2e.spec.ts`：真实认证 HTTP 六入口、密码、隐私、非法时间，以及仅预约不能获得举报资格（沿用 REPORT_CONTEXT_NOT_FOUND 隐私边界）。
- `test/integration/appointment-migration.spec.ts`：隔离空 schema 与含 OPEN/ENDING/ENDED、ACTIVE/LEFT/REMOVED 历史数据升级，旧 Room backfill INSTANT、预约版本约束和 RESTRICT 删除约束。

## 迁移和回退

新增 `20260913000000_appointment_rooms`，不改写前六段迁移。新增 RoomKind、两种状态、首次房主标记与 RoomReservation；历史房间默认 INSTANT。完整七段迁移在隔离测试数据库应用成功。

发布必须让理解预约占位的 join/预约/worker 同批部署，旧版本不得并行接收预约房间加入请求。回退先关闭预约入口与预约 join/token，取消未开始房间、结束已开放会话；保留新增表列和历史数据，不进行破坏性 down migration。媒体失败时保留补偿 worker，优先向前修复。未执行生产发布或回退。

## 验证状态

最终 `pnpm verify:api` PASS：102 个单元测试、81 个集成测试、46 个 HTTP E2E，共 229 个；lint、typecheck、build、OpenAPI drift 均通过。`pnpm format:check`、`pnpm deps:check`（180 modules / 583 dependencies）与 OpenSpec 严格校验通过。定向测试夹具曾修正 ESM mock 引用、历史 participantIdentity 必填值和举报错误格式；这些不作为产品行为变更。

## 未完成边界

LiveKit Cloud 配置未提供，按用户决定保留真实媒体验证未完成。Google/微信 provider 验证仍沿用前置记录。前端、双设备真实语音、网络断线识别延迟、产品验收和生产部署未完成，不记 PASS。

“在线”来自有效 identity/session 的可信 presence；实际网络断线需 provider 观察送达。结束立即撤销平台新增资格，媒体断开仍依赖异步 provider 清理；不得将本地 fake-provider 验证描述为真实音频或 Cloud 验证通过。
