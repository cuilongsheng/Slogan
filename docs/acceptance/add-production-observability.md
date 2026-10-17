# add-production-observability：实施与验收记录

## 2026-10-17 closeout update (authoritative current status)

Current tasks:30/37; change remains active. See [V1 closeout](v1-closeout/README.md) and [release receipt](../releases/2026-10-17-v1-closeout.md). API and both Pages now run c631c709. Actual Android0.0.135 Hermes upload/unpacked artifact checks passed, but production login/streaming fails because Redis free quota is exhausted, so the new APK was not published. Owner chose to remain free; published APK remains0.0.127.

Actual shared monitor pause/quiescence, private reseed, fault/recovery emails and Mobile Web original-source Sentry location are verified. Current monitor uses bounded keyless Lua instead of PING and correctly keeps Redis READINESS open. Native monitoring canaries/cache/restart, expected401 remote filtering, the full remote fault matrix and per-service shutdown remain incomplete. Owner stopped further device work. Earlier sections below retain their dated evidence and do not override this update.

更新：2026-10-15。代码与 Sentry 账号配置已完成本轮续作，真实源码上传和实际错误邮件已验证；完整 change 保持未归档。当前任务完成 29/37。当前状态及证据如下；文末保留 2026-10-14 的历史本地验证记录，历史阻塞不代表当前状态。

## 当前交付

监控源提交为 `e50cb75`，隔离 checkout 为 `/Users/cls/.codex/worktrees/observability-delivery/Slogan`。本轮仅提交监控相关内容，没有混入当前工作区的字体、图标、页面或房间功能。完整源码文件清单见 [changed-files.json](add-production-observability/changed-files.json)。

- shared / api-client：事件内容白名单、采样校验、OpenAPI 路由模板、固定技术 trace header；只向指定 API origin 传播，不发送原始 URL/query/身份/音频/转写。
- Admin / Mobile：错误边界、HTTP 最终故障和采样追踪、语音连接/重连/有界质量变化；保留原交互、认证、取消和重试语义。只启用 Error Monitoring + Tracing，Logs、Profiling、Application Metrics、Replay 关闭。
- API：保留官方 `@sentry/nestjs`，`src/instrument.ts` 是 `main.ts` 第一项 import；直接 import `@nestjs/core` 和 `NestFactory.create()` 不变。现有 `ApiExceptionFilter` 使用 `@SentryExceptionCaptured()`，没有新增冲突的全局 filter 或公开调试接口。provider/worker 使用隔离 scope 去重，后台受保护事件不含 stack。
- 持久监控：live/ready、additive 数据表、独立私有 observability topic/consumer、常驻 monitor、跨窗口失败阈值/租约/fencing、outbox 重试/恢复通知及完成 heartbeat。治理/retention 与监控开关分离。
- 构建：实际 Vite、Expo Web 与 Vercel 编译器产物上传；缺少凭据/映射或上传失败时拒绝受监控发布。NFT workspace 映射要求 JS 字节一致；Expo 清理缓存并验证实际 bundle 中的 release/build/DSN；上传后删除公开 maps，上传 token 不进入函数运行环境或公开 bundle。
- 云端定位补正：固定 Sentry 协议 platform（node/javascript），worker frame 和 Debug ID code_file 使用相同 app:/// 源码路径。SDK 内的 platform OS 标签继续保留。

## 已完成的 Sentry 配置

组织 `tonycui`，EU 数据存储；API 当前 slug 是 `slogan-api`（原 `node-nestjs`，project ID 和 DSN 未变），另有 `slogan-admin`、`slogan-mobile`。

三个项目使用统一邮件规则 **Slogan errors and recovery email**（1371862）：所有环境、捕获事件/issue activity、当前账号、每问题 5 分钟冷却。测试邮件及实际错误邮件 **SLOGAN-API-3 - Error: Unexpected API failure** 均在当前账号 Gmail 中确认到达。包含账号邮箱的截图仅留本地，不提交仓库。

三个项目均启用服务端默认 scrubber、IP 地址丢弃、minidump attachments 继承 Disabled，并保存高级规则 `[Remove] [Anything] from [user]`。新事件核验仍存在平台推断的粗粒度 Geography（服务端出站地域 Singapore），因此该规则未消除此派生字段；SDK 不发送终端用户 IP/身份，不把 SDK 白名单等同于平台不会派生数据。配置截图见 [服务端清理规则](add-production-observability/sentry-user-scrubbing.jpg)。

