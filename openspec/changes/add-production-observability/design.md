## Context

动机与范围见 `proposal.md`，行为合同见 `specs/production-observability/spec.md`。以下依据 2026-10-14 当前工作区代码；现有未提交修改和其他活跃 change 不属于本 change 的修改授权。

- Admin 是 React 19/Vite 8；Mobile 是 Expo 57/React Native 0.86，包含原生与 Pages Web export。根入口为 `expo-router/entry`，当前尚无 Metro/Sentry 配置。
- API 是 Node 24/NestJS 12/Express、NodeNext ESM、Prisma 7、ioredis 6。`configureApiApp` 已配置 Pino HTTP、脱敏、`x-request-id` 和自定义 catch-all `ApiExceptionFilter`。
- `apps/api/api/realtime.ts` 使用 `@vercel/queue` 独立消费者；当前 realtime runner 在托管环境通过 recovery 消息每 30/300 秒续接扫描，常驻环境使用独立进程。最新仓库发布记录仍缺实际云端消费者验收，不能假定远端已采用工作区版本。
- Operations 已有 incident/observation/outbox、lease/generation、受限健康视图、依赖与积压探测；`OperationsProbeService` 的连续失败计数还在进程内，不能跨 serverless 执行保存。`OperationsRunnerService.runOnce()` 同时包含探测、指标与清理，`IncidentsService.dispatchOne()` 也受治理开关约束。
- `operational-alerting`、`operations-metrics` 等新增规格仍在 `implement-operations-data-governance-backend` 活跃 change；复用其实现，不同步/归档或重新定义其生命周期与权限。保留它的外部验收欠项。
- 主规格 `backoffice-audit` 明确禁止后台技术日志保存 stack；`temporary-speech-processing` 与 `room-sensitive-speech-detection` 禁止保存内容。第三方观测同样遵循这些边界。

## Goals / Non-Goals

**Goals:**

- 让真实故障具备环境、版本、代码位置和必要技术关联；为不能携带 stack 的受保护路径提供稳定类别定位。
- 让 serverless 监控与告警投递独立运行，任务停止由应用之外的监控发现。
- 限制 SDK 自动采集，明确每种产物和通道的出站/缓存边界，并给出能够复现的验收路径。

**Non-Goals:**

- 不让领域层依赖 Sentry，不新增 framework-dependent shared package，不把客户端技术事件用于业务事实、权限或运营成功率计算。
- 不提供自动修复、用户内容回放、全量 tracing 或平台 UI；不借用现有治理 runner 来启动清理。

## Decisions

### 1. 错误平台与应用边界

采用 Sentry 云服务；项目分为 `slogan-admin`、`slogan-mobile`、`slogan-api`，Mobile 使用 platform 区分 Web/Android，实际启用的 iOS 单独记录构建；API 的 HTTP、realtime、auth-mail、room-speech 等入口用 service 标签区分。每个环境独立启用，开发/测试默认关闭。API 用基础设施 adapter，Admin 用应用初始化设施，Mobile 用 `src/services/observability/`；平台差异留在技术服务中。

首期关闭 SDK 自动 tracing、profiling、日志批量上报、Replay、用户反馈 UI 和局部变量。连接阶段与耗时作为有界技术上下文，失败作为归一化事件；不产生每成员每秒的质量事件，也不宣称完整成功率或 p95 分布。预期业务拒绝不进入错误事件；允许的非预期事件在预算内记录，重复失败按稳定指纹聚合并有限时/速率控制。

选择原因：同一工具覆盖 React、Expo 和 NestJS，现有 Pino 继续承担完整技术日志职责。自建错误平台增加运行维护；整套指标/日志平台超出首期问题；仅装客户端 SDK 又无法发现扫描停止。

### 2. 关联、分类和 SDK 兼容

