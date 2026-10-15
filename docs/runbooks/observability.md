# Slogan 监控运行手册

适用 change：`add-production-observability`。所有监控默认关闭；本地接入、替身 transport、真实 SDK 缓存及隔离 Vercel 构建均不证明真实云端通知或真机验收。

## 入口与配置

入口、构建与原 change 依赖见 [入口矩阵](../acceptance/add-production-observability/entry-matrix.md)。配置键见 [空值模板](observability.env.example)，真实值在指定私有配置源中提供，不提交仓库或粘贴到验收记录。SDK 错误项目为 admin、mobile、api；HTTP/消费者/worker 的 service 区分在各入口初始化。Node 入口在 SDK 初始化前读取与现有 Nest 配置相同的 env 来源；测试使用显式隔离环境。

Sentry 云服务 DSN 是公开 ingest 标识。上传凭证只在构建上传步骤使用。记录目标组织/项目、数据区域/保留、访问人、预算、接收人、部署 SHA 与各端 build；这些输入未确认时不启用外传。原生 Android 使用 Expo config plugin 生成 native 早期初始化和净化回调；iOS native 保持未启用，实际发布前需同等缓存与崩溃验证。

## 错误与隐私

预期业务拒绝与取消不产生错误告警；非预期错误与 provider 系统故障使用固定类别。所有 SDK 出站事件重建白名单，保留环境、服务、平台、release/build、合法 UUID requestId、固定阶段、耗时与允许的代码帧。后台受保护路径只输出固定事件名/关联/结果码；不保存 stack。禁止内容、用户身份、请求/响应、凭据、SQL/参数和任意 extras/附件。

Replay、自动 tracing/profiling、批量日志、局部变量与自动内容采集关闭。原生 scope persistence、NDK/memory dump、截图、view hierarchy 与自动 breadcrumbs 关闭；结构化 Java/Kotlin 崩溃经 native before-send 重建后才缓存。`pnpm test:observability:native` 使用已编译 Android callback 和真实 Java SDK envelope disk cache 验证 canary；此 JVM 证据不替代真机崩溃/重启测试。

## 健康与外部探测

- `GET /v1/health/live`：200 / `{"status":"ok"}`。
- `GET /v1/health/ready`：核心 PostgreSQL 在限时连接/查询内就绪为 200 / `ready`，失败为 503 / `not_ready`。探针不带依赖明细，并有 no-store 和独立限流。
- 外部检查公开 API、两个 Pages 页面及其同源 `/v1/health/ready`。检查状态和 JSON 内容；Pages 的 HTML fallback 转为失败。详细 operations health 保持后台权限。
- 默认建议外部每 3 分钟检查，连续 2 次失败/恢复通知；实际计划支持周期和接收人需记录并验证。

## 调度与告警

托管环境使用私有 `slogan-observability` 队列及 `api/observability` 消费者；常驻环境运行 `pnpm --filter @slogan/api start:monitor-worker`。每个环境只运行一种 owner。监控不会调用综合治理 runOnce，也不启动 retention/清理或开放治理写权限。已有治理 worker 可以继续履职，其重复依赖/积压观察在独立监控开启时由监控 owner 接管；持久 outbox 的领取仍有 lease/fencing。

默认扫描 60 秒，租约 45 秒；固定窗口键与持久状态保存连续失败、最近完成和下一窗口。依赖默认 3 个确认失败窗口产生 incident，恢复关闭同一指纹；旧窗口/旧租约不会重复累计。未来才到执行时间或仍有有效执行租约的实时命令不算积压；没有明确 deadline 的到期未完成命令使用 120 秒年龄阈值。provider 根路径 HEAD 成功只记 readiness unknown，401/403 和真正不可达明确区分，不发送真实内容或短信作探测。

首次启用在已授权目标注入队列需要的服务身份后运行 `pnpm --filter @slogan/api observability:seed`。相同环境/周期/窗口使用相同 idempotency key；重播种使用同一命令。扫描完成并可靠续接下一窗口后才发送 monitor heartbeat；realtime 完成扫描和续接后发送独立 heartbeat，停掉用户请求也必须继续。初始 monitor 宽限 180 秒，realtime 空闲扫描 300 秒时宽限 720 秒；其他实际启用 worker 只在职责成功完成后发心跳，每进程至少间隔 60 秒。

