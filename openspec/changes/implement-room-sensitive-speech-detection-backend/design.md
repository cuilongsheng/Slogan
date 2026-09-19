## Context

参见 [proposal.md](./proposal.md) 的动机。本仓库当前由一个 NestJS 模块化单体、PostgreSQL、Redis/BullMQ 和 LiveKit 控制面组成；现有 livekit-server-sdk 适配器负责房间、token 和房主管理，但 API 进程不订阅音轨。已归档的 AI/STT 基础只处理用户主动上传的短音频，并已建立目的级同意、provider 政策、无内容日志和请求内临时处理边界。

本 change 同时影响房间创建/加入、实时媒体、STT、安全证据和后台查询，属于 Level 2 安全与架构变更。openapi/openapi.yaml 继续是唯一公开合同，并沿用 NestJS 装饰器生成后提交该文件的 code-first 流程。真实 LiveKit Cloud 和流式 STT 验收依赖外部凭据，本地替身不能作为生产连通证明。

## Goals / Non-Goals

**Goals:**

- 在不阻塞 API 请求线程的情况下持续订阅明确启用房间的已同意成员音轨。
- 让同意、加入、token 签发、媒体订阅和撤回在失败与并发下收敛到同一隐私边界。
- 只把临时转写转化为版本化、去重后的最小风险事实，并只提醒发送时的当前房主。
- 让 worker、provider 或协调故障对真人语音安全降级，同时向有权限的后台角色暴露无内容的降级事实。
- 保持现有模块化单体、单一数据库和单一 OpenAPI 合同，不增加新的对外微服务。

**Non-Goals:**

- 训练或评估通用内容审核模型、保存语料、逐字回看或提供房间转写。
- 让媒体 worker 拥有案件处置、限制、账号禁用或房主管理权限。
- 用本 change 完成客户端 UI、后台 UI、会后关键词或个人单词本。

## Decisions

### 1. 在 apps/api 内增加可独立启动的媒体 worker 入口

新增 worker bootstrap 和组合根，复用 voice、rooms、safety 的领域合同及同一 Prisma schema，但以独立进程部署和扩缩容。API 进程只处理 HTTP、持久命令和公开合同，不接收持续音频。worker 以服务参与者加入 LiveKit 房间，使用不能发布麦克风、不能执行房主管理的最小权限，只订阅音频；服务参与者不创建应用 membership、不计房间容量，也不出现在产品成员列表。

worker 周期扫描“开放且启用”的房间并用 Redis 取得带 fencing token 的房间租约。同一房间任一时刻只有一个有效 worker；租约失效的旧 worker必须关闭 provider stream 并离开房间。房间结束、开关关闭（本设计不允许创建后关闭）、无成员或进程停止都会清理会话。Redis 不可用时不启动新处理，已有无法安全续租的会话停止处理并记录降级，真人语音继续。

**替代方案：**

- 在 HTTP API 进程内订阅音轨：部署、内存和重启生命周期会互相影响，拒绝。
- 新建独立仓库或拥有独立数据库的微服务：会引入第二套权限和数据一致性边界，当前规模不需要，拒绝。
- 把音频块放入 BullMQ：会在 Redis/队列中持久化原始内容，违反规格，拒绝。

### 2. 通过媒体源和流式 STT 端口隔离 provider

领域层定义房间媒体源、流式 STT session、风险规则和提醒发布端口。LiveKit 适配器只输出内存中的短 PCM/编码窗口；STT 适配器只接收当前窗口、语言提示、短期不可反推身份的关联标识和受控参数。provider 配置复用现有区域、用途、删除能力和最长七天保留政策，并新增“支持流式/短窗口”和安全端点健康检查；缺少任一政策字段时 worker fail closed，房间语音 fail open。

provider 实现可更换，领域和公开 API 不暴露 provider 名称，只暴露受控类别。音频窗口、完整转写和命中片段只存在于 worker 内存作用域，任何异常路径都在 finally 中清理引用；日志、span、异常、队列和数据库 DTO 都使用无内容类型，防止误序列化。

**替代方案：**

- 复用短音频 HTTP 上传适配器模拟流式：延迟、背压和取消语义不匹配，拒绝。
- 把完整转写交给后续异步规则任务：必须持久化内容或在进程间传递，拒绝。

