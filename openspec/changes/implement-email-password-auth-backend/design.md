## Context

动机见 proposal.md。已核对现有实现：auth 的 SessionService 使用持久 AuthSession 和 refresh rotation，每次验证 access token 都读取会话有效性；PrismaAuthRepository 创建/刷新会话时锁 User。account-lifecycle 在事务内标记 DELETED、撤销会话并处理房间，当前重新认证 proof 由 PhoneChallengeStore 提供；登录方式 DTO 仅包含 PHONE/GOOGLE/WECHAT。AuthRateLimitGuard 是进程内限流，不能独自保护新增密码尝试和邮件配额。

主 spec 尚无邮箱认证；`add-email-password-auth` 是未完成视觉验收的原型 change。本 change 沿用其用户名格式与 8–128 字符密码入口，但把验证完成定义为确认身份后返回密码登录，不通过邮件链接直接发业务会话。该后端能力独立归档；将来同步原型 delta 时需核对重复描述和此流程，不能直接覆盖。

## Goals / Non-Goals

**Goals:** 在 auth 域内完成邮箱认证事务、邮件交付和现有会话/注销整合，新增一个独立邮件 worker 入口，保持可小批验证。

**Non-Goals:** 不泛化通知系统，不重构现有手机号认证，不增设管理后台，不开发客户端链接页面或实际部署。

## Decisions

### 1. 身份仅在验证完成后创建

新增 EmailCredential（userId 唯一、规范化 username/email 唯一、passwordHash、credentialVersion、verifiedAt）和 EmailEnrollment（REGISTER/LINK、待验证密码散列、24 小时 expiresAt、管理凭据摘要、绑定 userId/sessionId/命令）。不改变 User.status，也不让待验证账号进入资料/房间。

用户名 trim 后 ASCII 小写，邮箱 trim 后小写并拒绝不支持的国际化邮箱输入；最大 254 字符，不折叠 dot/plus。密码按 Unicode 码点计长，原样编码，最大请求体受限。用户名和邮箱独立唯一。注销账号凭据保留唯一占用但销毁 passwordHash，数据库约束允许该不可登录状态。

不以 pending 行建立永久唯一身份锁；每个目标同时最多 3 个未过期申请并受目标配额保护，验证时依赖唯一索引决定赢家。重发仅接受 32 随机字节管理凭据；不能凭邮箱更新申请密码。申请过期 24 小时内删除密码散列和个人数据；未验证申请不会创建 User，也不会永久阻断合法注册。

### 2. 密码与一次性凭据

使用 Node 异步 scrypt，经 PasswordHasher port 封装，初始 N=32768、r=8、p=1，独立随机盐与带版本的编码；通过本地耗时/内存测试限定并发，不以同步散列阻塞事件循环。相比新增原生 Argon2 依赖，现有 Node runtime 可直接部署；编码版本允许未来单独迁移。不存在用户名也执行固定 dummy hash 校验以减少明显时序差异。无正式凭据时，最多检查该用户名 3 个未过期 REGISTER 申请，仅匹配密码时返回待验证提示，不返回申请邮箱或管理凭据；正式凭据存在时不回退 pending。

EmailChallenge 保存随机 32 字节 token 的 HMAC 摘要、purpose、subject、generation、expiresAt 和 consumedAt，不保存明文。验证默认 30 分钟，重置 15 分钟；重发最少 60 秒且令旧 generation 失效。GET 链接不修改状态；可信页面读取 fragment token 后以 POST 明确确认，禁止任意 redirect 参数。请求与错误日志需对 token、password、email、邮件正文及管理凭据脱敏。

### 3. 登录、重置与注销的事务顺序

密码计算放在事务外；提交登录时锁 User 再锁 EmailCredential，重查 ACTIVE、已验证及 credentialVersion。会话创建必须在此原子校验边界内，不能“校验密码后直接调用无版本条件的 SessionService.issue”。扩展 auth 内部 repository/session port，复用原 token 格式和签名逻辑。

