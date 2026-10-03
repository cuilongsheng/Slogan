## Why

手机语音房只能查看成员和直接退出。已实现的房主移除、重新邀请、接任选择、普通邀请及成员举报 API 没有可用前端入口。

## What Changes

- 按已确认 Figma 成员页和操作覆盖稿提供房主成员管理、邀请与退出接任选择。
- 按举报覆盖稿提供真实成员举报、类别及说明校验和服务端受理结果。
- 操作保留语音会话、显示服务端权限/冲突错误，并更新成员与房间状态。
- 为已认证的当前房间成员在成员响应中补充目标用户 ID，以提交现有举报 API。
- 提供仅房主可读的本房间已移除成员列表，使刷新后仍可使用现有重新邀请接口。

## Capabilities

### New Capabilities

- mobile-room-controls-reporting: 语音房内成员管理、邀请、接任和举报入口。

### Modified Capabilities

无；业务约束沿用 host-controls、room-invitations、basic-safety-reporting。

## Impacted delivery stages

- Prototype / Figma
- Frontend
- Test / Acceptance

## Impact

apps/mobile 房间 API、语音会话与覆盖层；apps/api 成员 DTO 及生成的 OpenAPI/客户端。无数据迁移。
