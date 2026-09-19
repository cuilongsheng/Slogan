# 房主管理后端验收记录

## 范围与依赖

- Change：implement-host-controls-backend；本地实现完成（20/21），未归档、未部署。
- 前置 [LiveKit 本地验收](./implement-livekit-voice-session-backend.md) 已完成 123 个测试；真实 Cloud smoke 按用户选择保留 BLOCKED，不能据此宣称线上旧 token 撤销已验证。
- 复用 [rooms 公开入口](../../apps/api/src/modules/rooms/index.ts) 中 RoomRealtimeService 的授权、presence、身份历史、公共结束事务，以及 [Prisma Room 行锁/outbox](../../apps/api/src/modules/rooms/infrastructure/prisma-room-realtime.repository.ts)。
- 复用 [VoiceService](../../apps/api/src/modules/voice/application/services/voice.service.ts) 的 revoke/delete dispatcher、[RealtimeRunner](../../apps/api/src/modules/voice/infrastructure/realtime-runner.service.ts) 与原 BullMQ 队列；没有新建 provider、事件表或队列。
- 管理 controller 与 use case 由 rooms 拥有；VoiceModule 在组合阶段通过 ROOM_COMMAND_DELIVERY 接入已有 dispatcher，避免 rooms application 导入 voice 实现。

## 验证状态

日期：2026-09-12；Node.js 24.21.0、pnpm 12.3.4。

| 检查                                                         | 结果                                                                                                      |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| Prisma validate / 独立 additive migration                    | PASS；隔离测试库升级成功，空库与 LiveKit 运行数据迁移测试通过                                             |
| 最终 `pnpm verify:api`                                       | PASS；74 个单元测试、54 个集成测试、25 个 HTTP E2E，共 153 个；lint、typecheck、build、OpenAPI drift 通过 |
| `pnpm --filter @slogan/api openapi:generate`                 | PASS；Swagger parser 校验通过，四个新增 endpoint 与既有投影更新                                           |
| `pnpm format:check`                                          | PASS                                                                                                      |
| `pnpm deps:check`                                            | PASS；151 modules、443 dependencies，无循环或跨模块深层依赖                                               |
| `openspec validate implement-host-controls-backend --strict` | PASS                                                                                                      |
| 真实 LiveKit Cloud 管理业务 smoke                            | BLOCKED / 未执行，保留任务 6.1                                                                            |

开发中使用定向测试：首轮发现并修复停用账号重邀漏洞；纠正 provider 恢复后仍可能 ENDING 的过强 HTTP 断言，再定向复测边界。全部实现完成后只执行一轮完整 `pnpm verify:api`，一次通过。相对前置交付新增 30 个测试；本记录更新后仅复核文档格式。

Cloud 管理业务 smoke、UI 选择器、双设备音频、设备权限、产品接受和部署均未执行。

## 已实现的服务端行为

