## Context

见 `proposal.md` 的动机。当前 API 是 NestJS modular monolith，PostgreSQL 保存持久事实，Redis 只承担临时协调；`openapi/openapi.yaml` 由 NestJS code-first 生成，是唯一 API contract。现有独立 room-speech worker 已能通过 LiveKit 隐藏参与者订阅启用房间的音轨、按短窗口调用可替换 STT，并在处理后清除音频和完整转写，但编排目前由 `speech-safety` 模块拥有，只发现 `sensitiveSpeechDetectionEnabled=true` 的房间。

会后关键词不能从安全风险事件恢复，因为风险事件不含原文且目的不同。它需要在完整转写仍处于单个进程内存时提取匿名候选，同时保证安全分类和学习候选任何一方失败都不破坏另一方，也不让完整转写进入 PostgreSQL、Redis、队列或日志。最终房间汇总和用户主动保存的单词本是允许的持久事实。

## Goals / Non-Goals

**Goals:**

- 把媒体订阅、STT、同意 generation 校验和内容清理提升为中立的房间语音处理编排，使安全识别与会后关键词共享一次短窗口转写但保持各自领域事实隔离。
- 用有界、无成员归属、无语序的临时聚合支持结束后可恢复且幂等的汇总生成。
- 以服务端参与资格和 userId 所有权保护汇总与单词本 API，并为创建、编辑、收藏和删除提供稳定并发结果。
- 保持旧客户端、旧房间和仅安全识别房间兼容；所有新能力默认关闭。

**Non-Goals:**

- 不引入第二个持续音频订阅者、第二次 STT 调用或新的外部 AI 生成 provider。
- 不让房间汇总承担私人笔记、逐句字幕、完整摘要、词典或安全证据职责。
- 不为前端预建 view model，也不改变现有 UI 或移动端流程。

## Decisions

### 1. 新增独立开关和独立同意目的

Room 增加 `postRoomKeywordsEnabled Boolean @default(false)`，即时和预约创建 DTO 都可明确提交，列表、详情、分享解析与预约详情统一返回。数据库触发器与 domain policy 同时阻止创建后修改。创建启用房间需要 `POST_ROOM_KEYWORDS_ENABLED=true` 且共享 room-speech worker readiness 有效；关闭能力的房间不受依赖状态影响。

`SpeechProcessingPurpose` 增加 `POST_ROOM_KEYWORDS`，配套独立 notice version。加入、reserve/confirm、token 续期和 worker 处理分别计算房间所需目的集合：安全开关需要 `ROOM_SAFETY_DETECTION`，关键词开关需要 `POST_ROOM_KEYWORDS`，两个都开时必须同时满足。每个目的保留独立 consent generation；STT 前后任一所需 generation 改变都丢弃窗口并释放内容。撤回通过现有事务模式使相关启用房间的 issuance 失效、写可靠 `REVOKE_IDENTITY` 命令并断开成员，不生成安全事实。

选择独立开关与目的，而不是复用安全开关，是为了满足目的限制和用户说明准确性。选择创建时不可变，而不是会话中动态切换，是为了让所有成员在加入前看到稳定处理条件。

### 2. 中立编排只在内存中扇出完整转写

新增 `room-speech-processing` application 边界，接管 room discovery、参与者目的上下文、一次 STT session、generation 二次校验和最终字符串清空。现有 worker 与媒体源继续独立进程运行；它对启用任一房间语音目的的 OPEN 房间获取同一 fencing lease。

一次成功转写通过进程内同步 consumer 接口扇出：

1. `speech-safety` consumer 执行版本化风险规则，只保存既有最小风险/降级事实；
2. `post-room-learning` consumer 提取匿名候选，只提交 roomId、候选类型、规范化文本、计数和 extractor version。

consumer 不能持有原始音频，也不能把完整转写返回给异步队列。编排使用独立副本或只读值调用 consumer，在全部 consumer 完成或失败后立即覆盖引用；单个 consumer 失败只记录其自身能力降级，不取消另一个已允许目的。这样避免两个隐藏参与者和双倍 STT 成本，也避免让 `speech-safety` 拥有学习内容。

备选方案是再建一个关键词 worker 并单独订阅/转写。该方案边界直观，但会重复发送成员音频、增加成本和撤回竞态，因此不采用。

### 3. 确定性候选提取先于外部生成模型

V1 使用版本化的本地候选提取 policy：统一 Unicode/大小写和标点，过滤停用词、明显联系方式和不安全长度，提取一至三词关键词及受控长度的常用短表达，并对每个窗口和房间设置候选数量上限。最终按频次、房间主题相关度、类型和规范化文本稳定排序，截取有界结果。

候选提取不接收 userId、membershipId 或 participant identity。当前需求只要求轻量关键词与常用表达，确定性方案可离线测试、无新增内容供应商，并减少完整转写再次外发。未来若要引入模型释义或总结，需要独立 change、provider 数据政策和新的验收证据。

### 4. Redis 只保存有 TTL 的匿名候选工作集