用户单独授权创建 `Slogan source maps`（org:ci）token，已保存在仓库外 `~/.config/slogan/observability/sentry-build.env`，目录 700 / 文件 600。分环境配置也保存在同一私有目录。没有将值输出到聊天/源码或添加到 Vercel 函数运行环境。

费用核对时控制台为 **Business Trial**（剩余 13 天）、无付款方式、额外费用 $0；未升级计划、未提交 checkout。不能把试用权益当作永久免费计划。

## 真实上传与云端证据

实际上传清单见 [uploaded-artifacts.json](add-production-observability/uploaded-artifacts.json)。Admin/Mobile Web 公开输出 map 数量为 0、release 存在且未含上传 token；Vercel 实际 Node24 产物包含 `index.func` 和私有 `api/observability.func`，逐函数记录 handler hash。构建使用合成 HTTPS origin，**仅用于构建和源码上传，不是可直接发布的产品配置**。

API canary 来自实际 Vercel index 编译产物，在本机调用配置函数触发固定错误并发往真实 Sentry。此前已在平台确认还原到 `apps/api/src/config/sentry.ts:28:11`，并收到真实邮件。当前源版本事件见 [API canary](add-production-observability/api-cloud-canary.json)。

独立 monitor canary 来自实际私有 consumer 的逐字节相同 JS（为本机执行解析依赖附加 node_modules），以非法窗口输入在触碰 DB/queue 前失败，再发送固定 WORKER_FAILED。见 [monitor canary](add-production-observability/monitor-cloud-canary.json)。最终在 Sentry 确认还原到 `observability-monitor.service.ts:59:13`，截图见 [worker 云端源码定位](add-production-observability/monitor-cloud-source-location.jpg)。这是本机编译产物 + 真实 Sentry ingest 证据，**不能代替 Vercel 线上消费者、队列投递或持续调度验收**。

## 验证结果

| 范围                 | 结果与边界                                                                                                                                       |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 隔离监控源完整 API   | 46 unit suites / 261 tests、40 integration / 207、18 HTTP / 96，共 104 suites / 564 tests PASS（源 2762d1f）                                     |
| 客户端与共享包       | Admin 12、Mobile 43 suites / 120、shared 最新 11、api-client 3 tests PASS                                                                        |
| 最后源码定位修正     | shared 11 tests、API Sentry/reporting/bootstrap 44 tests、实际 CLI Debug ID + fatal subprocess 3 tests、构建门禁 7 tests 全部 PASS（源 e50cb75） |
| typecheck            | 全部应用/包 PASS                                                                                                                                 |
| 构建与门禁           | Admin、Expo Web、Nest/Vercel 实际构建和真实 source map 上传 PASS；构建门禁 7 tests PASS                                                          |
| 合同/层次            | 唯一 OpenAPI 与 api-client drift check PASS；dependency-cruiser 717 modules / 2820 dependencies PASS                                             |
| affected lint/format | 监控 allowlist PASS                                                                                                                              |
| 整仓 lint            | FAIL：既有 tests/e2e/mobile-safety-visual.e2e.spec.ts:5 consistent-type-imports；未改此无关文件                                                  |
| Android              | 之前 release Kotlin 编译、真实 Java SDK 磁盘缓存 canary PASS；无真实受监控安装包/设备/崩溃/符号上传证明                                          |

混合工作区的完整 API 曾通过 108 suites / 576 tests，但不拿它替代隔离提交的结果。历史整仓 format/dependency audit 欠项见下方，未宣称整仓全部通过。

## Vercel 配置与发布限制

API 必需配置：`SENTRY_DSN`；`SENTRY_TRACES_SAMPLE_RATE=0.1`（Preview 和低流量 Production 初值）。environment 优先 `NODE_ENV`；保留现有 NODE_ENV 语义，Preview/Production 应结合实际 deployment ID 辨认。release 可从 `VERCEL_GIT_COMMIT_SHA` 获取；prebuilt 则由已验证产物注入 `SENTRY_RELEASE` / `SENTRY_DIST`。

