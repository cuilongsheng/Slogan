## Why

本人房间/预约历史与私人会后笔记已有服务端能力，手机端仍没有页面。用户无法回顾参与记录或在房间结束后记录自己的学习内容。

## What Changes

- 个人入口增加房间历史，区分实际参与与仅预约，支持刷新和服务端分页。
- 对实际参与且已结束的房间提供私人笔记读取、保存、清空与版本冲突处理。
- 用户已允许无独立高保真帧的页面沿用已确认 V2 视觉语言。

## Capabilities

### New Capabilities

- `mobile-room-history-notes`: 手机端本人历史与私人会后笔记流程。

### Modified Capabilities

无。后端 `room-history-notes` 现行规范保持不变。

## Impact

- `apps/mobile` 个人入口、路由、历史/笔记 feature、文案与测试。只使用现有 OpenAPI，不变更数据库、权限或房间实时会话。
