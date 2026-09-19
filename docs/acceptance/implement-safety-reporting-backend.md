# 基础安全举报后端验收记录

## 当前状态与前置证据

- Change：`implement-safety-reporting-backend`；2026-09-12，本地后端交付 17/17，未归档、未部署。
- 当前 HEAD：`2687b1a30c90ee1b4abe5a768e28822153922b04`；LiveKit、房主管理和本 change 的实际交付均在未提交工作区，不能把 HEAD 当作这些实现的独立提交版本。
- Node.js 24.21.0、pnpm 12.3.4；按 `.nvmrc` 激活。
- [LiveKit 本地验收](./implement-livekit-voice-session-backend.md)：21/22，本地基础已交付，真实 Cloud smoke 保留未完成。
- [房主管理本地验收](./implement-host-controls-backend.md)：20/21，最终 153 个测试通过；历史 membership lifecycle、管理审计和 `20260912040000_host_controls` 迁移已落地。前次“房主管理未实现”的 BLOCKED 已解除。
- 已核对 [RoomEvent](../../apps/api/prisma/models/room-event.prisma)、[RoomMembership](../../apps/api/prisma/models/room-membership.prisma)、[rooms 公开入口](../../apps/api/src/modules/rooms/index.ts) 及前置验收。本 change 不补做或宣称通过前置 Cloud 测试。

## 实现与集成边界

- 新增 [moderation module](../../apps/api/src/modules/moderation/moderation.module.ts)、提交用例、纯 domain policy 和 repository port。API 只提供 `POST /v1/rooms/{roomId}/reports`；从认证上下文获取举报人，数据库生成首次 submittedAt，新建及重试均返回 201，业务 body 仅 id/submittedAt。
- 五类为 HARASSMENT_ABUSE、HATE_DISCRIMINATION、SEXUAL_CONTENT、SPAM_ADVERTISING、OTHER；adapter 显式映射数据库 enum。UUID 规范化小写，说明只 trim 后按 Unicode 码点校验 1–2000，不执行 HTML，不合并中间空白。
- [rooms/persistence](../../apps/api/src/modules/rooms/persistence.ts) 提供同事务最小历史上下文：Room 行锁与双方 userId/joinedAt。不调用会拒绝已结束房间的 detail，不读取 profile/在线状态或复制 lifecycle 规则。
- 当前 membership 在真实 join 时创建，joinedAt 必填；INVITED 由曾加入后的 REMOVED 转换。历史邀请资格可举报；单纯链接/邀请声称没有加入行则不可举报。domain 还显式拒绝 joinedAt=null，未为未来纯邀请流程添加占位模型。
- [audit/persistence](../../apps/api/src/modules/audit/persistence.ts) 提供最小 RoomEvent 写入能力，rooms 原事务和 moderation 复用。Prisma TransactionClient 只在公开 infrastructure 集成入口间传递，不进入 application/domain/controller。
- [PrismaReportRepository](../../apps/api/src/modules/moderation/infrastructure/prisma-report.repository.ts) 同事务读取资格、写 Report 和关联 RoomEvent。审计不复制正文，仅写 reportId、room、actor、target、category、time、result。
- `(reporterUserId, clientRequestId)` 唯一约束处理并发；内容比较包含房间、目标、类别、规范化说明。P2002 后先退出已失败事务再重读，只查询当前举报人的标识；相同内容返回首次凭据，不同内容稳定冲突。
- 不调用 LiveKit/Redis，不新增处罚、通知、广播、查询、修改或删除接口。举报不改变房间、host、membership 或账号权限。

## 错误与隐私

| HTTP | Code / 行为                                                          |
| ---- | -------------------------------------------------------------------- |
| 201  | 新建和等价重试仅返回 id/submittedAt                                  |
| 400  | VALIDATION_FAILED；合法成员 self-report 为 REPORT_TARGET_INVALID     |
| 401  | ACCESS_TOKEN_INVALID，复用现有有效会话与 ACTIVE 账号规则             |
| 404  | REPORT_CONTEXT_NOT_FOUND；未知房间、举报人未加入、目标未加入统一响应 |
| 409  | REPORT_REQUEST_CONFLICT，不覆盖原内容                                |
| 500  | INTERNAL_ERROR，不返回底层数据库错误                                 |

先认证与格式校验，再检验举报人上下文，避免向陌生人泄露目标关系。额外 reporterUserId/submittedAt 字段被全局 ValidationPipe 拒绝。

正文只保存在 Report。新增 description 路径脱敏；异常过滤器只记录固定事件名、errorName、method/path/requestId，不再输出可能包含 SQL 或参数正文的原始异常 stack。隐私测试捕获实际 StructuredLogger 输出和失败响应，验证正文、token 与 SQL 哨兵不泄露。

## 迁移与回滚

新增 [20260912050000_safety_reporting](../../apps/api/prisma/migrations/20260912050000_safety_reporting/migration.sql)，保留前置迁移：

- 独立 Report model、ReportCategory enum、请求唯一键、room/time/id 索引。
- reporter/target 使用同房间 membership 复合外键；数据库补 self-report 与文字码点长度防线，RESTRICT 防止意外级联删除。
- RoomEvent 新增可空唯一 reportId；旧事件为 null，report_submitted 必须有 Report 关联及审计主体/类别/结果字段。

迁移测试在真实 PostgreSQL 随机 schema 上分别覆盖空库和带已结束房间、REMOVED 历史成员、旧管理审计的升级；验证旧列可读写、旧事件关联为空、外键/索引和数据保留。已有 room 流程回归验证加法 schema 兼容。

