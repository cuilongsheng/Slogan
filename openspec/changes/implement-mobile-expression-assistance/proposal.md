## Why

语音房的表达辅助入口仍显示“后续开放”，但当前 OpenSpec 和 OpenAPI 已规定文字、短语音、同意和私人结果。用户无法使用已实现的后端能力。

## What Changes

- 将语音房表达辅助入口接入文字与最长 30 秒的短语音输入，按 V2 的开始、聆听、英文结果三张 390×844 设计稿还原语音弹层。
- 首次音频处理显示明确用途同意，每次音频提交再次确认；文字输入不要求语音同意。结果只在请求者本机显示，不自动播放或发布到房间。
- 增加当前音频说明版本的只读 API 字段，让客户端能提交当前版本而无需复制服务端配置。
- 对权限、额度、provider 失败和网络重试给出可恢复状态；录音前关闭房间麦克风，避免私人输入被同时广播。

## Capabilities

### New Capabilities

- mobile-expression-assistance: 语音房私人文字/短语音表达辅助界面。

### Modified Capabilities

- temporary-speech-processing: 同意状态公开当前说明版本。

## Impacted delivery stages

- API contract
- Frontend
- Test / Acceptance

## Impact

影响 `apps/mobile` 语音房和录音服务、`apps/api` 同意响应 DTO、`openapi/openapi.yaml` 与生成客户端；无数据库迁移。原生设备和真实 AI/STT provider 需单独验收。
