## Why

后端已提供本人限制历史与限时申诉 API，手机端没有入口。受到临时限制的用户无法在应用内看到原因、截止时间或提交申诉。

## What Changes

- 在手机端个人入口增加“我的限制与申诉”，读取本人限制和稳定分页历史。
- 对仍在窗口内且尚未申诉的临时限制显示理由输入与提交，展示待处理/维持/解除结果及服务端错误。
- 沿用已确认 V2 组件、色彩和页面密度；本页无独立高保真帧，用户已授权按 V2 视觉语言实现。

## Capabilities

### New Capabilities

- `mobile-safety-appeals`: 手机端本人限制查看和一次限时申诉交互。

### Modified Capabilities

无。现有 `safety-restriction-appeals` 后端行为保持不变。

## Impact

- `apps/mobile` 路由、个人入口、API feature、文案和测试。使用现有 `/v1/me/safety-restrictions` 与 `/{restrictionId}/appeal`，不变更数据模型或 OpenAPI。
