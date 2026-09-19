# LiveKit 实时后端交付记录

## 状态与范围

- Change：`implement-livekit-voice-session-backend`。
- 日期：2026-09-12；Node.js 24.21.0、pnpm 12.3.4。
- 交付范围：实时凭证、当前成员查询、签名 Webhook、持久 presence/身份历史、审计/outbox、到期结束及可恢复队列。
- 本地验证：最终完整验证结果见下表；不代表 CI、Cloud 或设备验收。
- **Cloud smoke：BLOCKED / 未执行**。本地未配置 LIVEKIT_URL、LIVEKIT_API_KEY、LIVEKIT_API_SECRET。产品所有者已选择先完成本地验证，Cloud 项保持未完成。
- 发布状态：**not deployed**；未配置公网 Webhook、未创建生产房间、未归档 change。
- 房主 leave/transfer/remove/reinvite/end 和 60 秒窗口由后续 `implement-host-controls-backend` 实现；本 change 不声明整个语音房产品已完成。

## 本地验证

| 检查                                             | 结果                                                                                                                 |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| `pnpm install --frozen-lockfile`                 | PASS；锁定 livekit-server-sdk 2.19.0、BullMQ 6.3.4、ioredis 6.0.0                                                    |
| `pnpm --filter @slogan/api exec prisma validate` | PASS；Prisma 多文件 schema                                                                                           |
| `pnpm --filter @slogan/api db:test:migrate`      | PASS；两个新增 additive migrations，未改写旧迁移                                                                     |
| 最终 `pnpm verify:api`                           | PASS；74 个单元测试、31 个 PostgreSQL/Redis 集成测试、18 个 HTTP E2E；lint、typecheck、build、OpenAPI drift 全部通过 |
| `pnpm format:check`                              | PASS                                                                                                                 |
| `pnpm deps:check`                                | PASS；API 专属依赖与模块边界检查                                                                                     |
| OpenSpec 严格校验                                | PASS                                                                                                                 |

使用本地隔离 PostgreSQL 17.6 和 Redis 7.4 测试容器。新实时 HTTP E2E 使用真实 PostgreSQL 和认证服务，仅替换 LiveKit provider 并关闭后台 runner，以得到确定性 HTTP 证据；队列与恢复测试另行使用真实 Redis。上述测试不连接真实 Cloud。

原生可选依赖 `msgpackr-extract` 的构建脚本被显式禁用，采用 JavaScript 回退；冻结安装和真实 Redis 测试验证此配置可用。

## 后续房主管理可复用的边界

| 能力       | 实际入口与责任                                                                                                                                                                                                                                                          |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 凭证授权   | [RoomRealtimeService](../../apps/api/src/modules/rooms/application/services/room-realtime.service.ts) 的 reserveCredential / confirmCredential / finishCredential：重新校验资格、当前 identity/version 和房间状态；每个请求独立的发证保护记录                           |
| 成员查询   | 同一服务的 members：限定当前成员访问，只投影 membershipId、昵称、CEFR、角色、麦位、presence、opaque identity                                                                                                                                                            |
| 房间事务   | [RoomRealtimeRepository](../../apps/api/src/modules/rooms/domain/ports/room-realtime.repository.ts) 的 withRoom；[Prisma 实现](../../apps/api/src/modules/rooms/infrastructure/prisma-room-realtime.repository.ts) 使用 Room 行锁及数据库时钟，原子提交状态、事件与命令 |
| Presence   | RoomRealtimeService.applySignal：规范化 id / roomId / roomSid / type / identity / sessionSid / occurredAt / source；事件 ID 去重、当前 session 和时间水位校验，在事务内写入                                                                                             |
| 结束入口   | RoomRealtimeService.endRoom：OPEN → ENDING；记录原因并创建撤销和删除命令。只有 provider 删除完成才置 ENDED，授权从 ENDING 或 endsAt 起立即拒绝                                                                                                                          |
| 外部执行   | [VoiceService](../../apps/api/src/modules/voice/application/services/voice.service.ts) 的 dispatch / dispatchPending / expire / reconcile；Webhook 首试只处理目标房间的 pending command                                                                                 |
| Provider   | [RealtimeProvider port](../../apps/api/src/modules/voice/domain/ports/realtime-provider.port.ts) 与 [LiveKit adapter](../../apps/api/src/infrastructure/livekit/livekit.adapter.ts)：token、ensureRoom、participants、revoke、deleteRoom、verifyWebhook                 |
| 延时与恢复 | [RealtimeQueue](../../apps/api/src/infrastructure/redis/realtime-queue.service.ts)、[RealtimeRunner](../../apps/api/src/modules/voice/infrastructure/realtime-runner.service.ts)：现有 API 进程内运行，启动和每 15 秒对账，恢复数据库中的到期与 pending 命令            |

