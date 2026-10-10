## Why

后端已提供参与者可读的会后关键词汇总和个人词汇 API，手机端却没有对应入口。用户无法查看生成状态，也无法自主保存和管理学习条目。

## What Changes

- 房间历史中为已结束且实际参与的记录提供会后关键词入口，显示 `DISABLED/PENDING/READY/UNAVAILABLE` 状态。
- `READY` 汇总逐条手动导入个人单词本，重复请求使用同一幂等标识。
- 个人入口增加词汇列表，支持服务端分页、类型/收藏筛选、编辑文本和备注、收藏及删除，版本冲突不静默覆盖。
- 无独立高保真帧，按用户确认沿用 V2 样式。

## Capabilities

### New Capabilities

- `mobile-post-room-learning`: 手机端会后关键词及个人词汇管理。

### Modified Capabilities

无。只消费当前 OpenAPI；不修改服务端生成和权限规则。

## Impact

`apps/mobile` 个人入口、历史入口、学习 feature、路由、文案、测试及本地视觉证据。