构建上传使用 `SENTRY_AUTH_TOKEN`、`SENTRY_ORG`、`SENTRY_PROJECT`、`SENTRY_UPLOAD_SOURCEMAPS=true` 和 `OBSERVABILITY_ENVIRONMENT`，仅在私有构建命令注入，不作为通用函数 token。Admin/Mobile 的 public DSN、enabled、environment、sample rate 使用对应 VITE_ / EXPO_PUBLIC_ 前缀，token 永不使用公开前缀。完整空值模板见 [observability.env.example](../runbooks/observability.env.example)。

持久扫描启用前还必须完成目标数据库 additive migration、私有消费者、外部 ready/heartbeat、真实费用/调度验证，再配置 monitor 开关和 seed；不能只打开布尔值。

本轮实时检查发现 Vercel 最新 Production 是 **7cbbab734d26a4011538bc08647ea5bd93cea511**，5 个 Node 函数；本轮隔离源只有 2 个函数，缺少线上已有 realtime、maintenance、seed、live-updates。见 [发布兼容性核对](add-production-observability/deployment-compatibility.json)。因此没有用旧基线覆盖当前线上版本，也没有 push/merge/deploy。下一次发布须先在最新发布源中整合监控、重建并验证 5 个既有入口都保留，不能把本轮 source map 上传当作已经上线。

## 未完成

- 最新发布源码整合、Preview/Production 新版发布、数据库迁移与外部 ready/heartbeat 配置。
- 三端已部署产物的实际浏览器错误/源码定位、私有消费者投递、无请求时持续扫描、停链/reseed、故障/恢复通知和逐服务关闭回滚。
- Android 真机 release 的 JS/原生崩溃、缓存/离线重启补报、真实网络和主动离房；当前 adb 无设备，iOS 原生继续关闭。

这些项保持 OpenSpec 未勾选，不把云端配置、本地构建或 Java 缓存测试计作完整生产验收。关闭配置并重新构建客户端/函数、停止扫描续接；保留新表、incident/outbox 和 realtime 业务事实，不执行破坏性 down migration。详见 [续作手册](../runbooks/observability-continuation.md)。

<details>
<summary>2026-10-14 历史本地验证记录（非当前状态）</summary>

# add-production-observability：实施与验收记录

日期：2026-10-14。状态：主要接入已实施，21/31 个任务完成；真实目标环境和原生 release 验收未完成，未部署、未归档。

基线为 `develop` / `716cc0bd0fd4e0010721f0e0ac3c77eec4522436`，证据来自包含其他活跃 change 修改的当前工作区。它不是已提交的监控发布 SHA，也不代表线上版本。入口与依赖见 [入口矩阵](add-production-observability/entry-matrix.md)，操作与关闭步骤见 [runbook](../runbooks/observability.md)，私有值使用 [空值模板](../runbooks/observability.env.example)。未更改其他 change 的任务完成状态。

## 实施结果

Admin、Mobile、API 与消费者/worker 已接入按环境关闭的 Sentry 错误边界；固定类别、UUID requestId、release/build 和技术阶段在缓存/发送前重建白名单。后台受保护事件不带 stack，关闭 Replay、tracing、内容附件与自动内容采集。API 致命异常和未处理 Promise 拒绝使用固定日志及限时排空，保留 Node 的失败退出结果。

新增匿名 live/ready 合同；真实 PostgreSQL 连接和查询停滞约 2 秒后失败，响应不含内部详情。重新生成 OpenAPI 和 api-client，跨域暴露合法 requestId。客户端预期拒绝与取消不报警，登出清理 scope，原有 React/Expo Router fallback 和业务返回保留；未修改 Button、Input、选项或其他产品 UI。

新增独立 observability 私有队列/常驻 monitor worker，持久保存窗口、连续失败和租约/generation；监控开启不开放治理写权限，不执行 retention。只读积压检测覆盖超期且租约失效的 RUNNING 命令，并排除未来工作和有效租约。保留既有 incident/outbox，补上过期 RUNNING 投递的重领，旧领取结果受 fencing 保护。seed/reseed 与续接使用稳定幂等键，heartbeat 只在完成工作后发送，传输失败不改变业务结果。

## 兼容与实际产物