- `release=<app>@<Git SHA>`；原生 `dist`/build 标识与实际版本匹配，环境由部署或构建注入。暂未使用 OTA，不为此安装更新系统；以后启用 OTA 时追加 runtime/update ID 与匹配 maps 后才启用该更新的监控。
- HTTP 响应与客户端错误上下文使用同一合法 requestId。现有外部输入最长 128 字符的 requestId 不足以成为可信白名单，统一限制允许格式与长度，非法值换成服务端生成标识，不回显输入；兼容旧客户端不传标识。roomId、userId、participant identity 和 commandId 不直接外传；确有跨阶段需要时使用短期随机技术操作标识，内部关联留在受控日志。
- 错误分类由稳定 code 与阶段决定，不能仅以 HTTP status 判断。例如账号拒绝是预期业务结果，而同样被映射的 `*_PROVIDER_UNAVAILABLE` 是系统故障。受保护后台路径只输出固定类别，不读取原异常 message/stack。
- 保留既有 API filter 的响应合同，在单一错误边界选择性捕获；不可机械添加会绕过隐私分类的 decorator，也不能替换为改变错误体的默认 filter。worker/provider 已捕获失败通过同一分类器报告，transport 与消费边界避免重复捕获；finally 中的上报不得覆盖原异常。
- Node ESM 初始化先于被 instrumentation 的模块；独立队列函数、worker 和 HTTP 各有入口，不能只改 `src/main.ts`。serverless 使用平台支持的有限生命周期发送/排空，初始上限 2 秒；SDK 传输超时作为非业务错误处理，不能使成功队列任务重新投递。
- 兼容验证使用实际 Nest 构建、Vercel build、Vite Pages 构建、Expo Web export 和 Android release。固定通过验证的 SDK/构建插件版本。ioredis 6 超出当前 Sentry 自动 Redis tracing 文档范围，且本阶段 tracing 关闭，因此不依赖该 integration，也不为监控降级业务依赖；Prisma/LiveKit 同理。无法满足原生缓存隐私或平台入口要求时，先修订设计，不绕过门禁上线。

### 3. 发送前和缓存前的白名单

允许环境、服务、平台、release/build、固定阶段/错误码、归一化技术事件、耗时、合法 requestId 和短期技术标识。禁止任意 extras、动态 tags 和自由文本；不设置真实 Sentry user/email/username，不采集 IP、请求头、请求/响应体、query/fragment 或带凭据 URL。

错误值先归一化再交给 SDK；最终 `beforeSend`/breadcrumb 等清理是第二道防线，不把原异常整体作为 cause/extra。非受保护路径只保留用于源码匹配的代码帧字段，剥离异常消息、局部变量、参数及开发机绝对路径；受保护后台路径删除全部 exception/stack/context，仅保留固定事件名、合法技术关联和稳定结果码。不得依赖按字段名匹配的 Pino redact 自动覆盖 SDK。

原生必须单独验证 SDK 初始化、native before-send/缓存钩子、重启补报与自动 breadcrumbs。只启用可证明遵守白名单的结构化原生崩溃记录；关闭内存/heap dump、任意附件和不能在缓存前控制内容的通道，不承诺覆盖全部 C++/NDK 内存崩溃。Android 是本仓库首个必要原生 release 验收目标；iOS 在其实际上线前执行同等验证。仅 JS `beforeSend` 通过不等于 native 通过。

用无隐私的 canary 值检查事件、cause、错误路径、breadcrumb、native 重启缓存和通知正文。不能净化的事件安全丢弃，并只保留内容无关的本地固定计数；禁止把净化失败的原值写日志。第三方账号的数据区域、最大留存、访问人员及源码访问也要在启用前记录。

### 4. 最小健康合同与同源代理

新增 `GET /v1/health/live`：启动完成后返回 200 `{status: "ok"}`。新增 `GET /v1/health/ready`：对 PostgreSQL 做限时只读连接检查，成功返回 200 `{status: "ready"}`，失败/超时返回 503 `{status: "not_ready"}`；初始查询 deadline 2 秒，同时控制连接/池获取超时，避免只让 Promise 超时却遗留无限查询。响应不带组件列表、错误细节、配置、room/user 或数据库版本；两端使用 `Cache-Control: no-store`。

LiveKit/AI/STT 等可选能力失败继续通过内部 incident 诊断，不让其失败使核心 API 全部 not-ready。现有 `/v1/backoffice/operations/health` 保持 RBAC，不作为匿名外部监控入口。对 probe 采用独立合理限流，并避免每次探针生成错误平台事件。API 使用现有 NestJS code-first 生成 `openapi/openapi.yaml`，相应客户端从唯一合同再生成。

