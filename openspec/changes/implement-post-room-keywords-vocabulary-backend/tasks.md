## 1. Schema、配置与迁移

- [x] 1.1 为 `POST_ROOM_KEYWORDS` 同意目的、汇总/条目/任务状态和单词本条目类型增加 Prisma 枚举，并通过 Prisma validate/generate 验证 schema 可生成
- [x] 1.2 为 Room 增加默认 false 的 `postRoomKeywordsEnabled`，增加 RoomKeywordSummary、RoomKeywordSummaryItem、RoomKeywordSummaryJob、VocabularyItem 和 VocabularyCommand 模型及唯一约束/索引，并通过结构集成测试验证关系与 keyset 索引
- [x] 1.3 编写只向前迁移和房间开关不可变触发器，用含历史 Room 的迁移测试验证旧行全部为 false、创建后直接 SQL 更新也被拒绝
- [x] 1.4 增加关键词 feature flag、notice/extractor version、候选上限、TTL、job lease/截止时间配置，并验证关闭时旧 API/worker 可以启动、启用但依赖缺失时启动或 readiness 安全失败且不暴露配置值
- [x] 1.5 定义汇总、候选、单词本、job 和目的级处理的 domain entity/port，运行依赖边界检查验证 domain 不导入 Prisma、Redis、LiveKit、NestJS 或 transport DTO
- [x] 1.6 在验收文档写入部署与回滚顺序，验证包含先关闭新建、收敛 job、停止 consumer、保留新增表/用户内容和清理临时键

## 2. 房间开关与目的级同意

- [x] 2.1 扩展即时和预约创建 DTO、领域实体与 Prisma 映射，验证未提交会后关键词字段时持久化 false、明确启用时持久化 true
- [x] 2.2 在即时列表、详情、分享解析、预约详情和 presenter 返回 `postRoomKeywordsEnabled`，验证关闭和启用房间的响应且不改变既有分页/可见性
- [x] 2.3 复用共享 worker readiness 并增加关键词 feature gate，验证依赖不健康时拒绝创建 enabled 房间但仍允许创建 disabled 房间
- [x] 2.4 增加 `POST_ROOM_KEYWORDS` 同意状态与接受/撤回命令，验证三个目的互不授权、notice version 更新失效、相同 UUID 重试幂等且变更载荷冲突
- [x] 2.5 将加入、reserve/confirm 和 realtime token 续期改为计算房间所需目的集合，验证只开安全、只开关键词、两者都开和全部关闭的同意矩阵
- [x] 2.6 实现关键词同意撤回的 issuance 失效、membership 收敛和可靠 `REVOKE_IDENTITY` 命令，验证后续处理停止且不产生举报、案件、restriction 或账号状态变化

## 3. 中立房间语音处理编排

- [x] 3.1 建立 room-speech-processing application 边界并迁移媒体发现、STT session、purpose context 和清理职责，验证现有 API 与独立 worker 仍可分别启动
- [x] 3.2 将活跃房间发现改为选择启用任一房间语音目的的 OPEN 房间，验证安全-only、关键词-only、双开房间各只建立一个媒体 session
- [x] 3.3 实现每个短窗口只调用一次 STT 并同步扇出到已启用 consumer，验证双开房间不会产生第二个隐藏参与者或第二次 provider 调用
- [x] 3.4 在 STT 前后校验全部 required purpose 的 consent generation，验证任一目的撤回或版本变化都会丢弃窗口、取消 session 且不提交 consumer 结果
- [x] 3.5 隔离 safety 与 post-room consumer 失败，验证风险规则失败不阻止合格关键词候选、候选提取失败不阻止既有风险事件与房主提醒
- [x] 3.6 覆盖成员离开、撤回、房间结束、lease 丢失、provider 失败和 shutdown 清理顺序，验证音频 buffer、完整转写和 provider session 在每条路径均不可读取
- [x] 3.7 运行现有 speech-safety unit/integration/e2e/runtime 回归，验证风险去重、当前房主提醒、降级与证据包行为保持不变

## 4. 匿名候选提取与临时聚合

- [x] 4.1 实现版本化的英语关键词和短表达提取 policy，验证大小写/Unicode/标点规范化、停用词、token/字符上限和固定 fixture 的稳定结果
- [x] 4.2 实现联系方式、超长原句和不可安全脱离上下文内容的双重过滤，验证候选、日志、异常和测试快照不包含被拒绝原文
- [x] 4.3 实现不接收成员标识的候选 consumer，验证其输入/输出类型和持久调用只包含 roomId、类型、规范化文本、计数和 extractor version
- [x] 4.4 实现 Redis 候选聚合的 fencing、计数和稳定 namespace，验证旧 token 不能追加、读取最终快照或删除新持有者数据
- [x] 4.5 实现每窗口/每类型/每房间上限与覆盖结束重试窗口的 TTL，验证超限只丢弃低优先候选、过期内容自动消失且不影响真人语音
- [x] 4.6 在 Redis 或候选提取不可用时停止新的关键词处理并记录不含内容的目的级降级，验证 safety consumer 和 LiveKit 会话仍继续