### 3. 房间开关创建时写定，默认关闭

Room 增加非空布尔字段 sensitiveSpeechDetectionEnabled，默认 false。即时房间和预约房间创建合同都可明确提交；历史行和未提交字段的客户端均为 false。列表、详情、分享解析和预约详情返回该字段，使用户在加入前可以判断处理条件。更新房间接口不暴露该字段，避免处理目的在已加入成员不知情时变化。

第一阶段不允许创建时设置 true，直到数据库迁移、worker、provider 政策配置和加入门禁全部部署并通过健康检查；随后由服务配置逐步放量。此运维开关不改变房间持久意图，只控制是否接受新的启用房间。

**替代方案：**

- 房主在会中随时开关：需要全员重新确认与重连，边界复杂且容易绕过同意，拒绝。
- 默认启用：破坏现有客户端兼容和明确同意，拒绝。

### 4. 新增独立的房间安全语音同意目的

现有 SpeechProcessingPurpose 增加 ROOM_SAFETY_DETECTION，与 AI_EXPRESSION_AUDIO 使用不同说明版本和 provider 类别。现有状态查询返回两个目的；新增 PUT /v1/me/speech-processing-consents/room-safety 接受或撤回，沿用 UUID 幂等命令和最小审计事实。一个目的的状态不能授权另一个目的。

启用房间的加入事务在创建 membership 和签发实时凭证前读取当前有效同意；token 续期也重复校验。撤回在同一数据库事务中保存 consent event、使该用户在启用房间的有效 realtime issuance 失效，并写入既有 realtime command/outbox。runner 将用户从这些房间断开并以 CONSENT_WITHDRAWN 收敛 membership；该原因不进入安全案件、限制或处罚统计。worker 在订阅新音轨前再次读取同意，并对活跃轨道接收撤回通知；即使 runner 延迟，也先停止向 provider 发送后续窗口。

**替代方案：**

- 仅在客户端隐藏加入按钮：可以绕过，拒绝。
- 撤回后允许成员继续说话但不处理：启用房间会出现不满足共同处理条件的参与者，拒绝。
- 把断开记为房主移除或安全处罚：扭曲审计语义，拒绝。

### 5. 使用版本化确定性规则生成最小风险事件

STT 的临时分段先在内存中规范化，再交给版本化规则集。第一版规则类别与安全业务对齐：HARASSMENT_ABUSE、HATE_DISCRIMINATION、SEXUAL_CONTENT、THREAT_VIOLENCE、SPAM_ADVERTISING 和 OTHER_SAFETY_RISK；严重度只使用 LOW、MEDIUM、HIGH 档位。规则集以不可变版本标识发布，回滚通过切换活动版本完成。

Redis 使用 roomId、subjectUserId、category、ruleSetVersion 和 bucket 的摘要键做短窗口去重和令牌桶限频；键中不包含文本。PostgreSQL 的 RoomSpeechRiskEvent 只保存房间、主体用户、类别、严重度、规则版本、首次/最后时间、聚合次数、不可逆关联摘要和生命周期时间。不存在逐句“未命中”记录；命中原文、完整转写、置信原始向量和 provider 原始响应都不保存。Redis 不可用时停止新判断并记录降级，而不是绕过去重后洪泛提醒。

风险事件只是可查看事实，不调用案件、restriction、账号或 host-control command。房主后续移除或举报继续走现有独立 API、权限和审计。

**替代方案：**

- 直接保存命中短语供房主判断：仍会形成可搜索语料且超出最小化边界，拒绝。
- 自动踢出高严重度成员：误报会直接造成处罚，违反人工决定边界，拒绝。

### 6. 使用持久最小 outbox 和 LiveKit 定向数据包提醒当前房主

风险事件与 RoomSpeechAlertDelivery 在同一事务写入。delivery 只引用事件并保存状态、尝试次数、下次尝试时间、租约和过期时间，不复制语音内容。投递 runner 每次发送前从 PostgreSQL 读取当前房主和其当前 realtime identity，再通过服务端 LiveKit 定向 data packet 发送；从不信任创建事件时缓存的房主。接任后旧目标租约失效。

