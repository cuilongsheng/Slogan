## Why

好友、屏蔽、临时空闲与本人房间邀请已有后端和 OpenAPI，但手机端目前只在房主管理操作中使用部分候选列表，普通用户无法管理关系或处理收到的邀请。

## What Changes

- 个人页提供好友、可邀请用户、好友请求、屏蔽和收到的房间邀请入口。
- 使用本人授权和服务端分页，社交命令保留可安全重试的 UUID。
- 收到的邀请进入现有房间详情/准备流程，拒绝操作不绕过房间资格。
- 用户允许没有独立高保真帧的页面沿用 V2 样式。

## Capabilities

### New Capabilities

- `mobile-social`: 手机端关系与房间邀请处理。

### Modified Capabilities

- `friend-relationships`：本人待处理好友请求列表增加对方当前公开昵称（可为空），使接收方能识别请求；不扩展关系或可见范围。

## Impact

`apps/mobile` 个人入口、社交路由/feature、文案、测试和验收记录；`apps/api` 好友请求最小展示字段、OpenAPI 与生成客户端。不改变后端关系权限。
