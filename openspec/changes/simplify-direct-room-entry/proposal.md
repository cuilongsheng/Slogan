## Why

用户明确要求点击房间即可加入。当前详情、规则、设备检查三个固定页面使普通入房反复确认，且入房默认静音并不需要提前录音检查。

## What Changes

- 普通房间卡片直接进入语音房并执行实际加入；取消固定详情、规则勾选和设备检查路径。
- **BREAKING** 不再把单独的规则确认页面作为每次入房前提；保留房间内规则入口，点击加入表达入房意图，兼容现有 rulesAccepted 合同。
- 密码房只保留必要的密码输入；已有语音处理授权沿用，缺少授权时在当前入房状态提供必要的处理授权，不自动替用户同意。
- 入房保持默认静音；第一次开启麦克风时执行系统权限流程。失败有重试和返回列表入口。

## Capabilities

### New Capabilities

- `direct-room-entry`: 房间卡片的一次操作入房、必要条件和失败恢复。

### Modified Capabilities

- `localization-and-room-rules`: 取消单独入房前确认页面，保留房间内规则。

## Impact

移动端 room-discovery、voice-room 的导航、加入草稿与错误恢复。继续使用唯一 OpenAPI 和生成客户端，无迁移、凭据或供应商变更。后端自动部署配置说明属于既有部署记录，不新增部署拓扑。

## Impacted delivery stages

- Prototype / Figma
- Frontend
- Test / Acceptance
- Deployment

## Scope boundaries

确认范围来自用户 2026-10-09 的直接入房要求及现有提交/PR交付授权。密码、账号资格、容量和处理授权继续由后端校验；预约房间沿用预约语义。iOS、自动生产数据库迁移和供应商切换不在本次范围。