重置采用同样锁顺序，验证 challenge 仍有效及账号 ACTIVE；一次事务内消费凭据、递增版本、更新散列、撤销全部 AuthSession、失效其余重置及重新认证证明。旧密码校验若晚到因版本变化被拒绝；先完成的旧登录会话会被重置撤销；refresh 与重置共享 User 锁。提交重置后不自动签发 token，响应丢失时通过新密码登录恢复。

注销事务补充清除邮箱 passwordHash、失效该用户 enrollment/challenge/proof 和未发邮件载荷，保留身份占用。后台受限记录仅增加 EMAIL_PASSWORD 类型，不扩展明文邮箱查看权限。全局重置撤销平台会话，但不声称立即撤销已经下发的 LiveKit 媒体 token；当前房间移除和封禁仍走现有控制面。

### 4. 绑定及重新认证证明

独立、目的限定的 EmailAuthProof 保存用户、sessionId、credentialVersion（适用时）、命令 ID、purpose、摘要和 5 分钟有效期。绑定 proof 通过现有 OAuth adapter/手机号 challenge 验证当前账号真正拥有的身份，不能复用登录 exchange 创建新用户，也不能使用 ACCOUNT_DELETE proof。开始绑定事务消费 LINK_EMAIL proof，把原会话绑定到 enrollment；确认时再次校验该会话有效及账号 ACTIVE，按 User → Credential → Enrollment/Challenge 锁顺序写入。

密码注销 proof 通过 auth 公开接口接入现有 account-lifecycle proof 验证边界。保留旧手机号/OAuth proof 路径和 DTO 兼容；新增密码 proof 按同一命令 ID 安全重放，消费及注销失败恢复不可绕过重新认证。避免为这次新增方式整体重构所有 proof 存储。

### 5. 邮件 outbox 和有限重试

auth 拥有 MailSender port、SMTP adapter 和 EmailDelivery。使用 SMTP TLS 校验（本地捕获服务例外），不要求供应商专属 SDK。application 事务同时保存 enrollment/challenge 和 outbox；随机凭据及收件地址仅存在 AES-256-GCM 加密载荷，密钥由部署配置提供，附 keyId 与 AAD，不能与数据库一起明文备份。普通身份邮箱受数据库访问边界保护，不进入查询/日志； outbox 不存完整链接和正文，只加密最小模板参数。

独立 auth-mail worker 在开关开启后领取 PostgreSQL 租约，generation fencing 提交状态，每批最多 20 条、最多 5 次指数退避；过期、已消费或被替换 challenge 停止发送。稳定 Message-ID 可辅助去重，但 SMTP 不保证 exactly-once；发送成功而提交丢失可能重发同一链接，单次消费保证状态安全。发送完成立即清空加密载荷；失败/过期最晚终态后 24 小时清除，技术元数据 7 天清理。Enrollment 成功后立即清除临时密码散列和管理凭据，过期后 24 小时内删除个人数据。重试不延长 challenge 有效期。清理仅涉及新增 auth 临时表，不能删除既有身份/审计。

### 6. 合同、开关和配额

沿用 NestJS code-first；以下为预期路由，唯一发布合同仍由 decorators 生成：

| 路由（均在 /v1 下） | 行为 |
| --- | --- |
| POST /auth/email/registrations | 用户名/邮箱/密码申请，202 返回不透明管理凭据和期限，无 session |
| POST /auth/email/verifications/resend | 管理凭据重发，202，返回冷却时间 |
| POST /auth/email/verifications/confirm | 注册 token 消费，200，无 session |
| POST /auth/password/exchange | 用户名密码登录，200，沿用 tokens/onboarding 响应 |
| POST /auth/password/reset-requests | 邮箱找回，统一 202，无存在性字段 |
| POST /auth/password/resets | token 与新密码，204 |
| POST /me/login-methods/email/proofs/oauth/:provider | 当前账号 OAuth 重新认证，目的 LINK_EMAIL |
| POST /me/login-methods/email/proofs/phone/challenges、confirm | 当前账号手机号重新认证，目的 LINK_EMAIL |
| POST /me/login-methods/email/requests | 带绑定 proof、命令 ID 的申请，202 |
| POST /me/login-methods/email/confirm | 有效原会话与绑定 token 确认，200 |
| POST /me/account/deletion/proofs/password | 当前密码确认，返回现有注销 proof 响应形式 |

