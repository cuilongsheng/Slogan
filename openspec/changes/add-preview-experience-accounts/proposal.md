## Why

首轮免费在线网页试用需要供招聘方与海外用户体验，用户已确认五个独立体验账号：后台平台管理员、安全员各一个，移动端三个普通账号用于一人建房、两人加入。当前没有体验账号初始化命令，密码登录与 SMTP 启动配置共用开关，无法在停用邮件时按正常密码认证提供这些账号。

## What Changes

- 分离密码认证与邮件流程；试用配置允许密码登录、保留 Google 登录，停用邮件注册、验证、重发、找回、重置和邮箱绑定，不开放免验证自助注册。
- 提供受控、幂等、环境绑定的五账号初始化，复用密码策略、散列、会话和授权，不预发 token、不预建房间。
- 明确预置凭据来源，区分受控初始化和真实邮箱验证；**BREAKING**：登录方式投影的 `verifiedAt` 对未邮件验证的体验凭据允许为 null，并增加可识别的来源信息，更新唯一 OpenAPI 与生成客户端。
- 后台最终角色分别为仅 `PLATFORM_ADMIN`、仅 `SAFETY_OFFICER`；移动三账号无后台角色，房主由正常创建房间产生。复用现有 bootstrap 与审计角色命令，保留最后管理员保护。
- 三个移动账号预填成年完整资料；邮件关闭期间 UI 不展示已发送/待收件的假成功，保留用户名密码和 Google 登录。
- 停用投递时保留临时凭据和载荷的期限清理；提供凭证分发、目标核对、初始化恢复、清理和回滚 runbook，以及认证/权限/三人房间验收计划。

### Confirmed Scope

五个独立账号、上述角色分离、首轮无邮件、保留 Google、网页试用后再讨论正式上线。当前授权只包含规划；数据库、远程账号和部署均未授权执行。

### Non-Goals

无邮件自助注册与找回、对所有用户免验证、全局 HOST 角色、持久演示房间、管理员权限模拟、账号自动关联/合并、供应商选型、购买服务器或域名、远程部署、真实发信验收、正式生产上线。

### Unresolved Decisions And Recommendations

- 目标数据库、试用环境标识和公网地址未确定，是执行初始化/迁移/公网验收的前置输入，不影响本次规划。
- 五账号的实际用户名、秘密输入和分发渠道尚未选定；仓库不保存实际凭证。
- 建议只向受控体验者分发高权限账号，普通访客使用 Google 或普通体验账号；这是建议，用户尚未确认分发对象，不把它写成产品 MUST。
- Figma Desktop Bridge 当前无连接；已有认证 V2 目标来自仓库验收记录，邮件停用状态尚未获实时画布核验，UI 实施前需恢复 Bridge 并确认原页面状态。

## Capabilities

### New Capabilities

- `preview-auth-controls`: 试用环境中独立控制密码认证、邮件流程、Google 入口，以及邮件关闭后的接口、会话、清理和来源投影边界。
- `preview-experience-accounts`: 五账号受控初始化、独立身份、完整资料、角色分离、幂等冲突处理、秘密输入和清理。
- `preview-auth-entrypoints`: 网页邮件停用提示、直接路由拒绝和正常密码/Google 登录及后台权限呈现。

### Modified Capabilities

无主规格修改。`backoffice-access-control`、`backoffice-audit` 和房间规则保持原要求；邮箱认证、移动邮箱页面和后台工作区现有实现来自尚未同步的 active changes，本 change 的新增试用规格明确限定环境例外，不静默覆盖它们，审核/同步时需联合处理冲突。

## Impact

- API：认证配置、`EmailAuthService`/`SessionService`、Prisma 凭据来源与初始化记录、邮件 worker/清理、账号注销；后台使用现有公开 bootstrap/角色 application API。
- 前端：移动 Web 登录及邮箱页面的停用状态、登录方式来源投影；后台复用已有密码/Google 登录和 `/v1/backoffice/me`，不增加认证方式或权限。
- 唯一合同：保持 NestJS code-first 生成 `openapi/openapi.yaml`，生成客户端跟随投影变更；不增加公网 seed 或角色绕过接口。
- 文档/验收：新试用 runbook、迁移回滚、隔离测试、Web 权限与三人房间 runtime 证据；与真实 SMTP、正式生产和真机证据分别记录。
- 与 `implement-email-password-auth-backend`、`implement-mobile-email-password-auth`、`implement-admin-workspace` 衔接。`docs/releases/0.0.1-preparation.md` 中较宽的无邮件注册/恢复计划属于发布准备文档，不能据此扩大当前五账号试用范围。

### Impacted Delivery Stages

- Architecture
- Prototype / Figma
- Backend / API
- Frontend
- Test / Acceptance
- Deployment（仅环境初始化、迁移、清理与回滚准备；实际部署另行指定目标后执行）
