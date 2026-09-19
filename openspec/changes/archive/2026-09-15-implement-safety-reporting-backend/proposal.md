## Why

当前房间后端已有加入关系，但没有可提交和追踪的举报记录。需要把成员的举报保存为独立事实，并关联关键房间事件；成员离开、被移除或房间结束后仍能举报，避免举报资格随房间状态消失。

## What Changes

- 新增经过身份认证的基础举报提交接口，保存房间、举报人、被举报人、服务端提交时间、类别和文字说明，返回最小提交凭据。
- 允许当前与历史成员举报曾加入同一房间的其他成员；双方是否曾加入由服务端持久 membership 验证，不能靠客户端声明或 LiveKit 在线状态决定。
- 采用五个固定类别：骚扰辱骂、歧视仇恨、色情低俗、垃圾广告、其他。
- 举报记录与举报提交审计原子保存，支持同一次请求的安全重试；举报内容不进入普通日志或通知其他成员。
- 补齐唯一 OpenAPI contract、迁移验证、权限与并发测试，以及后端验收记录。

### Confirmed Scope

- 用户于 2026-09-12 确认本次先创建提案，范围为举报提交、持久化、权限校验与举报审计；同时确认历史成员举报和上述五个固定类别。
- 历史资格包括已主动离开、已被移除和房间结束后的成员。身份认证继续遵循现有有效会话与账号状态规则，不改变登录或账号限制策略。
- 举报仅记录用户陈述，不认定违规、不执行处罚；房主与普通成员遵循相同举报规则。
- 实施细节提议采用 UUID 请求标识、有限长度文字说明、服务端时间和同事务审计，随本提案一起评审。

### Non-goals

- 不实现移动端举报入口、Figma 页面、管理员或安全员界面、举报查询/修改/撤回接口、案件分配、处理状态流转或举报通知。
- 不实现处罚、封禁、屏蔽、账号限制、房间禁用/恢复、申诉、STT 风险识别、录音或完整转写。
- 不重复实现房主管理、实时凭证、成员生命周期或 LiveKit webhook。
- 不执行生产部署、数据清理策略或最终移动端/真机验收。

### Future Roadmap

- 后续独立 change 决定后台受限查询与处理流程、反滥用限流参数、数据保留和删除策略；历史 PRD 中的这些方向不在本次转为当前要求。
- 前端 change 负责举报入口、历史成员选择与提交反馈，依照 Figma 和本次生成的 OpenAPI contract 实施。

### Unresolved Decisions

- 当前提交闭环没有待确认的业务选择。保留期限、举报频率限制和审核流程属于后续范围，不在本次设定默认业务规则。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `basic-safety-reporting`：明确历史成员资格、固定类别、服务端身份与时间、幂等提交、举报与审计原子保存及私密响应边界；保留已有房间事件和实时凭证要求。

## Impact

- Impacted delivery stages: Architecture、Backend / API、Test / Acceptance。
- 主要影响 `apps/api/src/modules/moderation`、rooms 的公开举报资格查询、audit 的事务写入边界、Prisma model/migration、日志安全测试及 `openapi/openapi.yaml`。继续采用 NestJS code-first 确定性生成唯一 contract。
- 新增 `POST /v1/rooms/{roomId}/reports`；无需新增外部服务或运行依赖，不调用 LiveKit/Redis 处理举报。
- 实施顺序为 `implement-livekit-voice-session-backend` → `implement-host-controls-backend` → 本 change。LiveKit 提供 RoomEvent 和实时基础，房主管理提供保留历史 membership 的离开、移除、重邀与管理审计；两者当前仍是待实施提案，不能把规划文件当作已交付依赖。
- 提案可以先评审；apply 前必须验证前置代码、迁移与后端测试已就绪。若其实际公开接口与本设计不同，先协调本 change 的接口设计，不借本 change 补做整套实时能力。
- 本次只创建规划文件，不同步主 specs、不修改业务代码、不归档或声明已部署。
