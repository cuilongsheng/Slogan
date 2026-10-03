## Why

完成资料后的移动端目前只显示占位页，用户无法浏览真实房间或查看加入条件。已确认的房间列表及入房前页面需要接入现有房间 API，才能让下一批语音房工作建立在可运行的发现流程上。

## What Changes

- 把合格用户的默认入口改为公开即时房间列表，提供真实加载、空列表、错误、刷新、分页和房间详情状态。
- 按已确认设计实现详情、4 位密码输入、房间规则主动确认及设备检查页面；输入与确认状态只在当前流程中保留，切换房间时清除。
- 房间列表和详情只展示现有合同返回的事实。设计中的总房间数、成员头像预览、房间语言筛选及入房前成员清单缺少对应合同，不以静态样例填充。
- 本批不创建 membership、不请求实时语音凭证；设备检查页明确说明实际入房将在语音房流程接通后开放，避免占用房间名额却无法通话。

## Capabilities

### New Capabilities

- `mobile-room-discovery-join`: 定义已登录合格用户的移动端房间发现、详情与入房前检查流程及缺失能力的可见边界。

### Modified Capabilities

无。

## Impact

- 移动端 Expo Router 的合格用户入口、`room-discovery` feature、认证请求入口、i18n、语义样式和必要的设备权限适配。
- 复用现有 OpenAPI `GET /v1/rooms`、`GET /v1/rooms/{roomId}`；不修改后端合同或持久层。
- Figma Desktop Bridge 已确认 `02 UI` 列表 V2 `115:1197`，详情 `111:1026`，密码 `111:1071`，规则 `114:2508`，设备检查 `114:2509`，均为 390×844。

## Impacted delivery stages

- Prototype / Figma
- Frontend
- Test / Acceptance
