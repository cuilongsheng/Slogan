## Why

现有后端支持 Google、微信及手机号认证，但邮箱注册、验证和密码找回仍只有原型。需要补齐可独立使用、可绑定到既有账号的用户名密码认证，并沿用现有会话、资料和注销边界。

## What Changes

### Confirmed scope

- 沿用现有原型：唯一用户名、邮箱和密码注册；用户名密码登录；验证邮件重发、邮箱验证和密码重置。
- 未验证注册不发放业务会话；邮箱验证完成后通过用户名密码登录进入既有资料初始化流程。
- 已登录用户经当前登录方式重新认证后，验证目标邮箱并绑定用户名密码；不根据 OAuth 返回的邮箱自动关联。
- 密码重置撤销该账号全部平台会话；邮箱密码账号可通过密码重新认证执行既有注销流程，注销身份不可重新注册或复活。
- 提供可替换事务邮件适配器、持久投递与受控重试、限流、一次性凭据和日志脱敏；真实邮件证明独立验收。

### Non-goals

- 不开发移动端或管理端 UI，不改造 Google/微信交互，不更改房间权限或资料成年规则。
- 不实现邮箱作为登录名、用户名找回、用户名修改、邮箱换绑/解绑、两个既有账号合并、MFA 或通用邮件营销平台。
- 不建设新的运营后台或跨域治理系统，不进行生产部署。

### Roadmap and unresolved decisions

- 邮件供应商、已验证发信域名和客户端验证/重置回跳地址属于真实环境配置；采用 SMTP 事务邮件适配器和固定允许的 HTTPS 回跳地址，配置缺失时保持入口关闭。
- 原型 change `add-email-password-auth` 仍负责视觉验收。本 change 单独声明后端能力，不同步该原型未验收的 delta，也不将其第三方登录 UI 描述变成后端授权。

## Capabilities

### New Capabilities

- `email-password-authentication`: 用户名密码注册与登录、邮箱验证/重发、密码恢复、既有账号绑定、会话失效、注销兼容及事务邮件安全。

### Modified Capabilities

无。沿用主规格 `identity-and-profile` 的资料与成年边界；新增登录方式的完整后端合同由新 capability 承载。

## Impact

- Impacted delivery stages：Architecture、Backend / API、Test / Acceptance。
- 扩展 `apps/api/src/modules/auth/` 和 account-lifecycle 的公开重新认证入口；沿用 SessionService，不新增独立 token 体系。
- Prisma 增加邮箱凭据、待验证申请、一次性 challenge 和邮件 outbox；采用 additive migration。
- 增加 SMTP adapter、后台投递/过期清理入口及 Zod 配置；Redis 承担跨进程限流，PostgreSQL 保存身份和命令事实。
- NestJS code-first 单向生成 `openapi/openapi.yaml`；新增 HTTP 合同、历史迁移测试和本地/真实邮件验收记录。