每个房间使用由当前 fencing token 保护的临时候选集合，键值只包含规范化候选、类型、聚合计数和 extractor version，不包含说话者、窗口时间、逐句顺序或完整转写。单个关键词和短表达分别设置字符数、token 数和总条目上限；TTL 覆盖预计房间结束时间和有限结束后重试窗口。

旧 fencing token 不能增加、读取最终化所需快照或删除新持有者工作集。Redis 不可用时停止新的关键词候选处理并写不含内容的目的级降级状态，真人语音与安全 consumer 继续运行。最终化成功、确认不可用、超时或维护清理都会删除临时键。

选择 Redis 而不是 PostgreSQL 保存候选，是因为候选仍是处理中的临时内容，不应成为长期持久事实。选择匿名计数而不是保存窗口文本，可以在 worker 重启后保留有限进度，同时降低恢复完整对话的可能性。

### 5. PostgreSQL 保存汇总状态、最终条目和可恢复任务

新增模型：

- `RoomKeywordSummary`：每房间至多一行，保存 `COLLECTING | PENDING | READY | UNAVAILABLE`、topic snapshot、extractor version、生成/失败时间、归一化失败类别和版本；关闭能力的房间不建行，API 派生 `DISABLED`。
- `RoomKeywordSummaryItem`：保存 `KEYWORD | EXPRESSION`、显示文本、规范化文本和稳定 rank；唯一约束阻止同汇总重复规范化条目，不保存 speaker 或时间线。
- `RoomKeywordSummaryJob`：每房间一个持久任务，包含 `PENDING | RUNNING | COMPLETED | FAILED`、attempt、nextAttemptAt、leaseId/lockedUntil 和截止时间，支持 `FOR UPDATE SKIP LOCKED` 领取与过期 lease 恢复。

启用房间创建时建立 `COLLECTING` 汇总行。房间进入 `ENDING/ENDED` 的同一数据库事务把它推进到 `PENDING` 并 upsert job；重复结束事件只命中同一行。runner 领取 job 后以有效 lease 和 room fencing 边界读取匿名候选快照，在一个事务内写最终 items、更新 `READY` 并完成 job。无足够候选、候选已过期或达到重试截止时更新 `UNAVAILABLE`。提交后再按 compare-and-delete 清理 Redis；清理重试不得改写 READY 内容。

### 6. 参与事实保护共享汇总读取

`GET /v1/rooms/{roomId}/keyword-summary` 从当前身份派生 userId，要求房间为 `ENDING/ENDED` 且存在该用户实际 RoomMembership。`LEFT`、`REMOVED` 或房主变化不抹去已发生参与；RoomReservation 和 RoomInvitation 不满足资格。返回统一 envelope：`DISABLED | PENDING | READY | UNAVAILABLE`，只有 READY 携带按 rank 排序的 items。无关系访问返回不泄露资源存在性的稳定拒绝。

该资格复用 room-history 的“实际 membership”语义，但通过公开 application port 读取，不深层导入 rooms repository。

### 7. 单词本是用户私有副本并使用显式版本

新增 `VocabularyItem`：userId、kind、displayText、normalizedText、note、favorite、version、sourceSummaryItemId、createdAt、updatedAt。`sourceSummaryItemId` 只用于授权和来源幂等，不在列表中暴露房间成员信息；唯一 `(userId, sourceSummaryItemId)` 防止同一来源重复导入。

新增 `VocabularyCommand` 保存 userId、clientRequestId、action、payloadHash、resultItemId 和时间；`POST /v1/me/vocabulary-items` 在事务内校验汇总访问、写命令与条目，相同 UUID/载荷返回原结果，改变载荷冲突。GET 使用 `(updatedAt,id)` keyset cursor，并把 favorite/kind 写入 cursor 后校验，防止跨筛选复用。

`PUT /v1/me/vocabulary-items/{itemId}` 接受 `expectedVersion`、显示文本、可空个人备注和 favorite，使用 userId + id + version 条件更新。`DELETE /v1/me/vocabulary-items/{itemId}` 接受 `expectedVersion`，物理删除私有条目；删除后旧命令因记录不存在而不能恢复。所有 endpoint 只使用当前身份，不接受目标 userId。

选择复制为用户私有条目，而不是让单词本引用并直接展示共享 item，是为了让用户编辑/删除不改写房间汇总，也让未来汇总保留策略与个人学习资料解耦。

### 8. API 与稳定错误

继续使用 NestJS code-first Swagger 生成 `openapi/openapi.yaml`，不维护第二份合同。主要接口：

- `PUT /v1/me/speech-processing-consents/post-room-keywords`
- `GET /v1/rooms/{roomId}/keyword-summary`
- `POST /v1/me/vocabulary-items`
- `GET /v1/me/vocabulary-items`
- `PUT /v1/me/vocabulary-items/{itemId}`
- `DELETE /v1/me/vocabulary-items/{itemId}`

