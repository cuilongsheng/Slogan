## Why

V2 登录设计以用户名密码为主入口，但移动端目前仅有 Google 登录。现有后端已提供注册、邮箱验证、密码登录和找回接口；前端需要完成这些真实流程，同时保持 Google 登录与浏览器刷新会话安全。

## What Changes

- 按已确认 Figma V2 实现登录、注册、待验证邮箱、找回与重置密码页面及对应输入、加载、错误、成功状态。
- 接入唯一 OpenAPI 合同的邮箱认证接口；网页密码登录使用与 Google 相同的 HttpOnly refresh Cookie，原生端使用 SecureStore。
- 保留 Google 登录可用，微信二维码因缺少创建和轮询合同维持明确阻塞态。
- 对照 390×844 原稿、运行测试与构建，并记录真实邮件投递和设备验收边界。

## Capabilities

### New Capabilities

- `mobile-email-password-auth`: 移动端用户名密码注册、验证、登录与找回流程。

## Impacted delivery stages

- Architecture
- Prototype / Figma
- Backend / API
- Frontend
- Test / Acceptance