投递期限默认十分钟且不超过房间结束时间。失败按有界退避重试，过期后记为未送达；不会广播给其他成员。为处理离线和 data packet 非持久语义，增加 GET /v1/rooms/{roomId}/safety-alerts，仅当前房主可按游标读取仍在保留期内的最小提醒。提醒保留时间与安全风险事实政策一致，但响应仍不包含内容。

**替代方案：**

- 只发 data packet：离线或重连会静默丢失，拒绝。
- 向所有成员广播：违反“只提醒房主”，拒绝。
- 投递时固定原房主：接任后泄露，拒绝。

### 7. 合并连续降级事件并提供后台只读查询

SafetyCapabilityIncident 保存组件、归一化错误类别、provider 类别、可选房间、开始/最后观察/恢复时间、影响窗口数和状态。组件取值为 MEDIA_SUBSCRIPTION、STREAMING_STT、RISK_RULES、COORDINATION、HOST_ALERT_DELIVERY。相同组件、房间和错误类别的连续失败通过唯一活动键合并，恢复健康时关闭事件；不保存异常原文、provider 响应或任何语音内容。

新增 GET /v1/backoffice/safety-capability-incidents，允许当前 SAFETY_OFFICER、PLATFORM_ADMIN 和 AUDITOR 以带过滤条件的 keyset cursor 查询。它是诊断与案件上下文，不提供处置动作。OPERATIONS_ANALYST 若未同时持有上述角色不可读取逐房间事件；未来只可通过独立批准的聚合指标能力查看匿名统计。

案件证据仓库按举报房间和受控时间窗口加入风险事件、降级事件或明确的不可用标记。查询失败不能伪装为空集合；证据包返回 signalAvailability 使安全员区分“无命中”“能力降级”和“尚未启用”。

### 8. 生命周期、资源和背压边界

每个房间、参与者和 provider session 均设置最大并发窗口、窗口字节/时长、静音超时和总缓冲上限。超过上限时丢弃最旧的未发送窗口并记录聚合降级，不把压力传回 LiveKit 音频发布链路。房间结束、成员离开、同意撤回、worker fencing 失效或 shutdown signal 都必须先取消 provider stream，再释放缓冲并离开媒体房间。

worker 健康分为 live 与 ready：进程活着但 Redis、PostgreSQL、LiveKit 或 provider 政策不合格时不 ready、不接新租约。API readiness 不依赖 worker 或 STT，以保证真人语音和其他业务可用；创建启用房间还受独立能力开关约束。

### 9. OpenAPI 与错误合同

继续由 NestJS DTO/controller 装饰器生成唯一 openapi/openapi.yaml。公开变更包括：

- 即时/预约房间创建请求的 sensitiveSpeechDetectionEnabled，以及房间列表、详情、分享和预约响应的同名字段；
- 同意状态集合增加 ROOM_SAFETY_DETECTION，并增加房间安全同意命令路径；
- 未同意加入或续期使用稳定的 ROOM_SPEECH_CONSENT_REQUIRED；
- 当前房主最小提醒查询；
- 后台安全能力降级查询及过滤/游标合同。

LiveKit data packet 使用版本化内部 envelope，不成为第二份 HTTP API。未知 envelope 版本由客户端忽略。生成后必须验证 operationId、枚举、必填字段、错误码和敏感字段均与实现一致。

## Risks / Trade-offs