外部同时监控公开 API 探针、两个 Pages 站点和各站点同源代理的 ready 路径；后者返回必须检查状态/内容，不能将 HTML fallback 的 200 当作 API 成功。Pages proxy 对健康响应不缓存；不额外暴露队列消费者 HTTP 入口。静态页面在线不能证明客户端登录或音频正常。

### 5. 独立监控队列及持久扫描状态

在 Vercel 增加独立 `slogan-observability` topic 与私有监控消费者，不把 monitoring job 加进 `slogan-realtime` 恢复链。以延迟队列消息续接每 60 秒的只读扫描；实际周期、用量上限和预算作为配置可调整。常驻环境使用同一单次扫描服务的独立 monitor worker；任一环境只启用一种调度 owner。选择队列是复用现有平台和依赖，避免 HTTP 函数定时器及新增常驻基础设施；平台 cron 可作为以后替代，但不是本方案未决实现路径。

新增独立监控开关与调度状态，不调用 `OperationsRunnerService.runOnce()`。拆出只读 dependency/backlog 探测、监控 observation 和 outbox dispatch 的公开 application 入口。告警投递允许在监控开启时运行，原治理写命令和 retention dispatch 仍受原治理开关与 RBAC 控制；legacy operations runner 与新 runner 同时启用时协调扫描 owner，复用已有投递租约。原告警 sink 不符合目标服务协议时只新增最小 adapter，保留已有 outbox/fencing，不把整套 incident 改为 Sentry issue。

新增小型 `ObservabilityMonitorState` 技术模型，按环境与固定 monitorKey 唯一，保存最近完成窗口、lastCompletedAt、consecutiveFailures、lease/generation 和扫描续接状态，不含用户或内容。扫描窗口去重、失败计数与 incident 观察通过同一 application/repository 事务或持久待完成状态收敛；跨函数重启不丢阈值，旧租约不能覆盖新结果，重复消息不重复累计。复用现有 incident fingerprint/cooldown；将进程内连续失败计数迁移为持久状态，恢复判断以持久开放 incident 为依据，避免重启后无法关闭旧事件。

扫描只探测已启用的 provider 和关键非终态命令/作业，检查数量、最老待处理年龄及现有 deadline；禁用功能返回 disabled，不能凭“没有执行”报健康。依赖探测有超时和固定次数；现有对 provider 根路径的 HEAD `<500` 判断只能证明部分可达，401/403 不能算业务就绪。本阶段使用 provider 支持的无副作用 readiness 方法，没有此能力时明确 unknown，不发送真实 AI/STT 内容或短信作探测。

种子由受控部署后命令发布，并提供同一幂等 reseed 命令用于链停止恢复。完成扫描后先可靠安排下一窗口，再提交完成状态/发送独立 heartbeat；发布失败继续按消费者策略重试。用持久窗口 key 与队列 idempotency key 避免在“发布成功、记录失败”的窗口产生多条无限扫描链。无用户请求也继续扫描，不依赖用户请求播种；超过队列保留期或平台故障只能由外部告警加受控 reseed 恢复，不承诺自行修复全部故障。

### 6. 外部心跳、阈值与通知

HTTP/heartbeat 使用独立 SaaS；优先候选 Better Stack，最终账号计划只影响配置与 sink adapter，不改变上述消费者和监控合同。Sentry 通知新程序错误/回归，既有 incident/outbox 通知依赖和积压，外部 heartbeat 通知整个调度失效，三者不互相伪造成功。

初始配置建议（实施时固化为可校验默认值，目标账号不支持时调整并记录实际检测窗口）：

