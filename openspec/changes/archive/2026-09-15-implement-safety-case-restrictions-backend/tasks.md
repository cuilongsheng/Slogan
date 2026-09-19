## 1. 数据模型与模块基础

- [x] 1.1 在 Prisma schema 中新增案件、参与者快照、案件活动、限制、申诉、幂等命令和分配游标所需 enums/models/relations/indexes，并扩展审计系统 actor；运行 `pnpm --filter @slogan/api exec prisma format && pnpm --filter @slogan/api exec prisma validate` 验证 schema。
- [x] 1.2 创建可部署迁移：初始化分配游标，为全部历史 `Report` 幂等 backfill 唯一 `OPEN` 案件、最小活动和可取得的成员快照；在测试数据库执行迁移并用 SQL 验证举报数等于唯一案件数且不存在孤立外键。
- [x] 1.3 建立 `safety` 模块的 domain entities、ports、errors、状态转换、等级持续时间、Unicode 理由规范化和命令 hash policy；用 targeted unit tests 验证 3/12/24 小时、30 分钟窗口、非法转换和条件字段。
- [x] 1.4 建立 safety repository、transaction persistence helper 和 module exports 的最小骨架，并验证 `pnpm --filter @slogan/api typecheck` 通过且 dependency-cruiser 不出现模块环。

## 2. 举报建案与案件分配

- [x] 2.1 扩展举报受理事务，在 `Report`、举报 `RoomEvent`、唯一 `SafetyCase`、参与者快照、创建活动和初始系统审计之间实现全有或全无；用 integration test 注入中途失败并验证没有半成品举报。
- [x] 2.2 在举报响应及幂等 replay 中返回稳定 `caseId`，保留原字段；用 integration test 验证相同请求返回原举报/案件、不同内容复用请求标识返回冲突。
- [x] 2.3 实现基于当前有效安全员、未结案件最小负载和持久轮转游标的原子自动分配；用多安全员 integration test 验证最低负载、并列轮转和无安全员时保留未分配案件。
- [x] 2.4 实现未分配案件领取和失效处理人重新分配的 compare-and-set repository 操作；用并发 integration test 验证自动分配、领取和恢复竞争后只有一个当前处理人。

## 3. 后台权限与审计扩展

- [x] 3.1 增加案件全量读取、案件工作、限制工作和申诉工作权限，并更新角色映射；用 policy/guard unit tests 验证管理员只读、安全员工作权限、双角色权限并集和其他角色拒绝。
- [x] 3.2 扩展后台审计 action 白名单、DTO 过滤和 `SYSTEM_JOB` actor，覆盖案件、证据、分配、限制、到期、申诉和永久禁用；运行 audit targeted tests 验证新 action 可查询且未知 action 被拒绝。
- [x] 3.3 为案件、证据、限制和申诉敏感读取实现同事务成功审计与固定字段白名单；用 repository test 让审计写入失败并验证敏感数据不会返回。
- [x] 3.4 为已认证后台用户的角色、状态、窗口和并发拒绝追加最小拒绝审计，同时保持普通用户基础后台拒绝；用 API tests 验证业务状态不变且审计不包含举报/申诉正文或请求体。
- [x] 3.5 抽取并复用平台管理员集合事务锁，在永久禁用和角色撤销中共同保护最后一个有效管理员；用交叉并发 integration test 验证不能把有效管理员数量降为零。

## 4. 案件查询、证据和状态机

- [x] 4.1 实现后台案件列表和详情 repository，支持稳定游标及已批准的状态、时间、目标用户过滤和角色范围；用 integration tests 验证管理员全量、安全员本人加未分配、非法游标和跨处理人隔离。
- [x] 4.2 实现有界证据包投影，组合举报、受理成员快照、房间事件、房主管理事件、相关举报/案件/限制摘要和案件活动；用 fixture test 验证稳定顺序、空信号标记和截断信息。
- [x] 4.3 为证据 DTO 建立显式白名单映射；用序列化测试和敏感词断言验证响应不包含 token、provider subject、完整转写、ORM 原对象或非必要资料。
- [x] 4.4 实现案件领取与 `OPEN -> UNDER_REVIEW` 命令的持久幂等、资源归属和版本保护；用 targeted integration tests 验证重试、请求标识内容冲突、他人案件拒绝和并发状态一致。
- [x] 4.5 实现 `DISMISSED` 和 `RESOLVED/NO_ACTION` 人工终态事务，原子写案件、活动、命令和成功审计；用 tests 验证不创建限制、终态不可再次决定且单条举报不会自动推进。
- [x] 4.6 实现 `TEMPORARY_RESTRICTION` 结案事务，按数据库时间计算固定等级期限和申诉截止时间；用 fake clock/database integration test 验证客户端不能指定时长且 retry 不重新计算时间。
- [x] 4.7 实现 `PERMANENT_DISABLE` 结案事务，校验等级与 `factsConfirmed`，原子写永久处置、禁用用户、撤销会话、终结案件和审计；用 tests 验证一般等级、未确认事实和最后管理员均被拒绝。

