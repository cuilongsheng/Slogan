## Why

房主移除、重邀、退出移交和断线接任需要依赖可信的实时在线状态，但不应与 LiveKit 凭证、Webhook 和 provider 基础设施混在同一个实施单元。按产品所有者确认，将原 LiveKit 提案中的成员生命周期和房主管理拆为独立 change，在实时基础完成后逐项实现与验收。

## What Changes

- 提供普通成员主动离开与重新加入；释放容量，重新进入时排到当前麦位末尾。
- 实现房主移除成员、重新邀请与旧凭证阻断；邀请仍受账号、房间和容量约束，不预留席位。
- 实现房主主动退出：指定在线接任者，或按当前在线成员加入顺序默认接任；无接任者则结束房间。
- 实现房主异常断线的 60 秒重连窗口：现有成员继续交流和恢复会话，暂停新加入；按时恢复保留房主，超时移交或结束。
- 提供房主主动结束接口，复用前置 change 的结束状态机、撤销和清理流程。
- 在服务端校验当前房主，原子保存领域状态、管理审计和 provider command，并覆盖并发、重复请求、迟到事件与失败补偿。

### Confirmed Scope

- 实现 current `host-controls` 的后端规则及 `basic-safety-reporting` 中对应管理动作审计与服务端权限；保留已确认的普通成员重进末位、断线窗口暂停新加入和到期无宽限规则。
- 依赖 `implement-livekit-voice-session-backend` 的已验证实现。该前置 change 当前仍是计划，不把目录存在或任务文件存在视作依赖完成。
- 本 change 拥有 leave、removals、invitations、host end 四个新 endpoint；扩展既有 join、成员列表和凭证授权。凭证签发、成员查询的基础 endpoint、Webhook、provider adapter、审计/outbox 基础、到期清理由前置 change 唯一实现。
- 本次仅批准规划拆分；两个 change 分别审阅、apply、验证。身份与认证 change 尚未完成的验收项保留原归属，不在这里自动接受或归档。

### Non-goals

- 不新增第二套 LiveKit adapter、Webhook、Redis queue、审计表或结束状态机。
- 不实现 Figma、前端管理面板、在线成员选择器 UI、移动端设备权限或音频验收。
- 不实现举报提交、安全员处罚、录音、转写、账号会话中途限制的自动处置或生产部署。

### Future Roadmap

- 本 change 之后独立推进 `implement-safety-reporting-backend`。
- 前端按确认的 Figma 接入管理接口，补充双设备、断线和实际音频证据。

### Unresolved Decisions

- 无阻塞本次拆分的产品决策。LiveKit Cloud 旧凭证撤销能力仍需前置 change 的真实 provider smoke 证明，不因拆分变为已验证。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `host-controls`: 将原 LiveKit delta 中普通成员离开后重新进入排在末位的规则移入本 change；其他既有房主规则直接实现，不重复改写需求。
- `voice-session`: 将原 LiveKit delta 中房主重连窗口允许已有会话继续、暂停新加入的规则移入本 change；房间到期结束规则仍归 LiveKit delta，两个 change 不修改同一 Requirement。

## Impact

- Impacted delivery stages: Architecture、Backend / API、Test / Acceptance。
- 影响 `apps/api/src/modules/rooms` 的 lifecycle、房主 policy、公开 application API、repository、Controller/DTO，及 `voice` 已有事件/worker 编排的房主管理接入。
- 以独立 additive migration 增加成员离开/移除/邀请状态和房主断线 deadline/version；复用前置 RoomEvent、RealtimeCommand 和 provider identity 历史。
- NestJS code-first 生成 `openapi/openapi.yaml`，保持唯一 contract；新增管理错误与响应、join/rejoin 和成员投影行为均有 contract 验证。
- 实施顺序：LiveKit 基础实现并交付依赖证据 → 本 change → 安全举报。可分别评审和验证；未完成房主管理前，实时基础仅供受控联调，不作为完整语音房产品发布。
