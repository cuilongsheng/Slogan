## Why

当前后端已经具备真人语音房、成员资格和安全限制，但用户卡壳时仍没有可主动调用的表达辅助，后续敏感词识别和会后关键词也缺少统一的临时语音处理边界。先建立按需 AI 表达与可替换 STT 基础，可以在不录音、不阻塞真人语音的前提下补齐 V1 的 AI 入口，并为后续房间级临时识别提供可复用的同意、额度和数据删除规则。

## What Changes

- 新增房间内按需表达辅助：当前有效成员可以提交母语文字，获得结合房间主题与本人 CEFR 的简短英语表达、最多两个替代表达和语气说明。
- 新增用户主动触发的母语短语音输入：服务端接收有上限的临时音频，经 STT 得到仅供本次请求使用的文本，再调用表达生成；音频和完整转写不写入持久化存储。
- 新增语音处理同意记录：短语音请求要求当前有效的处理同意以及本次处理提示确认；用户可以查看并撤回未来处理同意，撤回不伪造删除已经完成的最小审计事实。
- 新增可替换的 AI 与 STT provider 边界、启用配置和稳定失败语义。超时、供应商不可用、额度耗尽或 STT 失败时返回可重试/改用文字输入的结果，不影响既有房间和真人语音。
- 新增请求幂等、每用户频率限制、每日额度和平台级预算闸门。同一用户以相同 UUID 重放已经完成的相同请求不会再次扣减额度或重新生成结果，改变内容复用标识会冲突；外部调用结果不确定时保留可诊断状态而不承诺供应商侧恰好一次执行。
- 只持久化请求状态、输入摘要、大小/时长、provider 类别、用量、错误类型、同意版本和短期私有输出；不记录原始文字、原始音频、完整转写、provider 密钥或完整 provider 响应。短期输出到期后由可恢复清理任务删除。
- 扩展 NestJS code-first OpenAPI、Prisma 迁移、日志脱敏、provider contract tests、真实 provider smoke 入口和自动化验收证据。

### Confirmed Scope

- V1 表达辅助只服务于当前 `OPEN` 房间中的有效成员，目标语言固定为英语；房间主题和用户 CEFR 由服务端读取，客户端不能伪造。
- 文字和短语音都必须由用户主动发起。输出只返回给请求用户，不自动播放、不发送给其他成员，也不作为实时字幕。
- 短语音采用有大小、类型和处理时限的直接上传；服务端与 provider 之间只传递完成本次请求所需的数据，不建立房间录音或可回放对象。
- PostgreSQL 保存幂等、同意、用量和最小状态事实；Redis 只用于跨实例短期频率/并发协调，Redis 或 provider 故障不能中断既有房间。
- 默认优先在处理完成后立即释放音频和转写；任何临时 provider 数据不得超过一周。短期私有输出仅为结果重放保留，并有明确过期时间和清理证据。

### Non-goals

- 不订阅或识别房间持续音频流，不实现敏感词、高风险表达提醒或安全员降级事件；这些进入后续房间安全识别 change。
- 不生成会后关键词、房间摘要或个人单词本，也不把结果自动写入私人笔记。
- 不实现 AI 自动主持、全程纠错、实时字幕、语音合成、自动播放、代替用户发言或向其他成员分享输出。
- 不实现移动端录音/UI、生产部署、供应商采购或隐私政策发布。
- 不长期保存原始输入、完整转写或默认创建可浏览的 AI 历史记录。

### Future Roadmap

- `implement-room-sensitive-speech-detection-backend` 复用临时语音处理、同意和 STT provider 边界，增加只提醒房主的房间级风险信号与安全能力降级事件。
- `implement-post-room-keywords-vocabulary-backend` 复用临时识别结果生成匿名房间关键词，并增加用户选择加入、编辑、删除和收藏单词本的闭环。
- 运营与数据治理 change 汇总 AI/STT 成本、额度、异常告警和生产保留/删除证明，不扩大本 change 的内容保存范围。

### Unresolved Decisions

- 最终生产 AI/STT 供应商、区域、跨境传输和供应商侧删除证明仍需平台配置与隐私评审。本 change 提供可替换 adapter 和真实 smoke 入口，但不能把无凭据的本地测试记作真实 provider 验收。
- 正式公测的用户日额度、平台预算和短期私有输出保留时长仍需运营确认；本 change 使用可校验配置和保守默认值，不把默认值写成永久产品承诺。

## Capabilities

### New Capabilities

- `ai-expression-assistance`: 房间内按需文字/短语音表达辅助、成员资格、私有输出、幂等、额度和失败降级。
- `temporary-speech-processing`: 临时音频处理同意、STT provider 边界、数据最小化、删除期限和故障隔离。

### Modified Capabilities

无。

## Impacted delivery stages

- Architecture
- Backend / API
- Test / Acceptance

## Impact

- `apps/api/prisma/`：新增表达请求、语音处理同意、用量/额度和清理状态的枚举、模型、约束、索引及只向前迁移。
- `apps/api/src/modules/assistance/`：新增表达辅助 application/domain、HTTP DTO/controller、Prisma repository、幂等和额度协调。
- `apps/api/src/infrastructure/ai/` 与 `apps/api/src/infrastructure/stt/`：新增可配置 provider adapter、超时、错误归一化和测试替身；业务模块只依赖 port。
- `apps/api/src/modules/rooms/`：通过公开 application 边界读取当前房间、membership、主题和 CEFR 上下文，不改变现有加入或真人语音流程。
- `apps/api/src/infrastructure/redis/` 与清理 worker：增加分布式频率/并发限制和可恢复的短期输出清理调度；PostgreSQL 保持持久事实来源。
- `apps/api/src/config/`、日志脱敏和 `openapi/openapi.yaml`：增加启用开关、provider/额度/保留配置、multipart 合同和稳定错误码。
- 本地自动化使用 fake provider；真实 AI/STT smoke 依赖用户提供的启用配置和凭据，并单独记录是否执行。
