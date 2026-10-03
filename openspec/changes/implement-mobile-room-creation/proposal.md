## Why

移动房间发现页的“创建”入口仍被禁用。现有即时房间和预约房间 API 都已提供真实创建能力，用户无法在客户端使用。

## What Changes

- 按已确认 Figma 即时 111:979 和预约 121:3613 两张 390×844 页面实现房间创建表单。
- 接入 /v1/rooms 和 /v1/appointment-rooms 的生成客户端，提供主题、具体 CEFR、容量、密码、可见性、预约起止时间的校验和服务端错误反馈。
- 创建成功后进入真实房间；即时房间房主进入语音房流程，预约房间进入房间详情。创建按钮防止重复提交。
- 从房间发现页启用“创建”入口，记录浏览器预览、API 和设备证据边界。
- 预约房间详情允许房主在开始前取消；生成的分享链接经真实分享码解析后打开对应房间。

## Capabilities

### New Capabilities

- mobile-room-creation: 用户在移动端创建即时和预约房间。

### Modified Capabilities

无。房间业务规则及 API 沿用现有 OpenSpec/OpenAPI。

## Impacted delivery stages

- Prototype / Figma
- Frontend
- Test / Acceptance

## Impact

apps/mobile 路由、房间创建 feature、发现页按钮、文案与验证。无后端或持久层改动。
