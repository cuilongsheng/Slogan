## Context

见 `proposal.md` 的 Why。现有 NestJS modular monolith 已有认证、资料、房间 membership、安全限制、PostgreSQL、Redis/BullMQ、结构化日志和 code-first OpenAPI，但没有 AI/STT provider、临时音频入口、同意事实或用量账本。`voice-session` 当前明确不录音且不启用持续房间 STT；本设计只增加用户主动发起的短请求，不改变 LiveKit 房间媒体路径。

## Goals / Non-Goals

**Goals:**

- 在不持久化原始文字、音频或完整转写的前提下提供可重试的文字/短语音表达辅助。
- 把房间资格、同意、额度、provider、超时、结果校验和清理分成可测试边界。
- 使用独立配置的可替换 AI/STT adapter，并让无凭据的本地测试通过 fake provider 完成。
- 保持 PostgreSQL 为请求、同意和用量事实来源；Redis 只负责短期频率、并发和清理调度。

**Non-Goals:**

- 不从 LiveKit 订阅房间音频，不建立录音、持续转写、敏感词或会后关键词流水线。
- 不提供 AI 历史列表、音频回放、转写读取、语音合成或向房间广播结果。
- 不把供应商采购、跨境法律判断或隐私政策发布伪装为代码已解决的问题。

## Decisions

### 1. `assistance` 模块拥有业务流程，provider 保持端口隔离

新增 `modules/assistance`，由它拥有表达请求、同意、额度、幂等和 HTTP 合同。domain ports 定义 `ExpressionGenerator`、`SpeechTranscriber`、repository、短期协调和清理调度；`infrastructure/ai` 与 `infrastructure/stt` 实现 provider adapter。controller 只处理认证身份、JSON/multipart DTO 和结果映射，不直接访问 Prisma、Redis 或外部 HTTP。

`RoomsModule` 通过公开 application API 提供只读 assistance context：锁定或一致性读取房间状态、调用者 membership、房间主题与用户 CEFR，并复用账号、年龄和当前安全限制判断。`assistance` 可以依赖 rooms 的公开边界，rooms 不反向依赖 assistance，避免循环依赖。

替代方案是把 AI 流程放进 voice 模块；拒绝该方案，因为按需表达既不签发实时凭证也不控制 LiveKit，后续文字入口同样不依赖实时媒体。

### 2. 公开 API 分开 JSON 文字和 multipart 音频入口

新增以下认证入口：

- `POST /v1/rooms/{roomId}/expression-assistance/text`：JSON `{ clientRequestId, text }`。
- `POST /v1/rooms/{roomId}/expression-assistance/audio`：multipart，包含 `clientRequestId`、`noticeVersion`、`noticeConfirmed=true`、可选 `sourceLanguageCode` 和单个 `audio` 文件。
- `GET /v1/me/speech-processing-consents`：返回本人当前目的、版本、状态与时间。
- `PUT /v1/me/speech-processing-consents/ai-expression`：JSON `{ clientRequestId, action: ACCEPT | REVOKE, noticeVersion }`。

两个表达入口返回同一受控结构：请求标识、主要表达、零至两条 `{ text, tone }` 可选表达、稳定提示标识、生成时间和结果过期时间。客户端不传 topic、CEFR、target user、system prompt 或 target language；V1 由服务端固定生成英语。

音频在 multipart parser 层限制为 5 MiB 并使用 MIME allowlist，adapter 返回实际时长后再执行 30 秒上限；超限音频可能已经产生 STT provider 用量，但绝不进入表达生成。Node 进程只使用有上限的内存 buffer，不写临时文件、对象存储或队列载荷。

### 3. 请求状态机把持久事实与外部调用分开

`AiExpressionRequest` 使用 `(userId, clientRequestId)` 唯一约束，并保存 `roomId`、`TEXT | AUDIO`、输入 SHA-256 摘要、状态、处理阶段、lease、provider 类别、尺寸/时长、最小用量、归一化错误、结构化输出和 `outputExpiresAt`。不保存原始文字、音频或转写。

