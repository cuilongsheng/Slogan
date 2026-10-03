## Why

`implement-mobile-room-discovery-join` 目前只完成发现和入房前准备；用户通过设备检查后仍无法实际加入语音房。要让两名用户完成真人英语交流，需要把现有 membership、实时凭证和 LiveKit 音频连接接成可恢复的移动端会话。

## What Changes

- 将设备检查后的主操作接到真实加入请求、实时凭证获取和语音连接；成功后展示 Figma `02 UI / Voice Room / Pilot V2 · review` 所定义的房间主体。
- 初始麦克风保持静音，用户主动切换；显示当前成员、房主、说话与麦克风状态，并提供退出、重连和房间结束反馈。
- 对加入竞争、密码错误、房间结束、权限失效、凭证失败、实时连接中断及页面刷新给出明确恢复路径；不把临时密码或实时凭证写入 URL、持久化存储、日志。
- 本批不实现创建房间、邀请、房主移除/延长、AI 辅助、语音翻译、敏感语音识别、房间笔记或聊天；设计中的这些入口只在另行交付后启用。

## Capabilities

### New Capabilities

- `mobile-voice-room-session`: 移动端从已确认的入房准备进入真实语音房、默认静音、呈现连接及成员状态、退出和结束恢复的客户端行为。

### Modified Capabilities

无。

## Impact

- 移动端 `apps/mobile`：房间路由、认证 API 适配、LiveKit Web/原生客户端、界面及会话状态；需要 Expo development build，不能只用 Expo Go。
- 合同：复用 `openapi/openapi.yaml` 的 `POST /v1/rooms/{roomId}/memberships`、`POST /v1/rooms/{roomId}/realtime-credentials`、`GET /v1/rooms/{roomId}/members`、`POST /v1/rooms/{roomId}/leave` 与现有房间详情；若成员展示字段不足，先按合同真实字段呈现，不渲染虚构头像。
- 设计：Figma Desktop Bridge 原稿 `115:1425`、重连 `114:2511`、结束 `114:2512`；用户已确认高保真设计。
- 验证：API/会话测试、双端构建与页面截图、两账号真实 LiveKit 音频及断线/退出设备验收分别记录；本地模拟连接不能冒充真实双人音频证明。