## 5. 临时限制读取、执行与解除

- [x] 5.1 实现按 PostgreSQL 当前时间计算有效限制的共享 transaction helper，以及最高有效等级和最晚结束时间投影；用 repository tests 验证边界 `now == endsAt`、重叠限制和一条解除后重新计算。
- [x] 5.2 把共享限制校验接入即时房间创建与加入事务，并保持现有 `User.status` 校验；用 API tests 验证受限用户不创建房间/成员资格，而登录和只读房间能力不被临时限制误伤。
- [x] 5.3 把共享限制校验接入预约房间创建和预约写事务；用 API tests 验证拒绝时不写 `Room`/`RoomReservation`，已到期但未收敛的限制立即放行。
- [x] 5.4 把共享限制校验接入实时凭证预留事务，确保在 provider 调用前拒绝；用 fake realtime provider test 验证受限用户不会创建 issuance 或调用 token provider。
- [x] 5.5 实现本人限制历史/当前限制的稳定分页和最小投影；用 e2e tests 验证只可读取本人、当前/历史/申诉状态正确且举报人和后台处理人不可见。
- [x] 5.6 实现安全员直接提前解除事务和幂等 replay；用并发 integration tests 验证只写一个解除事实、立即影响后续访问且不解除其他重叠限制。

## 6. 临时限制申诉闭环

- [x] 6.1 实现用户在 `appealDeadlineAt` 当时或之前提交一次申诉的 API 和事务；用 database-time tests 覆盖窗口内、边界时刻、窗口后、已到期/解除、永久处置和他人限制。
- [x] 6.2 为申诉提交实现 `(restrictionId)` 唯一约束和 `SafetyCommand` replay；用并发 integration tests 验证最多一条申诉、相同请求返回原结果且不同内容复用标识冲突。
- [x] 6.3 实现安全员待处理申诉列表和详情范围，查询成功必须审计；用 permission/API tests 验证安全员可读、其他单角色拒绝、稳定分页及敏感字段最小化。
- [x] 6.4 实现 `UPHELD` 与 `LIFTED` 申诉决定事务，原子更新申诉、可选解除、案件活动、命令和审计；用并发 tests 验证只有一个终态、维持不改期限、解除立即生效。

## 7. 到期与重新分配恢复

- [x] 7.1 新增独立 `slogan-safety` BullMQ queue 和 `SafetyRunner`，job 只携带 kind/id，并实现启动及固定周期数据库扫描；用 unit tests 验证未配置 Redis 时安全模块仍可启动且日志无敏感内容。
- [x] 7.2 在创建临时限制后尽力安排到期 job，实现行锁保护的幂等 `EXPIRED` 收敛、活动和 `SYSTEM_JOB` 审计；用 integration tests 验证重复 job、提前解除和未到期 job 不重复写入。
- [x] 7.3 在 runner 中恢复未分配案件和处理人已失效的未结案件，并复用同一轮转算法；用多实例并发 test 验证单一处理人、当前角色读取和稳定负载结果。
- [x] 7.4 执行 Redis 停机、限制跨过 `endsAt`、Redis 恢复后的 runtime smoke，验证房间入口按数据库时间放行且投影最终收敛；记录命令和可观察结果，不把未执行步骤标为通过。

## 8. API Contract 与完整验收

- [x] 8.1 实现所有案件、证据、限制、申诉 controller/DTO/error mapping 和 OpenAPI decorators，并运行 `pnpm --filter @slogan/api openapi:generate` 更新唯一 `openapi/openapi.yaml`。
- [x] 8.2 检查 OpenAPI diff 和 parser：确认举报响应保留原字段、新路由/枚举/条件字段/稳定错误已记录且不存在第二份 contract；运行 `pnpm --filter @slogan/api openapi:check`。
- [x] 8.3 在全新数据库和含历史举报的数据库各执行一次迁移 smoke，验证 forward migration、幂等 backfill、应用启动和保留新增表的应用代码回滚路径，并记录实际 SQL 计数证据。
- [x] 8.4 增加从举报、自动分配、领取、复核、临时限制、入口拒绝、申诉、解除/到期到恢复访问的完整 API e2e 场景；运行对应 e2e suite 并核对每个 OpenSpec scenario 都有自动化或明确 runtime 证据。
- [x] 8.5 增加管理员/安全员职责分离、旧 token 角色撤销、并发终态、重叠限制、永久禁用与最后管理员保护的安全回归；运行对应 integration/e2e suites 并捕获响应与日志脱敏断言。
- [x] 8.6 执行一次最终 affected-scope 验证：`pnpm verify:api && pnpm deps:check`，随后运行 `/Users/cls/.nvm/versions/node/v25.9.0/bin/openspec validate implement-safety-case-restrictions-backend --strict`；仅在全部实际通过后勾选任务并记录任何环境阻塞或未执行 smoke。