状态按 `RESERVED -> STT_RUNNING -> AI_RUNNING -> SUCCEEDED | FAILED | UNCERTAIN` 前进。创建/重放请求和额度预留在 PostgreSQL 事务及 actor-scoped advisory lock 内完成；外部 HTTP 不占用数据库事务。每个执行者持有有期限 lease 和随机 token，只有当前 token 可以提交阶段结果，避免迟到响应覆盖新状态。

相同摘要的成功请求在输出保留期内直接重放；输出清理后返回 `RESULT_EXPIRED` 且不自动重新生成。确定失败以同一标识重放原失败，用户主动重试需新标识。未过期 lease 返回 `IN_PROGRESS`；lease 过期后的恢复可以继续或收敛为 `UNCERTAIN`。adapter 在 provider 支持时透传请求标识作为幂等键，但系统明确不承诺外部供应商恰好一次执行。

替代方案是把整个请求放入 BullMQ 异步处理；拒绝该方案，因为队列不得携带原始文字、音频或转写，而短音频丢失后无法安全恢复。同步、有时限的 provider 调用更符合“主动请求、即时得到表达”的行为。

### 4. 同意采用追加事件和当前投影

`SpeechProcessingConsentEvent` 保存用户、目的、`ACCEPT | REVOKE`、notice version、provider category、服务端时间和 `(userId, clientRequestId)` 幂等事实。当前状态由同一用户/目的的最新事件投影；notice version 变化会让旧接受失效。该表不保存音频、转写、设备信息或 IP。

音频入口同时要求当前有效的 `AI_EXPRESSION_AUDIO` 同意和本次 `noticeConfirmed=true`。文字入口不读取语音同意。后续房间安全 STT 可以增加独立目的，不能复用 AI 短语音同意静默授权持续房间处理。

### 5. PostgreSQL 账本控制额度，Redis 只控制短期速率

`AiUsageLedger` 以 request、user、provider、能力、UTC 配额日记录预留和实际单位，request 唯一，避免重放重复扣减。用户每日请求/音频秒数和平台日预算在 provider 调用前，以数据库时间和 advisory lock 原子预留；最终根据 provider 返回的 tokens/audio duration 更新，未知成本按预留上限保护预算。前置资格或参数失败不写 provider 用量。

Redis Lua/原子计数器限制每用户分钟请求数和同时进行数，并返回 `retryAfterSeconds`。Redis 不可用时新 AI/STT 请求 fail closed，现有房间、离房和 LiveKit 媒体不受影响。额度、预算和默认值均来自有范围的配置；测试使用小额度验证边界，生产值由运营配置。

### 6. 首个 provider 使用兼容 HTTP adapter，但业务合同不依赖厂商

AI 和 STT 分别配置 provider name、HTTPS base URL、model、API key、timeout、region、用途、最大保留秒数和 no-training/deletion mode。首个实现使用 OpenAI-compatible text generation 与 audio transcription HTTP 合同和 Node 内置 `fetch`/`FormData`，不让 SDK 类型进入 domain。两个 base URL、key、model 和启用开关独立，允许未来单独替换。

production 只接受 HTTPS；test 允许 localhost。启用表达功能时必须同时具备 Redis、AI 配置和符合政策的 provider 声明；启用音频时还必须具备 STT 配置。最大声明保留期超过 604800 秒、no-training 为 false、STT 无删除/不留存模式或凭据缺失时启动校验失败。日志只记录 provider category，不记录 URL query、key 或原始响应。

替代方案是直接依赖单一厂商 SDK；拒绝该方案，因为它会让业务错误、用量和数据政策与 SDK 类型耦合，也不利于后续房间 STT 使用不同 provider。

### 7. 固定提示模板和严格输出验证控制结果边界

服务端生成提示，只包含用户本次输入或临时转写、房间 topic、用户 CEFR、目标英语和结构化输出约束，不包含其他成员资料。用户内容作为数据段处理，不能覆盖系统约束。adapter 返回后使用严格 schema 验证：一条 primary、最多两条 alternative、允许的 tone 枚举、每条长度上限及总输出上限；无效结果直接归一化为 provider-response failure，不向客户端透传原始内容，也不自动调用第二 provider。

