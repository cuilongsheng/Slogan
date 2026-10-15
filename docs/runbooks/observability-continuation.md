# 两阶段监控续作配置

2026-10-15 用户选择：Sentry 邮件到当前账号、保持免费额度；后续明确要求直接完成 Sentry 配置，并单独授权创建上传 token。本文件不把配置准备当作云端/设备验收。

## 已配置

组织 tonycui 的 slogan-api（原 node-nestjs）、slogan-admin（React）、slogan-mobile（React Native）项目已统一启用邮件规则 `Slogan errors and recovery email`：捕获事件/issue activity、所有环境、指定当前账号、每个问题 5 分钟冷却。已通过 Sentry 的测试通知按钮生成测试 issue，并在当前账号 Gmail 中确认 `NODE-NESTJS-2 - Test Issue` 到达。此证据验证邮件渠道，不代替实际 API/消费者错误和源码定位。

已按用户单独授权创建组织 token `Slogan source maps`，权限为 `org:ci`（源码上传、release 和 code mappings）；值保存在仓库外 `/Users/cls/.config/slogan/observability/sentry-build.env`，目录权限 700、文件权限 600。没有升级付费计划。该权限用途参见 [Sentry 权限说明](https://docs.sentry.io/api/permissions/)。

## 待提供的私有输入

- 本机私有文件已准备。CI 运行时仍需把 token 保存为构建 secret；不要发到聊天，也不要把它设置成 VITE_/EXPO_PUBLIC_ 变量。
- SENTRY_ORG 为 tonycui；API 的当前 SENTRY_PROJECT 为 slogan-api（项目 ID 未变）。Admin/Mobile 项目分别为 slogan-admin、slogan-mobile；分环境 DSN/采样配置已保存为同一私有目录中的 admin-preview.env、admin-production.env、mobile-preview.env、mobile-production.env。不能在两个 Web build 中误用 API 的项目。
- 使用 `docs/runbooks/observability.env.example` 的空值模板。上传 token 仅在上传命令中使用；不要加到 Vercel 的通用函数运行时环境。新 prebuilt 流程在 compiler 和 deploy 子进程移除上传凭证，并在函数配置再次排除它们。
- Android 当前未连接真机；原生 release、离线缓存、崩溃后补报和真实网络切换要在设备连接后单独验收。iOS 原生收集继续关闭。

## 采样与内容边界

Admin 设置 VITE_SENTRY_TRACES_SAMPLE_RATE，Mobile 设置 EXPO_PUBLIC_SENTRY_TRACES_SAMPLE_RATE，默认均为 0.1，可设 0。API 继续使用 SENTRY_TRACES_SAMPLE_RATE。只发送 Error Monitoring + Tracing；Logs、Profiling、Application Metrics 和 Replay 关闭。语音连接质量以固定 excellent/good/poor/lost/unknown 等级的 span 耗时聚合，每次连接最多 20 次质量切换；它不是用户真实听音质量或完整业务成功率。

API 路由名称来自 OpenAPI schemaPath，不从实际 URL 提取。技术 trace header 只发往指定 API origin 的匹配 /v1 合同路径，去掉任意 baggage。带 header 的请求拒绝重定向，避免泄露给第三方；当前 OpenAPI 无 3xx 合同。Expo 57 默认 fetch 支持此策略；不能同时启用旧 EXPO_PUBLIC_USE_RN_FETCH 和采样追踪，初始化会拒绝该配置。

Mobile Web 与原生现在都经过相同故障和 trace 包装；Web 保留 credentials=include。错误与取消保持原结果，SDK 报错不重复提交变更请求。退出清理技术上下文，后台事件不带 stack。

## 真实产物上传及部署

必须从只含批准内容的干净 checkout 构建；当前混合工作区不能作为发布源。先激活仓库 Node/pnpm 版本。私有文件通过 Node 的 --env-file 参数注入，不在命令行填写 token 值。

```sh
source ~/.nvm/nvm.sh && nvm use
node --env-file=/private/path/sentry-build.env scripts/observability-readiness.mjs api
node --env-file=/private/path/sentry-build.env scripts/build-observability-vercel.mjs preview
node scripts/deploy-observability-vercel.mjs preview
```

为 API 明确设置 SENTRY_UPLOAD_SOURCEMAPS=true、OBSERVABILITY_ENVIRONMENT=preview 及 SENTRY_DSN。Vercel 项目须已正确链接并在安全工作目录准备平台 build 配置。脚本先构建 shared，然后使用实际 Vercel compiler 产物，逐个检查 index.func、realtime/monitor 等已存在的 Node24 函数；每个 handler 必须有自身 source map。上传步骤注入 Debug ID，完成后删除 maps、写入公共 release/dist 和完成 manifest；任一步失败都不能执行发布。发布校验器拒绝未完成、版本不匹配或函数集合发生变化的产物。真实上传必须从干净提交执行，执行结果另记验收报告。

旧 `build:observability:api` 只针对本地 Nest dist，不代表 Vercel；不能用其 maps 验收 Vercel。Web 沿用 build:pages:admin / build:pages:mobile，Android 沿用 build:observability:android；均在 token、项目和相应目标确认后执行。启用 source map 上传会向选定 Sentry 项目传输应用源码；产物与符号必须对应同一次构建。

## 持久告警与外部探活

设置 OPERATIONS_ALERT_SINK_KIND=sentry 后，现有 outbox 可以通过官方 SDK transport 把白名单技术通知发送到 Sentry，再由邮件规则通知账号；不需要额外运行时管理 token。只有 ingest 返回 2xx 才确认持久投递，429/拒绝/超时继续复用原 outbox 重试和 fencing。恢复用独立 OPERATIONAL_RECOVERY 事件表达；Sentry issue 不替代业务 incident 的状态真相。

现有 HTTP sink 仍可用，默认 kind=http。监控开关与自动治理/保留清理解耦；不要为告警开启治理删除。独立 observability topic、持久扫描状态和 heartbeat 已从并行 realtime 改动中隔离提交，可单独构建；尚未部署和播种。应用完全停止时必须靠外部 ready/heartbeat 发现，不能把 Sentry 错误邮件当作外部可用性监控。外部服务账号、免费额度允许的周期和私有 heartbeat URL 还未配置，本轮不注册付费服务或播种云端调度。

## 完成边界

本轮完成实现、可重复本地检查及现有 API 项目的邮件渠道配置。真实源码上传结果以追加验收证据为准；三端/消费者发布错误定位、外部探活/停链/恢复、Android 真机与关闭回滚仍保留在 OpenSpec 未完成项中。已部署 API 仍以单独发布记录为准，不把当前工作区或新增配置脚本算作已经上线。

## 费用核对

组织控制台实际显示 Business Trial 剩余 13 天，未绑定付款方式，各产品额外费用为 $0。没有提交 checkout、购买额度或启用付费功能；试用额度不能当作长期免费额度。长期使用遵守免费 Developer 额度，采样默认 0.1，不建立依赖试用权益的付费监控。

## 本轮隔离提交范围

本轮先提交可独立验证的客户端 Error Monitoring + Tracing、API 过滤兼容、Sentry 通知 sink 与源码上传门禁；不夹带当前工作区并行的字体/图标/房间/managed-queue 功能。health/monitor 持久调度、独立私有 observability 消费者、已有 worker 的错误与心跳现已从并行改动中单独整理。托管 realtime 业务消费者和房间功能继续留在原工作区，不能用本轮监控提交替代其验收。

三项目已在平台开启默认服务端脱敏、默认 scrubber 及新事件 IP 地址丢弃；minidump attachment 继承组织 Disabled。私有配置中的 API slug 已跟随实际控制台的 slogan-api，未重建 API 项目或更换 DSN。

隔离检查补充：独立 monitor 可只注册 api/observability 函数，不必携带 api/realtime 及其业务队列切换。唯一 OpenAPI 在隔离源重新生成，仅新增 live/ready 合同。启用持久扫描前仍必须先完成目标数据库迁移、外部 heartbeat 和实际费用/调度验证；当前不播种、不启用扫描。

## 2026-10-15 云端与发布核对

源码和真实上传版本以验收报告为准。实际 API 错误邮件已收到；Admin/Mobile Web 与 Vercel source maps 已上传，公开输出 maps 为 0。三项目新增删除 user 字段的服务端高级规则；新事件仍有平台推断的服务端出站 Geography，此规则未消除该字段，SDK 不发送终端用户 IP/身份。

最新 Vercel Production 为 7cbbab7，包含 5 个函数；本轮隔离监控源只有 2 个函数。不得用此产物覆盖较新的业务发布。先把监控整合进最新发布源并保留 realtime/maintenance/seed/live-updates，再用真实站点 origin 重建、迁移、分环境部署和验收。完整证据见 docs/acceptance/add-production-observability.md。
