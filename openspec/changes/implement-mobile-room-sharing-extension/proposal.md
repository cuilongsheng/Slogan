## Why

即时房间详情和预约详情已有稳定分享 URL，但没有可执行的分享动作；语音房也没有房主延长时间入口。现有分享解析和延长 API 已可用，用户仍无法从手机端完成这两个房间操作。

## What Changes

- 在即时/预约详情及语音房提供真实分享动作，Web 复制链接，原生调用系统分享面板；失败保留可选中的 URL。
- 在语音房为当前房主提供延长 15/30/60 分钟的确认流程，提交稳定请求标识，成功后重取服务端房间结束时间并展示实时同步状态。
- 不在预约未开放、已结束或非房主状态呈现延长命令；服务端仍最终验证权限和次数上限。

## Capabilities

### New Capabilities

- mobile-room-sharing-extension: 房间分享操作与语音房延长时间入口。

### Modified Capabilities

无；规则沿用 room-discovery-sharing 与 room-time-extension。

## Impacted delivery stages

- Frontend
- Test / Acceptance

## Impact

`apps/mobile` 房间详情、预约详情、语音房 API 和文案。无后端合同或数据库改动。现有 Figma 语音房和详情页面未单独覆盖延长/分享操作态，沿用已确认页面视觉语言并记录差异。