公开模块入口为 `modules/rooms/index.ts` 和 `modules/voice/index.ts`。后续房主管理扩展 rooms 自己的领域事务，在相同 presence transaction 中接入断线窗口，不复制 adapter、事件表、队列或结束流程，不依赖 Controller 调用顺序保证原子性。

## 持久事实与恢复规则

- Room 保存 ENDING、stateVersion、providerRoomSid、结束时间/原因；RoomMembership 保存 opaque identity、credentialVersion、presence 与 provider session/时间水位。
- [RealtimeIdentity](../../apps/api/prisma/models/realtime-identity.prisma) 保留实际授权过的身份及撤销状态，不保存 JWT。
- [RealtimeIssuance](../../apps/api/prisma/models/realtime-issuance.prisma) 为每个发证请求保存独立、最多 30 秒的保护记录。请求成功完成 provider 操作后立即释放，不能让正常房间结束等待一个固定窗口；并发请求分别释放，重复释放幂等。进程崩溃或 provider 调用结果不明时，以有界期限保护清理顺序，过期记录由恢复过程清理。
- 本地签名先于 provider 网络操作；5 秒单次 provider 超时、关闭区域 failover，并在剩余保护时间不足时拒绝开始网络操作。最终确认再次检查房间/credential version，不返回在确认前已失效的授权。
- [RoomEvent](../../apps/api/prisma/models/room-event.prisma) 保存规范化事件和结果；未知房间事件只记最小 IGNORED 记录。raw webhook、token、secret 不落库。
- [RealtimeCommand](../../apps/api/prisma/models/realtime-command.prisma) 以 type / room / identity / stateVersion 业务键去重；执行有 leaseId/lockedUntil，崩溃后可重新 claim，旧 lease 完成不能覆盖新 claim。
- 房间删除必须等待有效发证请求结束，并在全部身份撤销命令完成后执行；not-found 不被当作显式撤销成功证据。失败时保留 ENDING / pending，客户端和日志不收到 provider 原始错误或密钥。
- 命令执行最多 8 次，指数退避并保留 FAILED / lastError。Redis 任务有 5 次退避；Redis 终态失败不会永久占住同名数据库任务的恢复入口。
- Redis 或 provider 故障可延迟实际断开；endsAt 与数据库 ENDING 仍立即关闭授权，不会因队列故障额外授予加入资格。当前无生产告警系统，运维需监控 FAILED、ENDING 和队列延迟。

运维恢复 FAILED 时，先核实 provider/配置已恢复，再针对已确认的 command ID 将状态置 PENDING、重置 attempts/nextAttemptAt/lease 字段，让既有恢复流程重试。不得通过重开 Room、删除身份历史或删除失败命令来绕过旧凭证限制；本 change 没有新增公开运维 endpoint。

## 唯一 HTTP Contract

[openapi/openapi.yaml](../../openapi/openapi.yaml) 由 NestJS DTO/decorator 生成，本次仅新增三个 endpoint：

| Endpoint                                     | 鉴权及结果                                                               |
| -------------------------------------------- | ------------------------------------------------------------------------ |
| POST /v1/rooms/{roomId}/realtime-credentials | 用户 Bearer + 资格/成员/房间校验；200 最小凭证响应                       |
| GET /v1/rooms/{roomId}/members               | 用户 Bearer + 当前成员；200 当前成员数组                                 |
| POST /v1/webhooks/livekit                    | provider 签名与原始 application/webhook+json；204 接收成功，重复事件幂等 |

凭证默认 TTL 300 秒，可配置 60–600 秒，只允许指定房间、身份及 microphone publish/subscribe；data、metadata 更新、admin/create/record/video/screen 不授权。新错误包括 ROOM_MEMBERSHIP_REQUIRED (403)、REALTIME_WEBHOOK_INVALID (401)、REALTIME_PROVIDER_UNAVAILABLE (503)；ENDING/到期复用 ROOM_ENDED (409)。

REALTIME_ENABLED 默认 false，此时实时用户接口返回稳定 503，原控制面仍可启动。只有启用时才要求完整 Cloud/Redis 配置并启动 worker；生成 OpenAPI 和现有离线 bootstrap 验证显式关闭 realtime。

## 需求与证据矩阵