房间创建、列表、详情、分享和预约响应增加 `postRoomKeywordsEnabled`。稳定业务错误至少覆盖 `POST_ROOM_KEYWORDS_UNAVAILABLE`、`POST_ROOM_KEYWORDS_CONSENT_REQUIRED`、`VOCABULARY_VERSION_CONFLICT`、`IDEMPOTENCY_KEY_REUSED` 和通用 validation/authorization 结果。汇总的正常 PENDING/UNAVAILABLE 使用成功响应中的状态，不把可预期生成结果伪装成 HTTP 故障。

### 9. 可观察性与保留边界

日志和 span 只记录 roomId、阶段、目的、provider 类别、窗口字节数、候选计数、job 状态、耗时和归一化错误，不记录 audio、transcript、candidate text、最终 item text、note 或完整 provider 响应。候选内容也不得进入异常 message、fixture snapshot 或队列载荷。

最终汇总与用户主动保存的单词本属于 V1 允许持久事实，不适用临时 STT 最长七天期限；具体长期保留由后续数据治理 change 决定。用户删除单词本条目立即移除该私有副本，不删除共享汇总。维护任务清理过期临时键、终态 job 技术记录和孤立命令记录，但不在未批准保留政策前删除 READY 汇总。

## Risks / Trade-offs

- [Risk] 确定性 n-gram 提取质量低于专用语言模型 → 用版本化 fixture、停用词、长度/PII 过滤和最小质量门槛保证可解释基线；质量不足返回 UNAVAILABLE，不编造内容。
- [Risk] Redis 故障或 TTL 到期导致无法生成汇总 → runner 使用有界重试，最终明确 UNAVAILABLE；房间结束和真人语音不等待生成。
- [Risk] 同一转写扇出增加内容在内存中的生命周期 → consumer 必须同步、有超时且不能排队完整文本；编排在全部 consumer 收敛后立即清空引用并测试成功/失败/shutdown 路径。
- [Risk] 两个处理目的的 consent generation 组合产生竞态 → STT 前后读取同一目的集合并逐项比较；任何 required purpose 变化都丢弃窗口并触发访问收敛。
- [Risk] 最终汇总可能包含联系方式或私人片段 → 窗口提取和最终化执行两次过滤，严格限制 token/字符长度，不保存失败原文；真实 smoke 仍需人工检查输出。
- [Trade-off] 同一词从不同房间选择会形成不同私有条目 → V1 只对同一来源幂等，避免编辑后的全局文本唯一约束产生冲突；跨来源合并留给后续单词本增强。
- [Trade-off] 关键词房间依赖当前尚未完成 Cloud smoke 的语音 worker → 本地实现和 fake/runtime 验证可以完成，但真实 Cloud/provider task 必须保持未完成，且按用户最新要求不得归档。

## Migration Plan

1. 添加 `POST_ROOM_KEYWORDS`、汇总/任务/单词本枚举与表，以及 Room 默认 false 列和不可变触发器；用包含历史 Room 的迁移测试证明旧行保持 false。
2. 部署兼容旧请求的 API 与 worker 代码，保持 `POST_ROOM_KEYWORDS_ENABLED=false`；先生成并校验 OpenAPI、运行空库升级和现有迁移链。
3. 启动 worker 并验证 PostgreSQL、Redis、LiveKit/STT readiness、fencing、临时清理和旧安全识别回归；随后才允许创建启用关键词的新房间。
4. 用真实 LiveKit Cloud 与合格 STT provider 完成双人房间 smoke 后记录环境与结果，再决定生产启用；没有凭据时任务保持 BLOCKED 且 change 保持 active。

回滚按先关闭新建、再停止处理、最后回退应用的顺序执行：关闭 `POST_ROOM_KEYWORDS_ENABLED`，拒绝新的 enabled 房间，等待或把已结束 job 收敛为 UNAVAILABLE，停止新 consumer，再回退应用。新增列/表和已经生成的匿名汇总/用户单词本保持不删，使旧二进制可以忽略附加 schema，也避免紧急回滚破坏用户主动保存内容；Redis 临时键由 TTL 与维护命令清理。只有后续独立数据迁移获批后才物理删除 schema 或持久内容。

## Verification Evidence

- Migration：历史 Room 默认值、触发器不可变、空库完整迁移链、Prisma validate/generate。
- Unit：目的集合与 generation、候选规范化/PII/长度/排序、无成员归属、summary 状态机、单词本 policy、cursor 和幂等 hash。
- Integration：真实 PostgreSQL/Redis 的 fencing、临时候选 TTL、重复结束、stale lease、READY 原子提交、UNAVAILABLE 收敛、删除清理和并发版本。
- E2E：即时/预约开关、同意隔离、加入/续期/撤回、参与者权限、汇总状态、单词本 CRUD/筛选/幂等和越权。
- Runtime：独立 worker 用 fake media/STT 执行双目的单次转写、一个 consumer 失败不影响另一个、重启恢复、shutdown 内容清理和内存/Redis/日志无完整转写。
- Contract/structure：OpenAPI 生成 diff、format、build、依赖边界、完整 affected-scope tests、change/main specs strict validation。
- External：真实 LiveKit Cloud + 合格 STT provider 的双人会话、结束生成、撤回、故障降级和内容检查；未执行时明确 BLOCKED，不能标为 PASS 或归档。