## 5. 结束后汇总与可靠任务

- [x] 5.1 在 enabled 房间创建时原子建立 `COLLECTING` 汇总，并在进入 ENDING/ENDED 的房间事务中推进 `PENDING` 与 upsert job，验证重复结束事件只产生一份汇总和一个任务
- [x] 5.2 实现支持 `FOR UPDATE SKIP LOCKED`、leaseId、lockedUntil 和截止时间的 job claim/recovery，验证并发 runner 只有一个有效持有者且 stale lease 不能完成任务
- [x] 5.3 实现候选快照的二次过滤、稳定评分/排序、去重与有界截取，并在一个 PostgreSQL 事务内写 items、更新 READY 和完成 job
- [x] 5.4 实现候选不足、候选过期、持续依赖失败和超过重试截止时的 UNAVAILABLE 收敛，验证没有空洞内容且房间结束无需等待
- [x] 5.5 实现 READY/UNAVAILABLE 终态幂等，验证重复 job、进程重启和迟到结束事件不能增加条目、改变 READY 内容或回退状态
- [x] 5.6 在终态提交后 compare-and-delete 临时工作集，并增加失败重试与维护清理，验证清理失败不改写持久结果且最终不残留可恢复候选

## 6. 会后汇总查询

- [x] 6.1 实现 `GET /v1/rooms/{roomId}/keyword-summary` 和统一 `DISABLED/PENDING/READY/UNAVAILABLE` envelope，验证只有 READY 返回稳定排序的关键词/短表达
- [x] 6.2 通过 rooms 公开 application port 校验实际 membership 与房间结束状态，验证 LEFT/REMOVED 历史成员可读、仅预约/仅受邀/无关系用户被拒绝且不泄露资源状态
- [x] 6.3 验证汇总响应只含主题、状态、生成时间和允许条目，不含 userId、membership、participant identity、时间线、完整原句或内部失败详情

## 7. 个人单词本

- [x] 7.1 实现从可读 READY summary item 创建 VocabularyItem 的服务端授权与字段复制，验证不能使用未结束、不可读或不存在的来源
- [x] 7.2 实现 VocabularyCommand payload hash 和 `(userId, sourceSummaryItemId)` 约束，验证同 UUID/载荷返回原结果、改变载荷冲突且同一来源不会重复创建
- [x] 7.3 实现 `GET /v1/me/vocabulary-items` 的 `(updatedAt,id)` keyset 分页以及 favorite/kind 筛选绑定，验证跨筛选游标被拒绝、本人列表稳定且空列表语义正确
- [x] 7.4 实现带 expectedVersion 的本人条目编辑和字段 policy，验证文本/可空备注/收藏状态规范化、并发旧版本最多一个成功且不修改共享汇总
- [x] 7.5 实现带 expectedVersion 的物理删除，验证条目立即从读取/列表消失、旧编辑或收藏命令不能复活、共享汇总和其他用户副本不变
- [x] 7.6 增加跨用户越权和自动扩散测试，验证猜测 item id 不能读写、汇总 READY 不自动写入任何用户的单词本或私人笔记

## 8. API、隐私与维护

- [x] 8.1 增加会后关键词同意、汇总和单词本 DTO/controller/presenter，重新生成 `openapi/openapi.yaml` 并验证请求默认值、状态枚举、错误码、游标和版本字段与运行时一致
- [x] 8.2 扩展日志/trace/异常脱敏和禁止内容字段规则，验证 audio、transcript、candidate text、final item text、personal note 和 provider response 不进入诊断输出
- [x] 8.3 增加终态 job、过期命令和孤立临时键的维护操作，验证维护任务不删除 READY 汇总、个人单词本、案件、审计或同意事实
- [x] 8.4 更新模块公开入口和依赖规则，验证 rooms、speech-safety、post-room-learning 和 worker 之间只通过公开 application/domain port 交互且无循环依赖

## 9. 验证与验收

- [x] 9.1 完成开关、目的同意、单次 STT 扇出、候选隐私、汇总状态机、权限、幂等、并发和单词本 CRUD 的 unit/integration/e2e 测试，并验证所有目标测试通过
- [x] 9.2 在真实 PostgreSQL 与 Redis 上运行独立 worker runtime 测试，验证双目的单次转写、fencing、重启恢复、consumer 隔离、shutdown 和内容清理
- [x] 9.3 运行 format、Prisma validate/generate、OpenAPI drift、依赖边界、build、完整 unit/integration/e2e/runtime、`git diff --check` 和 OpenSpec strict validation，并记录命令、数量与结果
- [x] 9.4 编写 `docs/acceptance/implement-post-room-keywords-vocabulary-backend.md`，验证分别记录本地实现、隐私检查、迁移/回滚、真实环境证明和所有 BLOCKED 项
- [ ] 9.5 使用真实 LiveKit Cloud 与合格流式 STT provider 完成双人房间 smoke，验证关键词-only 与双开房间只进行一次 STT、结束后匿名汇总、参与者权限、撤回停止、provider/Redis 失败降级和无完整转写；缺少凭据时记录 BLOCKED、保持本任务未完成并且不归档 change