- **[误报使房主过度反应]** → 提醒标记为待人工核实，不显示命中原文，不自动操作；房主行为继续受既有权限和审计约束。
- **[撤回与音频窗口并发导致撤回后仍发送]** → 撤回事务发出高优先级停止命令，worker 在每个窗口发送前检查 consent generation；generation 变化后丢弃内存窗口并关闭 stream。
- **[两个 worker 重复订阅和提醒]** → Redis 租约使用 fencing token，数据库事件写入带摘要唯一约束，所有提交验证当前 token。
- **[LiveKit 隐藏参与者影响容量或 UI]** → 使用独立服务身份命名空间，不创建 membership，列表与容量只读应用持久状态；Cloud smoke 验证客户端不可见。
- **[短期关联摘要仍可跨事件关联]** → 每个房间/时间桶使用服务端轮换盐，事件仅保存不可逆摘要并按保留任务清理。
- **[provider 声明和实际删除行为不一致]** → 仅允许经配置批准的 provider；真实 smoke 记录区域、模式和删除/不留存证据，缺少证明时验收标记 BLOCKED。
- **[安全降级事件洪泛数据库]** → 连续故障合并、计数聚合、恢复闭合和按政策清理。
- **[启用房间在 worker 不健康时仍被创建]** → 创建时检查能力开关和聚合 readiness；运行中故障仍 fail open 保语音并产生降级事件。
- **[预约房间 change 尚未归档]** → 对共享 Room 字段做向后兼容迁移；实现时同时适配当前预约创建 DTO，避免等待主 spec 同步后才发现合同遗漏。
- **[真实媒体与 provider 环境缺失]** → 本地使用无内容的合成音频 fixture 验证状态机；Cloud/provider smoke 单列证据，凭据缺失时保持任务未完成或明确 BLOCKED，不用 mock 冒充。

## Migration Plan

1. 增加向后兼容枚举和表：Room.sensitiveSpeechDetectionEnabled 使用 false 默认值；新增风险、投递和降级表及索引。先在测试库执行 migration，再运行 Prisma generate 和结构/回滚检查。
2. 部署只读兼容代码、同意目的和 OpenAPI；能力开关保持关闭。旧客户端和历史房间行为不变。
3. 部署 worker 与 adapter，但 readiness 未通过时不接租约。使用合成音频和本地 LiveKit/替身验证无持久内容、租约 fencing、背压和清理。
4. 部署加入/续期门禁、撤回收敛、风险事件、当前房主提醒、后台查询和证据组合。运行完整 unit、integration、e2e、runtime、依赖与 OpenSpec 校验。
5. 在隔离环境使用 LiveKit Cloud 与合格流式 STT provider 执行真实 smoke：隐藏参与者、两人语音不受影响、只提醒当前房主、接任后不泄露给前任、撤回立即停止、provider 失败仅降级、无录音/完整转写持久化。
6. 证据通过后开启“允许创建启用房间”的配置并逐步放量；监控 worker readiness、事件延迟、降级率和提醒积压，不采集内容。

**Rollback：**

1. 关闭新房间启用开关，停止 worker 获取新租约。
2. 等待或强制取消现有 provider stream，确认所有内存缓冲释放；现有启用房间继续真人语音并记录能力停用降级。
3. 回滚 API/worker 代码到兼容版本。数据库布尔字段和新增表先保留，避免破坏历史行和旧二进制读取。
4. 清空不含内容的待投递 outbox，并按保留策略清理风险/降级事实。确认无需恢复后，后续维护窗口再执行独立批准的 destructive schema rollback；不得在紧急回滚中删除证据或审计事实。
5. 如果撤回收敛或隐私边界存在缺陷，优先停止所有房间音频处理；真人语音服务不随之下线。

## Verification Evidence

- **Contract**：生成并 diff openapi/openapi.yaml，验证兼容默认值、同意目的、房主/后台权限、分页游标和错误码。
- **Migration**：空库与含历史房间/同意数据的升级测试，默认关闭、唯一约束、索引和回滚演练。
- **Unit**：同意 generation、加入门禁、规则版本、去重限频、fencing、背压、角色矩阵、日志脱敏。
- **Integration**：PostgreSQL 原子写入、Redis 租约/故障、撤回 outbox、当前房主解析、案件证据的三态信号。
- **E2E**：关闭房间兼容、启用房间同意、撤回断开、只向当前房主查询、接任隔离、无自动处罚、后台降级访问。
- **Runtime**：真实 Redis/PostgreSQL 下运行独立 worker，验证 shutdown、恢复、重复投递和数据库/日志中无内容。
- **Cloud/provider**：真实 LiveKit Cloud 和合格流式 STT 的双人 smoke；凭据或平台配置缺失时记录 BLOCKED 及缺失项。
- **Device**：客户端接入前由受支持真机确认加入前同意、房主提醒、接任和重连；本 backend change 只准备合同，不能声称已完成设备验收。
