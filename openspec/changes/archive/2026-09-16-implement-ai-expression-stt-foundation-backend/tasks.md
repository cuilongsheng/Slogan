## 1. 数据模型与领域边界

- [x] 1.1 在 Prisma multi-file schema 中新增表达请求、语音同意事件、用量账本及必要枚举，包含 actor-scoped 幂等、状态转换、lease、输出过期和用量唯一约束，并运行 `pnpm --filter @slogan/api db:generate` 验证 schema。
- [x] 1.2 新增只向前迁移和索引，使用隔离 schema 集成测试验证空库及含既有用户、房间、预约、安全、历史笔记和社交数据的完整历史迁移链升级且旧数据不变。
- [x] 1.3 实现文字长度、音频边界、provider 输出、请求状态转换、输入摘要和结果过期的纯 domain policy，并用单元测试覆盖边界值、非法转换和无效结构。
- [x] 1.4 在 rooms 公开 application 边界新增只读 assistance context，统一返回服务端房间状态、有效 membership、topic、CEFR 和账号/年龄/安全资格，并用集成测试验证非成员、离开、移除、终态房间和新限制不能绕过。
- [x] 1.5 实现目的/版本化语音同意的追加事件与当前投影规则，并用单元测试验证接受、撤回、版本失效、他人伪造和命令幂等。

## 2. Provider、配置与隐私基础

- [x] 2.1 新增 assistance、AI、STT、额度、超时、retention、region、no-training/deletion mode 和 notice version 的 Zod 环境配置；使用配置测试验证默认关闭、production HTTPS、启用依赖和超过七天政策全部 fail fast 且不泄露配置值。
- [x] 2.2 定义 `ExpressionGenerator` port 并实现 OpenAI-compatible HTTP adapter、AbortSignal 超时、provider 幂等键、严格结构解析和稳定错误归一化，使用 fake HTTP contract tests 覆盖成功、超时、HTTP 错误、畸形 JSON、越界输出和密钥不出错。
- [x] 2.3 定义 `SpeechTranscriber` port 并实现 OpenAI-compatible multipart adapter、源语言、实际时长/用量返回、超时及稳定错误归一化，使用 fake HTTP contract tests 验证只发送允许字段且不发送身份、房间或 LiveKit 敏感信息。
- [x] 2.4 新增 disabled/fake provider wiring，使本地自动化无需真实凭据且启用状态明确；用 bootstrap 测试验证禁用入口稳定失败、只启用文字不要求 STT、启用音频时必须同时具备 STT 与 Redis。
- [x] 2.5 扩展 HTTP 与结构化日志脱敏，覆盖 multipart metadata、原始文字、输入摘要、结构化表达、provider body/URL/key 和 transcript；用日志单元测试证明上述内容不进入输出而状态、阶段、耗时和归一化错误仍可诊断。

## 3. 同意、幂等、额度与处理状态

- [x] 3.1 实现 Prisma assistance repository 和 `RESERVED -> STT_RUNNING -> AI_RUNNING -> SUCCEEDED | FAILED | UNCERTAIN` 状态机，在 PostgreSQL 数据库时间、advisory lock 和 lease token 下提交阶段结果；用集成测试验证迟到响应不能覆盖新 lease。
- [x] 3.2 实现 `(userId, clientRequestId)` 输入摘要与重放规则，使用集成测试验证成功结果保留期内重放、改变输入/房间/模式冲突、失败重放、处理中返回和正文过期后不重新调用 provider。
- [x] 3.3 实现同意查询与 ACCEPT/REVOKE application service，使用 PostgreSQL 集成测试验证当前投影、notice 升级、撤回只影响未来请求以及相同/不同幂等命令行为。
- [x] 3.4 实现 `AiUsageLedger` 的用户 UTC 日额度、音频秒数、平台预算预留和实际用量结算，使用并发集成测试验证最后一个额度只允许一次预留、前置拒绝不扣量、重放不重复扣量且未知 provider 成本受预留上限保护。
- [x] 3.5 实现 Redis 原子分钟频率与并发限制，使用真实 Redis runtime 测试验证跨实例计数、`retryAfterSeconds`、租约过期和 Redis 故障时 AI/STT fail closed 而房间流程继续可用。

