## Why

移动端目前只有工程启动页。现有身份与资料后端已经提供 OAuth 兑换、会话刷新及首次资料接口，需要把已确认的移动设计接入真实流程，并守住未完成资料和未成年用户的入口边界。

## What Changes

### Confirmed scope

- 实现原生 Google 登录、微信登录入口、会话安全存储、刷新、登出与启动时恢复；使用现有 OpenAPI 合同，不在客户端保存 provider secret。
- 实现首次资料两步页面、表单校验、服务端提交及 `PROFILE_REQUIRED` / `AGE_RESTRICTED` / `ELIGIBLE` 导航；后端资料 CEFR 接受并返回设计所用的三个区间值。
- 用 Figma V2 的登录、基本资料、学习偏好、年龄限制和微信扫码 frame 做视觉依据，记录已确认范围导致的登录页视觉差异。
- 完成移动端中文/英文文案、相关测试、构建和可获得的运行时/视觉证据。
- 为 Mac 上的 390×844 浏览器预览提供 Google Web 授权码弹窗入口；由后端 `HttpOnly` Cookie 承载浏览器刷新会话，页面刷新后恢复登录；仅作为开发预览，不将它视为原生设备验收。

### Non-goals

- 用户名密码、邮箱验证、找回密码与账号绑定另做 change；本批不呈现无法操作的入口。
- 房间、LiveKit、生产发布与真实 provider 验收不包含在本批代码交付中。
- 不把浏览器预览扩展成独立 Web 产品；浏览器会话只在当前浏览器会话内恢复，不在客户端普通持久存储中保存 token。

### Unresolved decisions

- OpenAPI 没有头像上传及微信扫码创建/轮询接口；对应端到端能力在本 change 保持 `BLOCKED`，不展示假二维码或假上传成功。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `identity-and-profile`：首次资料 CEFR 可选择 A1–A2、B1–B2、C1–C2 区间；旧单级资料保持可读。

## Impact

- 阶段：Architecture、Backend / API、Frontend、Test / Acceptance。
- 范围：`apps/mobile` 认证、会话、资料、路由与本地化；`apps/api` 调整 profile CEFR 约束、Prisma 枚举与迁移，并支持原生 Google server authorization code 的服务端兑换及 ID token 签名验证；由 NestJS code-first 生成唯一 OpenAPI 合同，再更新 `packages/api-client`；保留工作区其他独立未提交改动。
- 依赖：Google Web/iOS/Android 开发者配置、服务端获准的原生代码标记、真实设备或开发构建、头像上传契约决策。
