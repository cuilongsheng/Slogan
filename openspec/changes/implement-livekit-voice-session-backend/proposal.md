## Why

即时房间已提供认证、准入、容量与持久 membership，但还没有 LiveKit 凭证、可信在线状态和可恢复的实时清理能力。先建立实时基础，再由独立的 `implement-host-controls-backend` 接入成员生命周期与房主管理，便于分别评审和验证。

## What Changes

- 为符合资格的现有成员签发短期、限定房间和 opaque identity 的 LiveKit Cloud token，仅允许订阅和麦克风发布。
- 提供当前成员查询与 presence 投影，接收验签后的 LiveKit webhook，防止重复、迟到事件覆盖当前授权事实。
- 建立 LiveKit token、room、participant、webhook adapter，以及 PostgreSQL 审计、事件幂等和 durable command/outbox。
- 引入 Redis/BullMQ 的重试、到期调度与启动/周期 reconciliation；房间到 `endsAt` 时立即禁止加入/发证，通过撤销 identity 与删除 provider room 完成清理，不设置宽限。
- 提供可复用的结束/撤销基础能力，供后续房主管理调用；本 change 的结束触发来自到期或经过校验的 provider room-finished。

### Confirmed Scope

- 实现 current `voice-session` 的后端实时基础与到期结束，以及 `basic-safety-reporting` 中实时凭证、连接事件审计和相应服务端权限。
- 使用 LiveKit Cloud；opaque identity 不包含个人资料。Cloud 撤销行为沿用原设计目标，必须用真实 provider smoke 验证。
- PostgreSQL 保存授权、presence 观察、事件与待执行命令；Redis 只做任务协调。NestJS code-first 生成唯一 `openapi/openapi.yaml`。
- 本 change 唯一新增三个 endpoint：realtime-credentials、members、webhooks/livekit。已有 join 的资格/容量规则保留，并接入到期状态一致性。
- 后续 `implement-host-controls-backend` 依赖本 change 的公开 application API、provider adapter、队列、审计/outbox 与结束状态机。完整语音房发布前还需要房主管理和前端/设备验收；本基础阶段只供受控联调。

### Non-goals

- 成员主动 leave/rejoin、REMOVED/INVITED 状态、踢人重邀、房主退出移交、60 秒房主断线窗口、窗口内暂停新加入和 host end endpoint 全部移交给 `implement-host-controls-backend`。
- 不实现移动端 LiveKit client、默认静音 UI、选择器、设备权限、Figma 或 generated frontend client。
- 不实现录音、完整转写、STT、公开回放、举报或安全员处罚；不执行生产部署及控制台配置。
- 不支持未经单独验证的 self-hosted provider 撤销语义。

### Future Roadmap

- 下一步按独立 change 实施 `implement-host-controls-backend`，再推进 `implement-safety-reporting-backend`。
- 前端与真实双设备验收、发布环境 smoke 和部署记录分别跟随后续 delivery 工作。

### Unresolved Decisions

- 暂无阻塞本次拆分的产品决策。原已确认的房间到期无宽限保留在此；普通成员重进末位及房主断线窗口行为的需求文本整体迁入房主管理 change，不撤销这些决定。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `voice-session`: 明确房间到既定 `endsAt` 时立即结束、断开并拒绝旧凭证，不设置宽限。delta 保留既有“房主结束房间”场景；其主动触发入口由后续房主管理实现，此处只交付复用基础及到期触发。

## Impact

- Impacted delivery stages: Architecture、Backend / API、Test / Acceptance。
- 影响 `apps/api/src/modules/voice`、`rooms` 公开 application API、`infrastructure/livekit`、Redis/BullMQ、Prisma models/migrations 与 API 测试。
- 新增 `livekit-server-sdk`、`ioredis`、`bullmq` 及条件环境配置；只保留实时基础所需字段、状态和迁移，房主 deadline 与成员离开/移除 lifecycle 由下一 change 单独迁移。
- 原 34 项混合任务重新按两个 change 的所有权拆分，未执行任务继续保持未完成；当前 main specs 和历史 PRD 不在本次拆分中改写。