## 4. 文字与短语音表达流程

- [x] 4.1 实现文字表达 application 流程：资格上下文、请求预留、额度、provider 调用、严格输出校验、成功/失败提交和私人结果重放；使用 fake provider 集成测试验证 CEFR/topic 来自服务端且原始文字不进入数据库。
- [x] 4.2 实现短语音 application 流程：有效同意、本次 notice 确认、音频摘要、临时 STT、30 秒检查、临时 transcript 传递和表达生成；使用 fake provider 集成测试验证 transcript 不持久化、不返回且 STT 失败不调用 AI。
- [x] 4.3 实现 5 MiB 单文件内存上传、MIME allowlist、一个文件和受控字段校验，使用 HTTP e2e 测试验证空文件、多文件、未知 MIME、越界大小、伪造 topic/CEFR/userId 和缺少 notice 在 provider 前被拒绝。
- [x] 4.4 验证文字/音频超时、provider 不可用、无效结果、平台预算关闭和 Redis 故障都只返回稳定表达辅助错误；使用集成测试证明房间状态、membership、房主、麦位和现有 realtime credentials 不发生变化。
- [x] 4.5 验证表达结果只属于请求用户且不进入其他成员、房间事件、私人笔记或公开内容；使用集成与 e2e 负面测试检查他人按结果/请求标识读取、日志扫描和数据库内容边界。

## 5. 清理、HTTP 合同与迁移证据

- [x] 5.1 实现独立 assistance maintenance queue、`EXPIRE_AI_OUTPUT` 无内容任务和数据库条件清理；用真实 Redis/PostgreSQL runtime 测试验证到期读取立即失效、正文置空、重复任务幂等及丢失任务在重启扫描后恢复。
- [x] 5.2 新增 consent、文字表达和 multipart 音频 controller/DTO/错误映射，使用 e2e 测试完成“接受同意 → 音频辅助 → 撤回 → 音频拒绝但文字仍可用”及当前成员文字辅助流程。
- [x] 5.3 使用 e2e 负面测试验证认证、本人边界、房间资格、当前安全限制、同意、429/Retry-After、503 降级、结果隐私和响应不含原始输入、transcript、provider、token 或其他成员资料。
- [x] 5.4 通过 NestJS code-first 重新生成 `openapi/openapi.yaml`，运行 `pnpm --filter @slogan/api openapi:check` 验证 JSON/multipart、文件边界、同意、统一结果和稳定错误合同无 drift。

## 6. 验收与外部边界

- [x] 6.1 执行 assistance 相关 domain、provider contract、PostgreSQL 集成、HTTP e2e、真实 Redis 频率/清理和历史迁移测试，记录套件数量及幂等、额度并发、隐私和清理结果。
- [x] 6.2 使用合成文字和不含个人信息的短音频执行已配置真实 AI/STT provider smoke，记录模型/区域类别、延迟、输出结构、时长和失败降级；缺少凭据或供应商数据政策证明时明确记为 BLOCKED，不得用 fake 测试代替 PASS。**结果：BLOCKED，仓库与进程均无真实 Provider 配置，详见验收文档。**
- [x] 6.3 运行一次 `pnpm verify:api`、`pnpm deps:check`、OpenSpec strict validation、格式检查和 `git diff --check`，修复本 change 引入的失败并保存最终数量。
- [x] 6.4 新增 `docs/acceptance/implement-ai-expression-stt-foundation-backend.md`，记录合同、迁移、自动化、真实 Redis/provider runtime、同意、额度、数据最小化、清理、未部署状态和所有外部 BLOCKED 证据。
