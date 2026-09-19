## Why

当前后端只支持 Google/微信 OAuth 首次登录和单会话注销，缺少冻结 V1 要求的手机号自主注册、多个登录方式归并到同一平台账号以及账号软注销闭环。该缺口会让用户无法独立创建账号，也无法安全管理登录方式或结束账号生命周期。

## What Changes

- 增加国际手机号 OTP 请求与验证登录：首次验证原子创建平台账号，后续验证登录同一账号；验证码一次性、短期有效、限制尝试次数，并按手机号不可逆摘要、来源和设备维度限流。
- 增加可替换短信 provider、功能开关和启动配置校验；业务数据库和日志不保存明文验证码，日志、异常、审计和队列不暴露完整手机号或 provider 凭证。
- 增加当前已登录用户绑定 Google、微信或手机号登录方式的服务端流程。绑定必须重新完成目标方式验证；已属于其他平台账号的身份返回稳定冲突，不按邮箱、昵称或手机号推测并自动合并两个既有账号的数据。
- 保持现有 Google/微信首次登录兼容；一个平台用户可以同时拥有多个已验证登录方式，重复绑定相同身份幂等，至少保留一个可用登录方式。本 change 不提供拆分平台账号或跨账号业务数据迁移。
- 增加当前用户账号软注销。注销事务把账号置为 `DELETED`、撤销全部会话和实时凭证、结束可继续使用的房间/预约/邀请入口并隐藏公开资料；举报、处罚、申诉、审计和历史参与关系保留为受限事实。
- 禁止 `DISABLED` 或 `DELETED` 账号通过 OTP、OAuth、refresh token、旧 access token 或登录方式绑定重新获得访问；注销后的身份重用、自助恢复和物理删除必须等待独立保留政策。
- 增加平台管理员和安全员对已注销账号必要状态与安全关联的受限查询，响应不得包含完整手机号、provider token、验证码、密钥或非必要私人资料，所有查询写审计。
- 扩展 OpenAPI、Prisma 迁移、错误合同、限流、脱敏、维护清理和本地验收证据；真实短信、Google 和微信 provider smoke 保持为单独且不可伪造的外部验收项。

### Confirmed Scope

- 国际 E.164 手机号的 OTP 注册与登录、重发冷却、过期、尝试上限、一次性消费、并发幂等和防枚举响应。
- 已登录用户通过重新验证绑定 Google、微信或手机号；冲突身份不自动跨账号合并。
- 账号软注销、全部会话/实时访问收敛、公开资料隐藏、安全与审计事实保留。
- 管理员/安全员最小受限查询及审计。
- PostgreSQL 持久事实、Redis 临时 OTP/限流协调、可替换短信 adapter 和 NestJS code-first OpenAPI。

### Non-goals

- 不实现邮箱密码注册、验证邮件或找回密码；现有 `add-email-password-auth` 是 Figma 原型 change，未授权后端行为。
- 不自动合并两个已经分别拥有房间、单词本、案件或其他业务数据的平台账号，也不使用 provider email、昵称或头像作为合并依据。
- 不实现账号自助恢复、手机号换绑、登录方式解绑、数据导出或物理删除。
- 不在本 change 确定举报、处罚、申诉、审计、历史和单词本的最终保留期限；这些属于后续数据治理 change。
- 不开发移动端或 PC 管理端界面，不选择或采购具体短信供应商套餐。

### Unresolved Decisions

- 生产短信 provider、支持国家/地区清单、发送成本上限、sender 标识和真实送达证据在部署前确认；代码只依赖 provider adapter 与明确的安全配置。
- 注销账号标识与业务事实的最终保留/匿名化/物理删除期限由后续数据治理 change 和隐私政策决定；本 change 只保证软注销后不可公开访问且不可自行恢复。

## Capabilities

### New Capabilities

- `account-access-lifecycle`: 定义手机号 OTP 注册/登录、登录方式绑定、身份冲突、账号软注销、访问收敛、隐私和外部 provider 验收边界。
- `restricted-account-records`: 定义管理员和安全员对已注销账号必要状态与安全关联的最小受限查询、权限和审计行为。

### Modified Capabilities

- `identity-and-profile`: 扩展可用身份入口、一个用户的多登录方式语义，以及不可用/已注销账号在认证和公开资料中的边界。
- `backoffice-access-control`: 增加已注销账号必要记录查询权限，保持角色独立、服务端实时授权和审计要求。

## Impact

- Impacted delivery stages：Architecture、Backend / API、Test / Acceptance、Deployment。
- `apps/api/src/modules/auth/`、profiles、rooms、voice、social、backoffice 与 audit 的公开 application 边界：OTP、身份绑定、全局凭证撤销、账号注销收敛和受限查询。
- `apps/api/prisma/`：手机号身份、OTP/账号命令、注销时间与必要索引/唯一约束的只向前迁移；现有 OAuthIdentity、AuthSession、User 关系保持兼容。
- `apps/api/src/infrastructure/`、Redis 与配置：短信 adapter、临时 challenge、限流、provider timeout/失败归一化、readiness 和日志脱敏。
- `openapi/openapi.yaml`：OTP 请求/验证、登录方式绑定、当前账号注销和后台受限查询合同。
- 外部依赖：支持目标国家/地区的短信 provider，以及既有 Google/微信 OAuth provider；缺少真实凭据时只允许本地 fake/runtime 验证，外部 smoke 必须记录为 BLOCKED。
