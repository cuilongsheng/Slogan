## Why

Slogan 已有 Pino 脱敏日志、请求标识、依赖探测和持久告警基础，但缺少跨 Admin、Mobile、API 与独立消费者的线上错误定位，以及独立于应用进程的故障通知。公开运行时，客户端崩溃、语音连接失败和恢复扫描停止可能无法及时发现，现有本地验证也不能证明真实告警已送达。

## What Changes

- 使用 Sentry 云服务接入 Admin、Mobile 原生/Web、NestJS API、Vercel realtime 消费者及实际启用的独立 worker，统一环境、应用版本、构建标识和最小技术关联信息。
- 覆盖未处理异常，以及已经被全局过滤器、provider adapter 或 worker 捕获的非预期失败；区分预期业务拒绝、系统故障和重试中的暂时失败，控制重复事件与告警噪声。
- 将 JS source maps、原生符号和发布版本匹配纳入实际构建流程，验证线上事件可以定位源码；构建上传凭证不得进入客户端产物。
- 增加外部 HTTP 探活、关键调度心跳和持久命令超期告警，复用现有 incident/outbox 生命周期；监控调度与自动保留清理解耦，适配当前 Vercel 函数与队列拓扑。
- 增加语音连接、重连、异常断开和音轨订阅失败的最小技术观测，结合现有实时命令积压定位问题，不采集说话内容或新增产品分析数据。
- 为所有上报通道建立白名单与发送前清理，关闭 Session Replay、局部变量、任意附件、自动内容采集和首期自动性能 tracing；监控网络故障不得改变业务结果或队列重试语义。
- 建立真实发布包、目标环境告警送达、任务停止/恢复、隐私检查及关闭/回滚证据。

### Confirmed Scope

本次规划承接已讨论的第一阶段：错误定位、版本/源码映射、脱敏、外部可用性、任务停止与积压告警、语音关键失败观测。选择 Sentry 云服务作为错误平台，保留 Pino 与部署平台日志；不创建新的监控产品 UI。规划请求不授权购买服务、创建远程资源、修改远程环境或部署。

### Non-goals

- 不自建 Sentry、Prometheus/Grafana/Loki 全套平台，不替换现有数据库、队列或 LiveKit。
- 不录音、不保存转写、举报正文或私人内容，不引入 Session Replay、用户画像、行为分析或完整日志批量外传。
- 不新增后台监控页面、用户错误反馈界面或不同的错误 fallback；现有页面结构、视觉与交互保持原行为。
- 不启用自动保留清理，不调整治理策略、角色、房间权限、恢复扫描职责或持久命令业务语义。
- 不在本 change 补齐原有数据治理 change 的全部备份、保留、STT 删除证明与恢复演练验收。

### Roadmap

根据实际故障和用量，再通过独立 change 引入性能采样、跨服务 tracing、语音质量聚合、完整成功率分母和集中日志检索。

### Subsequent approved continuation (2026-10-15)

用户要求继续完成全部两阶段，并明确选择 Sentry 邮件通知当前账号、零付费升级；上传 token 尚未配置，本轮先完成代码及配置页面。承接已发布的 add-api-sentry-tracing，追加手动采样客户端 HTTP span、同源 API trace 关联及语音阶段/本地连接质量 span；不启用 Logging、Profiling、Application Metrics。跨端质量聚合基于 span，不宣称全量业务成功率。外部配置、真实源码上传及 Android 真机证据在输入就绪后补充，不以本地 transport 代替。

### Unresolved Decisions

- Sentry 组织、项目归属、数据区域、保留期、访问人员、告警接收人及预算由目标环境负责人确认；未确认前仅完成本地接入和隔离验收准备。
- 外部探活/心跳优先评估 Better Stack，最终服务和商业使用条款在远程启用前确认；不把免费额度写成长期保证。
- 独立监控采用 Vercel 私有队列消费者或常驻环境的独立 worker；目标账号允许的周期、预算及最小告警 sink 字段映射在启用前确认，不假定 HTTP 函数能维持常驻定时器。
- 当前 NestJS 12、Expo 57、React Native 0.86、Prisma 7、ioredis 6 与选定 SDK 的兼容性需要针对实际产物验证；不通过降级业务依赖来绕过。

## Capabilities

### New Capabilities

- `production-observability`: 定义多运行入口错误观测、源码定位、内容最小化、业务隔离、外部可用性与调度监控、语音失败诊断和真实告警验收。

### Modified Capabilities

## Impact

- Admin：`apps/admin/src/main.tsx`、API transport、Vite 构建及版本注入。
- Mobile：`apps/mobile/app/_layout.tsx`、应用初始化、API transport、`voice-room/mediaCore.ts`、原生连接实现、Expo/Metro/原生构建配置与 Web export。
- API：`src/infrastructure/observability/`、配置校验、全局异常过滤器、bootstrap、realtime 队列消费者与实际 worker 入口；新增最小健康探针，更新唯一 OpenAPI 生成结果与客户端。
- Operations：复用现有 incident、持久投递、只读依赖/积压探测；新增独立监控启用和调度入口，不能顺带启动治理删除任务。涉及的 `operational-alerting` 等能力仍在 `implement-operations-data-governance-backend` 活跃 change 内，本提案不把其规划当作已归档主规格，也不重复定义其 RBAC/生命周期。
- 部署：Pages 两端的实际构建路径、Vercel API/私有队列函数、选定的外部探活/心跳、最小通知 sink、CI/构建秘密注入与 runbook。新增小型 additive 监控调度状态迁移，用于跨函数的连续失败、窗口去重与恢复状态。
- 新依赖以 `@sentry/react`、`@sentry/react-native`、`@sentry/nestjs` 及对应构建工具为限；版本在兼容验证后固定，不新增 framework-dependent shared package。

## Impacted delivery stages

- Architecture
- Backend / API
- Frontend
- Test / Acceptance
- Deployment