短语音 transcript 只存在于 application 调用栈中，在 `finally` 路径释放引用；表达响应不返回 transcript。JavaScript 不能承诺物理擦除进程内存，因此验收只声明“不写持久化和不可读取”，不声称可证明内存逐字节销毁。

### 8. 私有输出使用短 TTL 和可恢复清理

结构化输出默认保留 24 小时，配置范围为 5 分钟至 7 天。成功事务同时写 `outputExpiresAt` 并提交不含内容的 `EXPIRE_AI_OUTPUT` BullMQ job；job 以数据库时间执行条件更新，把正文置空并记录 `outputPurgedAt`。worker 重启时扫描已过期但仍有正文的记录重建任务，重复清理幂等。Redis 丢失只延迟清理调度，数据库扫描最终收敛；不得延长公开的过期语义，读取在 `outputExpiresAt` 后立即视为过期。

不把清理 job 加进现有 room realtime queue 的 command union，新增独立 assistance maintenance queue，避免房间时序和 AI 数据治理互相阻塞。

### 9. OpenAPI 继续由 NestJS code-first 单向生成

DTO 和 Swagger metadata 描述 JSON、multipart、文件大小/MIME、同意入口、统一结果、429/503/冲突和过期错误；`openapi/openapi.yaml` 仍是唯一发布合同。不会手写第二份 schema。请求体、multipart metadata、Authorization、输入摘要、provider 响应和结果正文均加入 HTTP/结构化日志脱敏；最小指标按状态、阶段、provider category、耗时和用量聚合。

## Risks / Trade-offs

- [Risk] 外部超时后 provider 可能已经完成并计费，无法跨厂商保证恰好一次。→ 使用 lease、provider 幂等键（若支持）、`UNCERTAIN` 状态和单次平台预算预留；不自动并发重试。
- [Risk] multipart 内存上传可能增加进程内存压力。→ parser 在分配前限制单文件 5 MiB、每请求一个文件、限制并发；Redis 协调不可用时停止新音频请求。
- [Risk] STT 只有在 provider 解析后才能确认真实时长，超长音频可能产生一次 STT 成本。→ 同时限制字节数、客户端录制上限和 provider 返回时长；超长结果不进入 AI 生成并记录实际用量。
- [Risk] 供应商声明不等于真实删除证明。→ 配置和代码只证明启用门槛；真实 smoke、供应商政策/区域/删除证明分开记录，缺证据时标为 BLOCKED。
- [Risk] PostgreSQL 日额度锁在高流量下形成热点。→ V1 小规模使用 actor/day 与 platform/day advisory key；指标显示锁等待后再考虑独立计量服务。
- [Risk] 临时输出正文仍会在 TTL 内存在数据库。→ 最短可配置 TTL、本人隔离、无列表入口、日志脱敏、到期读取立即失效及可恢复物理置空。
- [Risk] Redis 故障会让 AI 暂时不可用。→ 选择 fail closed 防止无界并发和成本失控，同时保持房间真人语音完全独立。

## Migration Plan

1. 增加枚举、`AiExpressionRequest`、`SpeechProcessingConsentEvent`、`AiUsageLedger` 和约束/索引的只向前迁移；用隔离 schema 验证空库与含现有用户、房间、安全和社交数据的历史链升级。
2. 部署默认关闭的 assistance 模块、fake/provider contract tests、同意与文字/音频入口、独立 maintenance queue；未启用时入口返回稳定不可用结果。
3. 配置符合政策的 AI/STT provider、Redis、额度和 retention 后启用；使用合成文字与非个人短音频执行真实 smoke，不在仓库或验收文档写入密钥和原始 provider 内容。
4. 观察超时、失败率、配额、预算和清理延迟；只有 provider 连接、数据政策和清理证据通过后才把真实 provider 验收记为 PASS。
5. 回滚时先关闭 assistance 启用开关并停止新请求，再回滚应用。保留新增表、用量、同意和最小请求事实；继续运行或手动执行正文清理，不做破坏性 down migration。

## Open Questions

- 最终生产 provider、区域和模型名称由部署配置决定；只要满足当前公开合同与数据政策，选择不会改变本设计。
- 公测日额度、平台预算和 5 分钟至 7 天范围内的私有输出 TTL 由运营在启用前确定，默认值不作为长期承诺。
