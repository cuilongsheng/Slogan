## Why

当前真人语音房没有敏感表达识别、房主风险提醒或安全能力降级记录，房主只能在事后依赖人工举报。V1 需要在不录音、不保存完整转写、不自动处罚的前提下，为明确启用该能力的房间提供可降级、可审计的临时语音安全辅助。

## What Changes

- 为房间增加创建时明确选择且之后不可变的敏感语音识别开关；未提交该字段的现有客户端保持关闭。
- 为启用该能力的房间增加独立的房间语音处理同意目的和版本校验；未同意者不能加入，撤回同意会停止其后续处理并终止其在该房间的实时访问，但不形成安全处罚。
- 增加与 API 代码共享领域模型、但以独立进程运行的房间语音处理 worker，通过可替换媒体源和流式 STT 端口临时处理已同意成员的音频。
- 增加版本化的风险规则、去重和限频，只向当前房主发送最小风险提醒；提醒不包含原始音频或完整转写，且不会自动踢人、建案、限制或禁用账号。
- 保存允许的最小风险事件和安全能力降级事件，供安全员查询并在相关案件证据包中引用；明确缺失信号不等于安全结论。
- STT、worker、提醒投递或协调故障时保持 LiveKit 真人语音、房间状态和成员关系可用，并记录不含内容的降级事实。
- 扩展 OpenAPI、PostgreSQL 迁移、清理策略、观测信息和本地验证；真实 LiveKit Cloud 与流式 STT provider smoke 需要对应凭据和测试环境，不能由本地替代。

### Confirmed Scope

- 即时房间以及使用同一房间实体的预约房间均可在创建时选择是否启用。
- 只处理启用房间内当前已同意成员的实时麦克风音频。
- 风险事件只保留最小类别、主体、时间、规则版本、来源和处理状态，不保存命中原文。

### Non-goals

- 不录制房间，不提供回放或完整转写。
- 不做说话内容搜索、用户画像、模型训练、情绪评分或公开风险排行榜。
- 不根据关键词或模型结果自动处罚、自动结案或自动移除成员。
- 不在本 change 中开发前端界面、客户端音频处理或新的后台管理前端。

### Roadmap Items

- 多语言风险模型评估、人工标注平台和规则运营界面在获得独立 OpenSpec 批准后再建设。
- 匿名会后关键词与个人单词本由后续独立 change 负责，不能复用安全风险事件还原内容。

### Unresolved Decisions

- 无。具体 provider 与 LiveKit 媒体接入包在实现时通过端口适配，但必须满足本 change 的隐私、保留和故障边界。

## Capabilities

### New Capabilities

- `room-sensitive-speech-detection`: 定义房间启用、入房同意、临时流式识别、仅房主风险提醒、最小事件、降级查询和禁止自动处罚的完整行为。

### Modified Capabilities

- `instant-room-discovery`: 房间创建、列表、详情和加入资格增加敏感语音识别开关与同意门禁。
- `temporary-speech-processing`: 扩展目的级同意、流式 STT、数据最小化、provider 政策和故障隔离，使其覆盖房间级临时处理。
- `voice-session`: 在保持无录音和无完整转写的前提下，允许明确启用的房间执行临时敏感表达识别。
- `safety-case-management`: 案件证据包可以组合相关的最小风险事件和安全能力降级事件，同时明确这些信号只能辅助人工复核。

## Impact

- `apps/api/prisma/`：房间开关、语音处理目的、最小风险事件、降级事件和可靠提醒投递所需迁移。
- `apps/api/src/modules/rooms/`、`voice/`、`safety/`、`backoffice/`：创建与加入门禁、当前房主解析、风险查询、证据组合和角色授权。
- `apps/api/src/infrastructure/stt/`、`livekit/`、`redis/`：流式 STT、媒体订阅、去重限频、worker 协调与降级。
- `apps/api/src/workers/`：独立启动的房间语音处理进程；不新增对外微服务或第二份 API 合同。
- `openapi/openapi.yaml`：房间配置/详情、同意管理和安全员降级查询合同。
- 外部依赖：LiveKit Cloud 媒体连接、符合最长七天政策的流式 STT provider、PostgreSQL 和 Redis。
- 依赖边界：本 change 复用已归档的 AI/STT 隐私基础；真实端到端验收依赖 `implement-livekit-voice-session-backend` 的 Cloud smoke 环境。