- [HostControlsService](../../apps/api/src/modules/rooms/application/services/host-controls.service.ts) 在 Room 行锁内校验当前房主、账号、成员 lifecycle、目标房间和 credentialVersion；成功 mutation、RoomEvent、RealtimeCommand 同事务提交。可预期的拒绝动作保存 DENIED 审计，存储异常整体回滚。
- ACTIVE 占容量；LEFT/REMOVED/INVITED 不占容量。LEFT 或 INVITED 成功重进时更新原 membership、分配全新 identity、递增 credentialVersion，并使用历史最大 joinOrder 加一。异常断网保持 ACTIVE，当前成员按 joinOrder 展示连续 position。
- leave/remove/invite 请求携带 expectedCredentialVersion。同一已提交 generation 的重复动作不重复成功审计；旧请求遇到重进后的新 generation 返回 ROOM_OPERATION_CONFLICT。移除不能针对自己或其他房间成员；普通成员不能指定接任者。
- 重邀先校验被邀请人的账号、onboarding、开放状态和容量，不预留席位。实际 join 再校验账号、规则、密码、容量和窗口；停用账号不能通过重邀或直接 application join 恢复。
- 房主 leave 只选择 ACTIVE、在线、账号有效的接任者。指定无效时拒绝且不默认替换；未指定时选最小 joinOrder。角色与 hostUserId 原子更新，原房主 LEFT；没有候选则调用公共结束入口。
- 房主主动 end、无接任者、断线超时无候选复用 OPEN → ENDING → ENDED。ENDING 即拒绝 join/token，实际撤销和 DeleteRoom 完成后才是 ENDED。到期结束优先于超时移交。
- 房主断线在原 presence 事务中保存 60 秒 deadline、独立 hostReconnectVersion、审计及 HOST_TIMEOUT outbox。及时恢复清除窗口；截止时刻及以后恢复触发结算，迟到事件不能夺回已转移的房主权限。真实 provider Webhook 丢失时使用 reconciliation 的可信观察时间，不倒推出未知断线时刻。
- 窗口未结算时，ACTIVE 可以重复 join 和恢复凭证；新用户、LEFT、INVITED join 返回 ROOM_HOST_RECONNECTING 和 details.retryAt，即使 deadline 已过也不能绕过未结算窗口。
- 原 RealtimeRunner 将持久 HOST_TIMEOUT 调度为同一 BullMQ 队列中的 host-timeout job，启动/每 15 秒恢复；数据库命令包含原 identity 和 reconnect version，执行时重新检查 deadline，重复或失效任务 no-op。普通成员动作只改变通用 stateVersion，不使有效窗口任务失效。
- 继续使用原 provider dispatcher/重试。REVOKE_IDENTITY 只等待目标 identity 的有效发证 lease，避免其他成员刷新凭证拖住移除；DELETE_ROOM 仍等待全部有效发证及撤销完成。旧身份撤销不会针对重邀后产生的新 identity。

## 唯一 HTTP Contract

[NestJS controller](../../apps/api/src/modules/rooms/presentation/host-controls.controller.ts) 与 [DTO](../../apps/api/src/modules/rooms/presentation/dto/host-controls.dto.ts) 生成 [openapi/openapi.yaml](../../openapi/openapi.yaml)。四个新入口均要求用户 Bearer：

| Endpoint                                                   | 输入和输出                                                                        |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------- |
| POST /v1/rooms/{roomId}/leave                              | expectedCredentialVersion；房主可带 successorMembershipId；返回退出/接任/结束状态 |
| POST /v1/rooms/{roomId}/members/{membershipId}/removals    | 目标 expectedCredentialVersion；仅当前房主                                        |
| POST /v1/rooms/{roomId}/members/{membershipId}/invitations | 被移除目标 expectedCredentialVersion；邀请不占位                                  |
| POST /v1/rooms/{roomId}/end                                | 当前房主主动结束；重复调用返回当前结果或稳定权限冲突                              |

既有 join/detail 投影增加 lifecycle、credentialVersion 和 hostReconnectDeadline；members 仅返回 ACTIVE、连续 position 和最小公开字段；realtime-credentials 返回当前 lifecycle/role/generation/窗口，仍为房间限定的最小音频权限。

管理响应包含 roomStatus 与 providerStatus=COMPLETED/PENDING/UNAVAILABLE。200/PENDING 表示数据库动作已提交、清理仍排队；503/REALTIME_PROVIDER_UNAVAILABLE 的 details 保存已提交动作结果，不能解释为事务回滚。撤销恢复后删除可能在下一次调度完成，期间保持 ENDING。达到前置重试上限的 FAILED 命令需要按前置验收记录进行运维恢复，不能删除身份历史或重开房间绕过授权。

稳定错误覆盖 ROOM_HOST_REQUIRED、ROOM_MEMBER_NOT_ACTIVE、ROOM_INVITATION_REQUIRED、ROOM_SUCCESSOR_INVALID、ROOM_HOST_RECONNECTING、ROOM_OPERATION_CONFLICT、ROOM_ACCOUNT_RESTRICTED，以及既有容量、资格、结束、provider 错误。

## 需求与证据矩阵