| 信号                     | 检查与告警                                                             | 恢复                         |
| ------------------------ | ---------------------------------------------------------------------- | ---------------------------- |
| API/Pages/同源代理不可用 | 外部每 3 分钟检查，连续 2 次失败通知                                   | 连续 2 次成功后通知          |
| 独立监控扫描停止         | 60 秒扫描，180 秒 heartbeat 宽限                                       | 一次完整扫描并续接成功后恢复 |
| realtime recovery 停止   | 完整扫描及续接后发送专用 heartbeat，空闲可为 300 秒，初始宽限 720 秒   | 后续完整扫描及续接成功       |
| 启用依赖不可用           | 复用配置阈值，默认 3 个不同成功执行窗口的失败观察                      | 成功探测关闭当前 occurrence  |
| 持久命令/关键作业超期    | 使用既有业务 deadline；没有 deadline 的实时清理初始 120 秒，按类别聚合 | 超期数量归零后恢复           |

低流量不使用百分比告警；正常成员移除、离房、短暂重连不触发高优先级通知。故障类别和环境作为稳定指纹，默认至少 5 分钟冷却；通知只带固定服务/组件/类别、版本、时间与稳定码，不带用户/房间/命令 ID。外部 heartbeat 发送失败不让成功业务任务重试；若监控 heartbeat 失败，外部最终报丢失，不再用同一 sink 递归通知自身失败。DB 完全不可用时不能依赖 DB incident/outbox，靠外部 ready/heartbeat 通知。

所有通知接收人、渠道与恢复通知均由目标环境负责人配置并验证。心跳 URL/token 与告警 secret 只保存在服务端私有配置，不进入 Web/native build 或日志。不是每个 worker 都必须迁移到 Vercel：只对实际启用的 worker 建立职责对应的完成心跳，持续音频 worker 仍使用其适合的常驻运行环境。

### 7. 构建上传、预算与开关

Admin 在实际 `build:pages:admin` 的 Vite 路径生成 hidden source maps、上传后删除；Mobile Web 在 `build:pages:mobile` 的 export 路径生成、上传及删除 maps。API Nest 与独立队列函数的产物分开验证，Vercel compiler 产物不等于本地 `dist`；Sentry CLI/debug ID 与发布信息只匹配实际发布文件。原生上传匹配 build 的 JS maps 和可用符号，不假定 `expo export --platform ios` 是安装包。

`SENTRY_AUTH_TOKEN` 只在构建上传步骤注入，不用 `VITE_`/`EXPO_PUBLIC_` 前缀，不进入镜像、runtime env 或客户端。DSN 是公开 ingest 标识，可进入客户端；它不替代项目访问凭证。启用监控的 release build 缺失上传配置/符号上传失败时拒绝作为“可定位的监控发布”继续发布，保持上一可用版本；普通监控关闭的本地构建无需上传。保留每次上传和产物排除清单，不公开 source maps/源码档案。

每服务有显式开关、环境/版本校验、速率上限与固定类别过滤；启用时非法必要配置阻止启用/启动，但运行时第三方故障不影响业务。发布中检查配额使用和冷却效果；不默认购买计划、开启付费超额或承诺无限免费。免费/付费计划、区域和保留期在远程授权时记录；关闭/回滚客户端需重新发布关闭配置的 Web/native 构建，不能假定服务端开关能停掉所有已安装旧包的发送，必要时在 Sentry 端禁用/限流该 ingest。

## Risks / Trade-offs

- [SDK 版本与最新框架不兼容] → 实际产物兼容验证先行，锁定版本，首期关闭自动 DB/Redis tracing；无法满足要求则暂停该接入并明确修订方案，不悄悄降级业务栈。
- [native 自动缓存或 dump 绕过 JS 清理] → 原生缓存前验证与 canary 检查；关闭不可控通道，保留原生结构化崩溃能力，不把 JS 清理证据替代 native 证据。
- [后台审计需要定位但不得保存 stack] → 仅固定类别和技术关联，保留诊断精度限制；不修改主规格来方便 SDK。
- [队列至少一次投递/链停止/平台同域故障] → 持久窗口与 fencing、独立 topic、外部 heartbeat、幂等 reseed 和真实停请求验证；仍依赖平台，不承诺零丢事件或固定秒级恢复。
- [两个 operations runner 同时观察导致错误计数/重复通知] → 固定扫描 owner、持久窗口唯一键、既有 outbox lease；治理关闭/开启组合均回归。
- [监控工作量增加并误启动删除] → 独立开关和单次监控服务，不复用综合 runOnce；测试明确禁止调用 retention/政策/删除入口。
- [配额和 serverless 执行费增长] → 明确扫描频率和每轮上限、关闭 tracing/Replay、控制高基数标签；上线前评估队列操作量与实际计划。
- [真实发布拓扑与工作区不同] → 验收固定部署 SHA、构建 ID 和消费者列表；原 realtime 云端验收欠项不自动算通过。

