## Why

房间安全语音后端已提供仅当前房主可读的最小提醒查询及 LiveKit 定向事件，但手机语音房尚未接入。房主在线时看不到提醒，重连后也无法补齐，真实设备验收因此无法进行。

## What Changes

- 启用敏感语音识别的房间内，仅当前房主显示风险提醒入口和最小提醒列表。
- 校验版本化 LiveKit 定向事件后向服务端查询最新提醒；入房、重连和房主接任时补齐，列表支持游标翻页。
- 房主身份失效、离房、结束或服务端拒绝访问时立即清除客户端提醒；所有提醒只提示人工核实，不自动处置。
- 沿用已确认的手机语音房 V2 视觉语言增加提醒状态；原始语音、转写和命中原文不进入客户端状态或日志。

## Capabilities

### New Capabilities

- `mobile-room-safety-alerts`: 手机语音房当前房主的最小风险提醒和恢复行为。

### Modified Capabilities

无。复用现行房间安全语音规范与唯一 OpenAPI 合同。

## Impact

- `apps/mobile/src/features/voice-room/`：HTTP 客户端、LiveKit 事件、会话状态、房主界面与测试。
- `docs/acceptance/`：视觉、本地运行与外部设备边界。
- 不改变后端接口、数据库、风险规则或投递权限。

## Impacted delivery stages

- Prototype / Figma
- Frontend
- Test / Acceptance