| Requirements                                         | 本地证据及边界                                                                                                     |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| voice-session：实时语音交流                          | token claims 与最小成员字段 PASS；真实音频发布/订阅、双设备仍未验证                                                |
| voice-session：默认静音                              | 后续移动端/设备验收，后端未声称覆盖                                                                                |
| voice-session：网络重连反馈                          | presence、session 防倒序、丢失 webhook 对账 PASS；客户端反馈和房主窗口归后续 change                                |
| voice-session delta：房间到期结束，无宽限            | endsAt 拒绝加入/发证、ENDING、撤销先于删除、发证竞争与成功请求即时释放 PASS；实际 Cloud 断开/旧 token 拒绝待 smoke |
| voice-session：房主结束房间                          | 公共结束机制已提供；主动房主入口由 host-controls 覆盖                                                              |
| voice-session：不处理房间音频                        | 未引入录音、STT、转写或回放能力；token 不授予录制权限                                                              |
| basic-safety-reporting：限定实时凭证                 | room/identity/TTL/最小 grant、非成员与失效账号拒绝 PASS；Cloud 实際撤销尚未验证                                    |
| basic-safety-reporting：实时事件审计                 | 验签、事件 ID 唯一、旧 session、同秒断开、未知房间最小审计、事务回滚 PASS                                          |
| basic-safety-reporting：服务端权限                   | 真实认证 HTTP 401/403、过期 409、Webhook 不能用用户 token 替代 provider 签名 PASS；管理/举报权限归后续 change      |
| host-controls：移除、重邀、移交、60 秒窗口及麦位重进 | 不在本 change 实现，后续 change 独立验证；其 Cloud 依赖继承未完成状态                                              |

证据文件：

- [LiveKit adapter 单元测试](../../apps/api/test/unit/livekit.adapter.spec.ts)：真实 SDK 签名/claims、篡改检测、cutoff 参数、not-found 与错误脱敏。
- [PostgreSQL 状态/恢复测试](../../apps/api/test/integration/room-realtime.spec.ts)：权限、identity、presence、事务回滚、并发结束、claim/lease、provider 恢复、遗失 Redis job、无额外发证等待。
- [迁移测试](../../apps/api/test/integration/realtime-migration.spec.ts)：独立 schema 中空库完整升级和包含旧房间/member 的升级；检查 backfill、旧字段保留与新表。
- [Redis 测试](../../apps/api/test/integration/realtime-queue.spec.ts)：确定性 ID、延时、重试、worker 重启与终态失败重排。
- [HTTP E2E](../../apps/api/test/e2e/voice.e2e.spec.ts)：实际 Bearer、成员权限、最小响应、签名 raw body、幂等、原 JSON endpoint、错误映射。
- [日志测试](../../apps/api/test/unit/log-redaction.spec.ts)与 [bootstrap 测试](../../apps/api/test/bootstrap.spec.ts)：token/secret/raw payload 脱敏，结构化日志不先序列化，条件配置与离线启动。

## 迁移与回滚边界

新增 `20260912020000_livekit_realtime` 和 `20260912030000_realtime_issuance_leases`。旧 Room/RoomMembership ID、joinOrder、外键和历史数据保留；已有 membership backfill 随机 opaque identity，初始 presence 为 DISCONNECTED。升级测试在隔离 schema 执行，未使用生产数据库。

应用回滚先停止发证，再保留仍能工作的撤销/清理进程处理已授权 identity，确认活动 provider 会话结束后再退回旧版本。provider 不可用时保持授权关闭、保留 outbox 和补偿进程，不将关闭开关视为已断开。数据库采用保留 additive 字段与 forward fix，不执行破坏性 down migration。本地已验证字段保留与失败补偿；真实 Cloud 清理及完整发布回滚演练尚未执行。

## Cloud 后续验收

配置隔离 Cloud 项目和公网签名 Webhook 后，仍需使用两名临时测试 identity 验证连接/麦克风权限、在线及离线 identity 的旧 token 重连拒绝、DeleteRoom 断开及真实签名 Webhook。现有 fake provider 或参数检查不能代替这些证据。凭证只写本地环境配置，不进入聊天、仓库或日志。

参考当前官方边界：[Participant management](https://docs.livekit.io/intro/basics/rooms-participants-tracks/participants/)、[Tokens and grants](https://docs.livekit.io/frontends/reference/tokens-grants/)、[RemoveParticipantOptions](https://docs.livekit.io/reference/server-sdk-js/types/RemoveParticipantOptions.html)。实现采用显式撤销 cutoff，并覆盖同秒 nbf 边界；Cloud 行为与时钟前提仍须实际验证。