| 需求 / 场景                                              | 证据 / 边界                                                                                                                                                                                                                                                                    |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| current host-controls：移除、重邀、限制不可绕过          | [事务测试](../../apps/api/test/integration/host-controls.spec.ts) 覆盖停用账号、末位重进、旧 generation、身份隔离、最后席位竞争；[HTTP 测试](../../apps/api/test/e2e/host-controls.e2e.spec.ts) 覆盖权限绕过、移除后发证拒绝、重邀规则复查。真实旧 token 的 Cloud 拒绝未验证。 |
| current host-controls：指定/默认接任、无候选关闭         | 事务测试覆盖指定离线目标拒绝、默认在线顺序、原子角色更新、并发退出/移除/结束；HTTP 覆盖旧房主 403、没有候选结束。选择器 UI 未实现。                                                                                                                                            |
| delta host-controls：离开前移、重进末位                  | ACTIVE 容量/成员 position、保留 membership 与新 joinOrder、新 identity；HTTP 重复 leave 与旧版本冲突。                                                                                                                                                                         |
| current host-controls：60 秒窗口                         | 事务测试覆盖 59 秒恢复、可控事务时钟的 deadline 前 1 毫秒和截止时刻、超时接任/关闭、旧 session、重复 timer 与普通 stateVersion 变化。                                                                                                                                          |
| delta voice-session：窗口内继续/恢复，暂停新加入         | ACTIVE join/token 正常；新用户/LEFT/INVITED 拒绝且不占位；HTTP 返回 retryAt 与窗口投影。持续双设备音频不由后端测试证明。                                                                                                                                                       |
| current voice-session：主动结束不可恢复                  | HTTP ENDING/503 已提交语义、重试结束、join/token 拒绝；事务覆盖发证与结束竞争、所有历史身份撤销，真实断开需 Cloud。                                                                                                                                                            |
| current basic-safety-reporting：管理事件审计及服务端鉴权 | 成功 actor/target/reason/time/result 审计、重复无双写、DENIED 审计、存储故障回滚与非房主/跨房间请求拒绝。举报提交继续归 safety-reporting change。                                                                                                                              |
| 丢失事件/任务与 worker 恢复                              | 同一 presence 事务中模拟持久任务写入前崩溃后重放；provider 对账补断线/恢复；真实 Redis 清空任务后启动恢复，PostgreSQL deadline 重建并执行，不提前转移。                                                                                                                        |
| 凭证发放和撤销竞态                                       | 未完成的目标发证阻止提前撤销；最终确认拒绝已移除目标；无关身份发证不阻塞撤销。                                                                                                                                                                                                 |

## 数据迁移与回滚边界

[20260912040000_host_controls](../../apps/api/prisma/migrations/20260912040000_host_controls/migration.sql) 是独立 additive migration；新增 lifecycle、离开/移除字段、host reconnect 字段及 HOST_TIMEOUT enum，原行默认 ACTIVE，没有重复创建 realtime 表或改写已落地迁移。

[迁移测试](../../apps/api/test/integration/host-controls-migration.spec.ts) 在真实 PostgreSQL 的独立随机 schema 验证空库升级链和已有 LiveKit 数据升级：保留连接状态、membership/joinOrder/generation/identity、ENDING 房间、pending command 与事件；核对 enum、外键及 ACTIVE 查询索引。事务回滚演练确认 REMOVED 限制和 pending command 不丢失。

发布应先迁移，再同批部署新授权与 worker，不能混跑不认识 lifecycle 的旧发证程序。回退前必须在入口关闭 join/token/管理，完成 provider 会话撤销及结束；provider 不可用时保持入口关闭并保留 worker，等待恢复或 forward fix。数据库保留新增字段和历史，不做破坏性 down migration。上述入口隔离与 Cloud 清理的发布回退步骤是操作要求，未在真实部署环境演练；本地事务回滚测试不能替代它。

## Cloud 与产品验收保留项

Cloud 管理业务 smoke 保持 BLOCKED / 未执行：移除后在线/离线旧 token 拒绝、重邀新 identity 加入、指定/默认接任、60 秒恢复/超时和 host end 实际断开。继承用户“先完成本地验证，Cloud 保留未完成”的选择；未读取或写入真实 provider 密钥。

前端页面、选择器、双设备语音、麦克风权限、产品验收、CI 结果与生产部署均不记 PASS；change 保持未归档。测试使用 fake LiveKit provider，仅 PostgreSQL/Redis/HTTP 为本地真实运行。