| 项目    | 固定版本 / 实际验证                                              | 证据限制                                                                              |
| ------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| 服务端  | Node 24.21.0、pnpm 12.3.4、NestJS 12.0.1、Sentry NestJS 11.7.0   | 真实 SDK 隔离 transport、ESM 编译/进程退出；无真实 ingest                             |
| Admin   | Vite 8.2.2、React 19.2.3、Sentry React 11.7.0、Vite plugin 5.4.1 | 原 Pages 构建路径；实际 SDK、React boundary 验证                                      |
| Mobile  | Expo 57.0.25、RN 0.86.3、Sentry RN 8.30.0                        | Web 构建与 transport/session/media tests；非真机                                      |
| Android | Gradle 9.3.1、Kotlin 2.1.20、Sentry Java 8.60.0                  | 编译 release callback + 真实 Java SDK EnvelopeCache canary；未组装/安装受监控 release |
| Vercel  | CLI 63.1.2、实际 nodejs24.x 函数                                 | 独立临时目录、离线依赖安装、空平台配置，无 dotenv/部署/账号资源修改                   |
| 定位    | Sentry CLI 3.8.0 注入 map Debug ID                               | Node 出站净化后仍匹配；未证明云端符号化                                               |

Vercel 实际产物包括 `index.func`、`api/realtime.func`、`api/observability.func`；两个私有主题分别为 `slogan-realtime` / `slogan-observability`，各自存在对应源码映射。摘要见 [构建证据](add-production-observability/vercel-local-build.json)。可重复命令 `pnpm test:observability:vercel`。

Android 使用现有 `/Users/cls/Library/Android/sdk` 与 Android Studio JBR；未接受新 SDK 许可或安装新 NDK。生成的 android 目录仍被忽略，需审查和保留的是 `plugins/with-observability.cjs` 与 `plugins/SloganObservability.kt`。iOS 原生收集未启用，不能用 Android/Web 代替其发布验收。

## 本地最终验证

所有 Node 命令先运行 `source ~/.nvm/nvm.sh && nvm use`。

| 命令 / 范围                                                                | 结果              | 说明                                                                                            |
| -------------------------------------------------------------------------- | ----------------- | ----------------------------------------------------------------------------------------------- |
| 监控改动文件 Prettier / ESLint                                             | PASS              | 仅审查本 change 文件，没有格式化其他业务修改                                                    |
| `pnpm typecheck`                                                           | PASS              | 全部应用与包                                                                                    |
| `pnpm exec depcruise apps packages --config dependency-cruiser.config.cjs` | PASS              | 无跨层依赖违规                                                                                  |
| `pnpm --filter @slogan/api test:unit`                                      | PASS              | 47 suites / 249 tests；含 heartbeat 隔离与 provider HEAD 401/403/unknown 分类                   |
| `pnpm --filter @slogan/api test:integration`                               | PASS              | 41 suites / 208 tests；含空库/历史 fixture 迁移、窗口重启、fencing、outbox 恢复、真实 pg 超时   |
| `pnpm --filter @slogan/api test:e2e`                                       | PASS              | 19 suites / 101 tests；含健康合同、并发 UUID 和现有 RBAC/语音/离房                              |
| `pnpm --filter @slogan/api test:runtime`                                   | PASS with warning | 8 suites / 15 tests；真实本地 PostgreSQL/Redis/SMTP。仍有 Jest 短暂未退出提示，进程最终正常退出 |
| Admin / Mobile / shared / api-client 全部 tests                            | PASS              | 分别 6 / 134 / 5 / 2 tests；Mobile 最新配置与 session/media 另 15 tests PASS                    |
| 原 `build:pages:admin` / `build:pages:mobile`                              | PASS              | 使用合成 HTTPS 站点 origin，监控关闭；公开输出没有 maps，不需要上传凭证                         |
| `pnpm test:pages`                                                          | PASS              | 13 tests，覆盖 allowlist、cookie、HTML fallback 与健康 503                                      |
| `pnpm test:pages:runtime`                                                  | PASS              | 两个实际 _worker.js 在 workerd 中透传 ready 200/503，拒绝 HTML200，无缓存                       |
| `pnpm test:pages:browser`                                                  | PASS              | Chromium、两站 HTTPS、真实 controller；健康 200/503/HTML502，cookie/refresh/logout 保留         |
| `pnpm test:observability:build`                                            | PASS              | 2 tests：启用门禁、上传失败与成功后移除 maps                                                    |
| `pnpm test:observability:runtime`                                          | PASS              | 3 tests：实际 Debug ID、uncaught/rejection 100ms 限时退出，stdout/stderr 无 canary              |
| Android `app:compileReleaseKotlin --no-daemon`                             | PASS              | 完整生成原生工程的 release Kotlin 编译；有第三方弃用警告                                        |
| `pnpm test:observability:native`                                           | PASS              | 已编译 callback + 真实 Java SDK 磁盘 envelope cache 无 canary，保留允许的源码行                 |
| Android prebuild/release 不一致门禁                                        | PASS              | 对关闭配置工程设置启用 flag，Gradle 在构建配置阶段拒绝，没有发布产物                            |
| `pnpm test:observability:vercel`                                           | PASS              | 实际三函数、Node24、私有 topics、独立源码映射，未部署                                           |
| `pnpm --filter @slogan/api openapi:check` / api-client `generate:check`    | PASS              | 唯一合同无 drift                                                                                |
| `git diff --check` / OpenSpec strict                                       | PASS              | 当前 change 合法；不证明目标环境验收                                                            |