## Migration Plan

1. 先完成错误分类、净化与实际产物兼容验证；在本地 transport 下证明上报不改变业务。SDK 初始化默认关闭。
2. 增加健康合同和 additive 监控状态模型。迁移在空库与现有 operations/room/command 历史 fixture 验证；不改变原业务表、已有 incident 状态或清理政策。
3. 分别接入客户端/API/实际 worker，验证版本匹配和构建产物；准备独立监控消费者、幂等 seed/reseed、outbox adapter 和 runbook。
4. 远程阶段开始前，记录授权目标、源码/数据区域与留存、服务计划预算、接收人、实际检查窗口和私有配置来源。在独立验收环境触发无内容故障，不在公共产品增加测试按钮或无鉴权 throw 接口。
5. 先部署健康与默认关闭的服务端能力/迁移，再配置外部探活与通知，启用独立监控消费者并播种，最后逐服务启用已上传定位产物的 Web/Android 发布包。明确独立 worker 是否部署，未启用能力记 disabled。
6. 完成真实事件定位、队列失败与重试、停止所有用户请求后的持续扫描、停链/恢复通知、sink 故障与缓存隐私检查，并记录关闭和受控 reseed 演练。目标环境无证据时保留任务未完成；本地代码可完成但不能标记生产监控验收通过。
7. 回滚先停止监控 topic 的续接/consumer 并关闭新外传，客户端发布关闭配置版本；保留健康接口的兼容性、监控技术状态表、原 incident/outbox、realtime 主题和待处理命令。只回滚本 change 的适配器/初始化，不执行 down migration、重置治理 flag 或删除业务事实。恢复监控时用幂等 reseed，不修改 realtime 业务收敛状态。

### Evidence

- 本地：白名单与 canary、错误分类/去重、配置启停、HTTP 合同与 RBAC、PostgreSQL 跨执行阈值/fencing、队列停止与恢复、失败限时和不触发 retention 的测试；最终运行一次完整 affected-scope 检查。
- 浏览器：真实构建的 Admin/Mobile Web 与 Pages 同源 API，源码定位、公开 map 不可下载和 transport 限时。页面无需重设计；如果 SDK 接入改变产品 UI，先另行确认 Figma 目标并按项目 skill 完成，不在本 change 自行设计。
- 设备：Android release 的 JS/结构化原生崩溃、重启补报、离线缓存检查，真实断网/重连/主动离房与音轨订阅观测；iOS 在实际支持上线前执行同等验证，不用 Expo Go 或 Web fixture 代替。
- 外部：真实通知送达接收人、实际检测窗口、队列 no-traffic 运行与停链/恢复、Sentry 限流或断网对业务无影响。验收文档与发布记录分开保存；所需验收可在授权的隔离目标环境完成，不要求生产部署才能归档。

## Open Questions

### V1 closeout: shared monitor pause and monitored clients (2026-10-17)

The owner authorized completing monitor stop/recovery and client release acceptance. Static environment flags on a new Vercel deployment cannot stop older recurring consumers. Add an `enabled` boolean to the existing monitor state table; a per-environment `CONTROL` row is read before seeding/claiming and before continuation/heartbeat. Missing control rows preserve current behavior. An operator pause drains queued callbacks without deleting incidents, delivery/outbox rows, leases or business facts. Resume requires an explicit idempotent reseed. The private CLI verifies the database target fingerprint and requires an environment-specific mutation confirmation; no public control endpoint or new role is introduced.

This is an additive migration with default true. Deploy the migration before the compatible workers. Older binaries do not understand the shared gate and must be explicitly retired, protecting active aliases and using a gate-aware rollback revision. A pause does not cancel business realtime recovery. Rollback retains the column and data; resuming the shared gate alone does not restart a drained chain. Database failure rejects the scan without a false successful heartbeat. Target-environment pause/recovery and actual receiver notification remain acceptance requirements.