登录方式列表和受限注销记录 enum 增加 EMAIL_PASSWORD（更新客户端生成类型）；不新增公开身份查询。校验/登录失败 400/401，未验证且密码正确 403，身份占用/命令冲突 409，配额 429，配置或依赖不可用 503；找回未知/禁用/注销邮箱统一受理且无邮件。公开注册会暴露占用状态，这是原型明确行为，与登录/找回隐匿存在性的目标区分记录。

EMAIL_PASSWORD_AUTH_ENABLED 默认 false，worker 同步受控。启用要求 SMTP、from、可信链接基址、HMAC/AES 密钥及 Redis 配置完整；关闭不得停用 OAuth/手机号和原会话撤销。Redis Lua 原子检查来源、目标摘要和全局配额（初始来源 20 次/15 分钟、登录目标 10 次/15 分钟、邮件目标 5 封/小时、全局 100 封/小时，配置有硬上限），不存在目标同样计数。限流键不含明文邮箱/用户名，配置可信代理来源，依赖失败拒绝新邮件/密码尝试。SMTP 故障不阻塞已有邮箱账号密码登录。

## Risks / Trade-offs

- [8 字符最低长度沿用原型，存在弱密码风险] → 加入版本化常见密码拒绝表、严格共享限流和成本受控散列；不宣称具备 MFA 强度。
- [注册字段占用提示与隐私目标有取舍] → 仅注册允许字段级占用，登录/找回保持统一响应，配额同时约束枚举。
- [SMTP 不确定重发] → 同一目的/版本 token 只能消费一次，投递不等于已验证，不虚构 exactly-once。
- [加密密钥丢失导致待发邮件不可恢复] → 稳定失败码、失效旧申请并允许重发；轮换期间保留未过期载荷旧 keyId 的解密能力。
- [同时存在原型、账号生命周期 active change] → 本次只新增 capability；实现对当前代码 additive 扩展，归档时单独复查能力重叠。

## Migration Plan

1. 关闭开关，新增表、唯一约束与 User 可选关系；历史 OAuth/手机号用户无邮箱凭据，迁移不得自动读取 provider email 创建凭据。
2. 在空库与含现有会话、手机号/OAuth、注销账号的历史 fixture 验证迁移；真实 PostgreSQL 测试唯一竞争和重置/登录/刷新/注销竞态。
3. 使用本地 SMTP 捕获服务完成投递、重试、重启、过期清理与脱敏 runtime，再在隔离真实邮件环境验收收件及链接确认/重置闭环。
4. 一次最终 affected-scope 运行格式、Prisma、类型/lint、依赖、OpenAPI、构建和完整 API 回归；过程仅跑对应小范围测试。
5. 回滚关闭入口/worker并回退应用，保留身份和挑战表，不恢复旧密码或已撤销会话；邮箱独有用户在关闭期间无法密码登录，需发布说明，不能用旧快照恢复旧认证状态。
6. 真实发信环境缺失时外部任务 BLOCKED 且不归档；本 change 不要求移动端视觉/真机证明，客户端回跳页面接入另行验收，不能声称移动端已完成。

## Open Questions

- 目标环境 SMTP 供应商、已验证发信域名和可信客户端 HTTPS 页面地址由部署配置提供；不影响上述实现合同。真实 smoke 需用受控收件邮箱和测试确认客户端完成 POST，不依赖尚未开发的移动端页面。