首次全量验证暴露的本次回归已修复：启动配置保留既有固定错误提示但不回显输入；健康池关闭支持重复 lifecycle 调用；新增测试的 TypeScript 类型已修正。首次 HTTP suite 曾出现 host-controls 的 ECONNRESET/401，独立复测及最终完整 HTTP suite 均通过，保留为稳定性观察点。

## 全仓既有门禁欠项

- `pnpm format:check` 报告 69 个本 change 之外的文件格式问题；与监控文件 allowlist 对比无重叠。
- `pnpm lint` 最终仍报告未修改的 `tests/e2e/mobile-safety-visual.e2e.spec.ts:5` 的 type-import 规则错误。构建输出已从 lint 中正确排除，monitor 文件 lint 通过。
- `pnpm deps:check` 被已有审计脚本对已安装 `@tanstack/react-query` 的禁止条目阻止；该依赖存在于基线 HEAD，监控未添加它。独立 dependency-cruiser 已通过。

没有替这些欠项或其他 change 宣称整仓 verification 通过，也没有为此改动业务实现。

## 未完成与下一步

| 任务                   | 当前证据                                                | 完成所需                                                                                                  |
| ---------------------- | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| 3.2 / 7.4 原生 release | Kotlin 编译、JVM 磁盘缓存 canary PASS                   | Android 实际受监控 release、签名/匹配符号、真机 JS/原生崩溃、离线缓存/重启补报、网络与正常离房            |
| 4.6 目标通知 adapter   | canonical JSON/Bearer sink、拒绝/持久重试/过期重领 PASS | 明确真实通知协议/endpoint 字段映射，必要时补最小 adapter；通用 sink 不能冒充 Better Stack 接入            |
| 5.1 / 5.2 定位产物上传 | Web/Nest/Vercel 产物、Node Debug ID 与门禁 PASS         | 受控启用构建实际上传、逐编译器匹配、凭证不入 bundle/runtime、真实平台源码定位；不能以关闭构建或假上传代替 |
| 7.1–7.6 目标环境       | BLOCKED，未启用外传/部署                                | 负责人确认环境、Sentry 组织及三项目、区域/留存/访问、预算/渠道/接收人、私有凭证来源、部署授权与设备       |

确认这些输入后，在授权隔离环境按 runbook 先迁移/健康/私有消费者，配置探活与心跳，播种，再启用已经上传定位产物的各端。验证实际通知、无用户请求时持续扫描、停链/恢复/reseed、关闭路径，并交付独立发布记录。账号配置、plan/budget/地区或接收人未确定时不购买服务、不修改远端、不读取现有供应商秘密。

回滚关闭 SDK/monitor 配置并重新构建对应客户端，停止独立扫描续接，保留 ObservabilityMonitorState、incident/outbox 与既有 realtime 事实；不执行破坏性 down migration。旧客户端是否停止发送需要 ingest 侧和真实设备验证。该 change 保持未归档。

</details>