The protected main Android build receives mobile-only upload credentials in the Production environment, binds JS/native release and build to its actual source SHA, uploads Hermes maps and applicable Java mappings through the official Expo/Sentry hooks, and verifies packaged public configuration and absence of the upload token. PR builds receive no upload secret. Native collection remains structured Java only; NDK collection, native source uploads, source-context capture, Logs, Profiling and Application Metrics remain disabled. Pages use their existing per-app upload/build paths with protected build secrets; no upload token enters a frontend public variable or runtime.

## Approved sampled tracing continuation

2026-10-15 用户批准后续两阶段全部工作，并指定当前账号邮件通知、保持免费额度；token 未配置，先交付实现和配置页面。API HTTP 初始化延用已发布官方 instrument + 单一 filter，不再另起一个 SDK。客户端采用手动 span，采样率环境配置默认 0.1、合法范围 0–1，关闭时不发 trace。API client 通过 OpenAPI schemaPath 给技术层提供固定路由模板；不得通过实际路径、query、params 推导 span 名称。仅向配置 API origin、/v1 路径的请求附加去敏 Sentry trace headers，禁止向 OAuth、LiveKit 或重定向目标泄露关联；重试继续保留原业务结果。

语音阶段 span 记录连接、重连及本地 participant 的固定连接质量等级，成功同样保留以支持采样分布。每次质量变化有数量上限，不采集成员身份/音轨统计明细/正文；主动离房、移除和结束取消未完成阶段，不报警。连接质量仅代表 LiveKit 技术信号，不能等同用户实际听音质量。

上传流程以实际 Vercel 编译产物为输入，使用 debug ID 关联、错误 frame/debug_meta 同步规范化；Nest dist 不能替代 Vercel maps。配置缺失时拒绝受监控发布，命令不得打印 token、完整子进程环境或 provider 原始错误。真实云端上传/通知送达和设备任务保持未完成，后续授权前不购买外部服务、不创建私有 token。

风险与回滚：跨源 trace 限定 origin/path、禁止重定向传播；采样和阶段数量都有上限。客户端关闭需重建；保留既有业务恢复、错误 fallback 和服务器唯一 filter。源上传凭证只在受控构建使用，不能出现在运行包或 VITE_/EXPO_PUBLIC_ 变量中。

- 目标 Sentry 组织/项目、区域、留存、访问人员与预算，外部监控服务账号及告警接收人；这些是启用配置门禁，不改变所选独立队列和错误边界。
- 目标环境实际支持的检查周期与宽限、通知 sink endpoint 的字段映射、原生构建签名和源码上传凭证；实施前用私有配置提供，不在文档记录真实 secret。

### References

- [Sentry NestJS 接入与自定义 filter](https://docs.sentry.io/platforms/javascript/guides/nestjs/) 与 [Redis integration 支持范围](https://docs.sentry.io/platforms/javascript/guides/node/configuration/integrations/redis/)：实际版本在实施时再次验证。
- [Expo Sentry 构建/更新说明](https://docs.expo.dev/guides/using-sentry/) 与 [Sentry Vite source maps](https://docs.sentry.io/platforms/javascript/guides/react/sourcemaps/uploading/vite/)：映射到本仓库实际构建路径。
- [Vercel Queues](https://vercel.com/docs/queues)、[SDK](https://vercel.com/docs/queues/sdk) 与 [价格/限制](https://vercel.com/docs/queues/pricing)：延迟、至少一次投递、幂等发布和 beta 限制不能作为本项目云端运行证据。
- [Sentry 价格](https://sentry.io/pricing/) 与 [Better Stack 价格](https://betterstack.com/pricing)：只作为启用前的计划核对入口，不固定长期免费承诺。

2026-10-15 后续授权补充：用户单独批准创建 org:ci 构建 token，并要求可直接完成 Sentry 配置。三项目、邮件与默认脱敏/IP 丢弃已经配置；token 只保存在仓库外私有文件，未升级付费计划。后续真实上传和源码定位使用隔离提交产物，验收状态以记录为准。