扫描链或平台停止由外部 heartbeat 发现。平台恢复后检查实际 consumer/持久状态并受控 reseed；不靠新的用户请求启动，也不自动更改房间状态。队列保留期与平台费用有上限，不能承诺无限免费或停机后无条件恢复。

通知 sink 默认接收 Bearer 鉴权的 canonical JSON：status、component、category、severity、scopeType、reasonCode、firstObservedAt。第三方通知配置需提供支持该协议的适配端点；Sentry 错误告警和外部探活分别在对应平台配置。sink 故障保留持久投递并按既有策略重试；完全 DB 故障靠外部 ready/heartbeat。新错误默认每服务最多 30 次/分钟，incident 冷却使用既有 300 秒配置；不启用百分比/每帧音频事件告警。

## 构建与源码定位

先按 `.nvmrc` 激活 Node。两端 Pages 使用原有 `build:pages:admin`/`build:pages:mobile`，启用监控时注入实际 Git SHA 与 build 并要求上传配置；Admin 使用 Vite plugin，Mobile Web 使用 Expo source-map uploader。上传成功后移除公开 maps；上传失败阻止该监控发布。普通关闭监控的构建不需要上传凭证。

Nest 构建与上传使用 `pnpm build:observability:api`。Vercel 实际函数产物须在 `vercel build` 之后执行 `pnpm build:observability:api <实际函数输出目录>`，再发布这些已注入文件；不能拿 Nest dist 的 maps 代替独立函数的 maps。上传与 inject 排除 `node_modules`，保留应用源文件的定位产物。

Android 使用 `pnpm build:observability:android` 固定实际 Git SHA、执行 prebuild 和 Gradle release，官方 Sentry Gradle 步骤负责匹配的 JS maps。prebuild 中的启用状态、release/build/DSN 必须与 release 配置一致；启用时缺少上传配置或环境不一致会拒绝构建。SDK 路径与 JDK 通过构建环境注入。当前 release 未开启 R8，因此 Java/Kotlin 结构化崩溃用源码文件/行；启用 R8 时需要匹配 mapping 上传验收。持续音频 C++/NDK dump 不在首期启用通道。

上传 token 只在这些步骤注入，之后的客户端产物、function runtime、镜像和通知均不可携带它。真正发布需固定已提交 SHA；工作区本地构建只记作本地证据。OTA 当前未启用，将来引入时需独立验证 update/build 与 maps 的匹配。

## 验收与关闭

本地运行隐私/分类、配置、filter、健康合同、PostgreSQL 阈值/重复/重启/fencing、独立扫描、sink、Pages 与构建门禁测试，再完成一次受影响范围完整检查。受控故障只在测试 harness、隔离发布环境或设备中触发，不向公开产品新增 throw 接口/按钮。

`pnpm test:observability:runtime` 验证真实 SDK transport、Debug ID 和无内容的进程致命异常/拒绝退出；`pnpm test:observability:build` 验证上传失败与 map 清理顺序。`pnpm test:observability:vercel` 在临时目录、空平台配置与隔离依赖下运行固定版本编译器，不复制 `.env`、不部署，验证公共 API 与两个私有消费者的实际 handler、topic、Node runtime 和 maps。`pnpm test:observability:native` 需要先编译 Android release Kotlin callback，并使用实际 Java SDK 磁盘缓存。所有 canary 都属于验收 harness。

真实验收必须确认接收人收到通知、发布事件能定位源码、停扫描后窗口内报警、恢复/reseed 正常、监控 timeout/拒绝不影响已提交业务及任务重试，并完成 Android 真机崩溃/缓存/重启/重连。证据和待验证项保存在 `docs/acceptance/add-production-observability.md`；真实发布另记 `docs/releases/`。

关闭先停独立监控续接/consumer 或常驻 monitor，再关闭 SDK 外传配置并重发 Web/native 构建。旧安装包需要 ingest 侧禁用/限流以停止发送。保留技术状态表、原 incident/outbox、realtime 主题和待处理业务命令；不执行 down migration，不重置治理 flag、不删除业务事实。恢复时使用受控幂等 reseed。