回退应用时停止新举报入口，保留 Report、enum、可空事件关联及已写数据，以 forward fix 修复后恢复；不做破坏性 down migration。带举报的 Room/membership 不再可被级联删除，后续删除/注销必须单独设计数据处理。未执行真实生产回退，未设定保留期限或自动删除策略。

## 需求与验证矩阵

| Delta 场景                                             | 验证入口                                                                                                                                               |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 五类有效举报、无效说明/类别、Unicode 长度              | [policy 单元测试](../../apps/api/test/unit/report.policy.spec.ts)、[HTTP 测试](../../apps/api/test/e2e/reports.e2e.spec.ts)                            |
| 历史成员、当前/历史房主、结束房间                      | [PostgreSQL 事务测试](../../apps/api/test/integration/reports.spec.ts) 覆盖 ACTIVE/LEFT/REMOVED/曾加入 INVITED 与 OPEN/ENDING/ENDED；HTTP 历史举报流程 |
| 伪造身份/时间、无效会话、self/cross-room、没有加入事实 | HTTP 额外字段、401/400/404 一致性；domain joinedAt=null 与 reporter 优先验证                                                                           |
| 并发和响应丢失重试、改内容冲突、举报人隔离             | 真实数据库相同/跨房间唯一冲突、重建连接重试及不同 reporter 同请求标识                                                                                  |
| 举报与审计全部成功或失败                               | 数据库 trigger 分别注入 Report 与 RoomEvent 写入失败；验证双方都不存在，成功 reportId/actor/target/category/time 匹配                                  |
| 已有房主管理/连接审计                                  | 复用 audit writer 后运行前置回归；举报并发 leave/remove/end 不丢历史资格                                                                               |
| 最小结果、正文隐私、无查询/修改/处罚/通知              | HTTP 精确 body、日志捕获、路由 404、provider/outbox 与 room/membership/账号无变化断言                                                                  |
| 数据迁移、数据库最后防线                               | [migration 测试](../../apps/api/test/integration/report-migration.spec.ts) 与事务约束测试，覆盖 enum/长度/self/FK/唯一 audit/RESTRICT                  |
| 数据库支持的完整 HTTP smoke                            | Fake OAuth adapter + 真实 Session/Prisma：登录→补资料→建房/加入→离开/结束→举报→重试；查询 Report/RoomEvent 各一条                                      |

## 本地验证结果

| 检查                                                            | 结果                                                                                              |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Prisma validate / migrate                                       | PASS；隔离库完整六段迁移链，独立空库及历史数据升级测试通过                                        |
| 定向规则测试                                                    | PASS；16 个 policy 单元测试                                                                       |
| 定向 PostgreSQL / migration / HTTP                              | PASS；27 个测试，一次通过，包含真实数据库 HTTP 闭环                                               |
| 最终 `pnpm verify:api`                                          | PASS；90 个单元、67 个集成、39 个 HTTP E2E，共 196 个；lint、typecheck、build、OpenAPI drift 通过 |
| `pnpm format:check`                                             | PASS                                                                                              |
| `pnpm deps:check`                                               | PASS；169 modules、513 dependencies，无模块边界或循环依赖违规                                     |
| `openspec validate implement-safety-reporting-backend --strict` | PASS                                                                                              |

上述矩阵全部后端范围场景对应的测试已通过。本次新增 43 个测试；实现完成后完整 `pnpm verify:api` 只运行一轮，一次通过。文档登记后仅重新格式化文档，不重跑业务测试。

环境记录：Docker daemon 停止导致首次 migrate 失败；启动 Docker Desktop、恢复隔离容器并成功执行完整迁移链后继续。开发检查修正了一个测试类型声明和一个 lint 换行问题；未将环境失败或未执行项记作 PASS。

前端/Figma、真机、产品所有者验收、CI 和生产部署未执行。本 change 的数据库举报流程不依赖 Cloud；前置 LiveKit/房主管理 Cloud 项仍保留未完成，不由本次后端验证替代。

## 2026-09-15 主 spec 合并与归档验收

用户确认本 change 执行“合并同步主 spec → 校验 → 归档”，接受范围为已交付的基础举报后端。上文 2026-09-12 的测试数量和未执行项保留为历史证据；前置 LiveKit/房主管理 Cloud 项仍未完成并保持未归档，部署状态仍为未部署。

后续 `2026-09-15-implement-safety-case-restrictions-backend` 已归档并扩展举报受理。本次对旧 delta 与主 spec 做兼容合并，保留举报、唯一安全案件和可用时初始分配的同事务提交，以及无安全员、案件创建失败、原案件重试场景；最小提交凭据对齐为 `id/caseId/submittedAt`。这些行为来自后续已归档 change，当前 controller、repository 和 HTTP 测试亦已体现，不记作本 change 在 2026-09-12 已交付的能力。

本次仅同步规范和归档材料，不修改业务代码，不重跑业务测试，也不把既有测试记录当作本次新执行结果。

本次归档校验结果：change 严格校验 PASS；全部 14 份主 spec 严格校验 PASS；5 个 delta requirement 与合并后的主 spec 一致，原有另外 2 个 requirement 保留，17/17 任务完成，差异空白检查 PASS。

归档位置：`openspec/changes/archive/2026-09-15-implement-safety-reporting-backend/`，schema 为 `spec-driven`。后续云环境验证、前端/设备验收及部署仍分别跟踪，不由本次归档标记完成。
