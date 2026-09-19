## Context

见 `proposal.md` 的动机。当前 NestJS API 已有 Google/微信 OAuth adapter、以 `issuer + subject` 唯一的 `OAuthIdentity`、短期 access JWT、持久 session 与 refresh rotation/replay revoke；所有认证路径最终以 `User.status = ACTIVE` 判断会话可用。`UserStatus` 已包含 `DELETED`，但没有注销时间、手机号身份、OTP challenge、登录方式绑定或全账号注销事务。

PostgreSQL 是账号、身份、会话和业务关系的持久事实；Redis 已用于临时协调和限流。LiveKit 撤销通过持久 `RealtimeCommand` outbox 收敛。OpenAPI 继续由 NestJS code-first 生成，`openapi/openapi.yaml` 是唯一合同。手机号、验证码和 provider 凭证属于高敏数据，不能进入普通日志、审计详情或测试 fixture。

## Goals / Non-Goals

**Goals:**

- 在不改变现有 OAuth 登录合同的前提下增加手机号 OTP 注册/登录和已登录绑定。
- 用数据库唯一约束、Redis 原子 challenge 和当前账号状态保证并发安全、防枚举和一次性消费。
- 把软注销设计为立即阻断服务端访问、可靠撤销实时身份并收敛跨模块关系的持久操作。
- 让后台调查只读取已注销账号的最小必要状态，并为每次访问留下无敏感内容审计。

**Non-Goals:**

- 不设计邮箱密码、手机号换绑/解绑、两个既有账号的数据搬迁或账号恢复。
- 不把 OTP 或 OAuth 当作强实名/年龄证明。
- 不在本设计中确定长期保留期限或执行物理删除。

## Decisions

### 1. 手机号身份只保存版本化查找摘要和最小掩码

新增 `PhoneIdentity`，每个账号至多一个手机号身份，并对 `phoneLookupVersion + phoneLookupHash` 建唯一约束。服务端先使用可靠的国际号码解析库把输入规范化为 E.164，再以独立 `PHONE_IDENTITY_PEPPER` 做 HMAC；数据库不保存完整 E.164。为了 `GET /v1/me/login-methods` 可显示提示，只保存国家呼叫码和末两位等不可用于投递的最小掩码字段、验证时间和 userId。

hash version 固定参与唯一键和配置校验；更换 pepper 必须先做双版本迁移，不能直接修改环境变量。备选方案是数据库保存加密手机号，但当前没有找回、换绑或后台查看完整号码的获批需求，增加解密密钥与泄露面没有必要。

### 2. Redis 保存短期 OTP challenge，PostgreSQL 只保存消费后的身份事实

短信模块通过 `PhoneChallengeStore` port 使用 Redis Lua 原子维护 challenge：随机 challenge id、手机号摘要、验证码 HMAC、目的、过期时间、重发时间、剩余尝试和消费状态。验证码由密码学安全随机源生成，只在调用短信 adapter 的同步作用域存在；日志和异常只接收无内容的 provider 类别与错误枚举。

公开登录、已登录绑定和注销重新认证使用不同 namespace/目的，challenge 不能跨目的复用。验证脚本在一次原子操作中检查摘要、目的、过期、尝试次数和 code digest；并发验证最多一个成功。成功后返回短期 verification grant，grant 绑定手机号摘要、目的、当前 userId（如适用）和随机 nonce，并在对应数据库事务成功后 compare-and-delete。事务失败时只有同一请求上下文可在 grant 有效期内重试，不能用另一目的消费。

备选方案是 PostgreSQL OTP 表。它更容易做跨事务恢复，但会把高频、短期验证码状态放入长期事实库并增加清理/备份暴露面；本项目已有 Redis 原子协调，因此不采用。

### 3. 短信 provider 通过独立 adapter 和严格 feature gate 接入

新增 `SmsProvider` port，只接受规范化号码、一次性验证码、模板、locale 和随机关联 id。环境配置包含功能开关、provider 类别、base URL、凭证、sender/template、timeout、支持地区、challenge TTL、尝试次数、重发冷却、各维度限额与 hash pepper。启用手机号认证时缺少 Redis、provider 安全配置或支持地区必须阻止 readiness；关闭时现有 OAuth API 可以独立启动。

provider timeout 返回不确定结果，不自动切换第二 provider 或重复发送。客户端等冷却后重新请求新 challenge，旧 challenge 被覆盖或失效。真实 provider 的号码覆盖、sender 合规、送达、成本和凭据 smoke 是部署证据，不由 fake adapter 代替。

### 4. 登录和绑定共用验证原语，但使用不同 application 命令

公开接口增加：

- `POST /v1/auth/phone/challenges`：请求登录 OTP；
- `POST /v1/auth/phone/exchange`：验证并查找/创建手机号账号、签发会话；
- 现有 `POST /v1/auth/oauth/{provider}/exchange` 保持兼容。

已登录接口增加：

- `GET /v1/me/login-methods`：只返回类别、验证时间和手机号掩码；
- `POST /v1/me/login-methods/phone/challenges` 与 `/confirm`；
- `POST /v1/me/login-methods/oauth/{provider}/link`。

OAuth link 复用 provider adapter 验证授权码，但执行 `linkIdentity(currentUserId, identity)`，绝不调用首次登录的 `findOrCreateUser`。手机号和 OAuth 绑定均在 serializable transaction 中先锁当前用户并验证 `ACTIVE`，再依赖全局身份唯一键和 `(userId, provider)`/`userId` 唯一键决定 CREATED、ALREADY_LINKED 或 CONFLICT。provider email、昵称和头像只作为首次资料建议，永远不是关联键。

这把“合并”限定为多个已验证登录方式归属于一个既有 userId。两个已经存在的平台账号发生冲突时返回 `AUTH_IDENTITY_ALREADY_BOUND`；自动搬迁房间、案件、单词本或审计的方案不可逆且缺少产品规则，因此不实现。

### 5. 所有认证路径在签发前重新读取账号状态

OTP exchange、OAuth exchange、link、session issue、refresh 和 access guard 都必须从 PostgreSQL 验证用户仍为 `ACTIVE`。OAuth identity 已存在但账号为 `DISABLED/DELETED` 时返回统一不可用错误，不能走“未找到后创建”分支。PhoneIdentity 对注销账号继续占用摘要，阻止通过原号码新建替代账号。

保持 JWT 只包含 `sub` 和 session id；角色、账号状态和登录方式不写入长寿命 claims。现有 session active 查询已经按 `ACTIVE` 过滤，扩展测试覆盖所有新入口。

### 6. 注销使用短期 step-up proof 和持久幂等命令

账号注销是安全敏感动作，当前 access token 不足以单独授权。新增按用户已绑定方式生成 `ACCOUNT_DELETE` proof 的接口：手机号走专用 OTP challenge；Google/微信重新交换 authorization code 并确认返回身份属于当前 userId。proof 只含 userId、identity type、purpose、issued/expires 和 nonce，短期单次有效。

`POST /v1/me/account/deletion` 接受 proof、明确确认和 `clientRequestId`。`AccountLifecycleCommand` 保存 userId、动作、请求 id、payload hash、状态和最小结果快照，以 `(userId, clientRequestId)` 唯一。相同载荷重试返回原结果，改变载荷冲突。存在有效后台角色时在事务内拒绝，防止唯一管理员或案件处理人通过普通自助入口消失；角色交接沿用后台角色管理。

备选方案是只要求当前 JWT 或短信确认文本，但它不能抵御被盗 access token，因此不采用。

### 7. 核心注销事实原子提交，外部撤销通过 outbox 收敛

账号生命周期 repository 在一个 PostgreSQL serializable transaction 中：

1. 锁定用户和幂等命令，验证 `ACTIVE`、proof 与无有效后台角色；
2. 设置 `status = DELETED`、`deletedAt`，撤销全部 AuthSession；
3. 递增该用户所有活动 membership 的 credentialVersion、使 membership 离开，并为每个已发行 identity 写 `REVOKE_IDENTITY`；
4. 对其主持的 OPEN 房间复用现有房主离开规则生成接任或结束事实；取消其未来预约、主持的 SCHEDULED 房间和待处理邀请；
5. 终结待处理好友请求/邀请并清除 Redis presence 的持久资格，公开查询继续以 `User.status = ACTIVE` 过滤；
6. 撤销其未完成 realtime issuance 和有效后台角色（正常自助入口理论上为零），提交最小账号生命周期审计与命令结果。

LiveKit 删除参与者、删除/更新房间和 Redis presence 清理由现有 durable command/维护 runner 重试。注销响应只在账号状态、数据库资格失效与 outbox 全部提交后返回；外部 provider 暂时失败不会让旧 API token 再次有效。对于 Redis 清理失败，短 TTL 和 `ACTIVE` 数据库校验共同阻止重新发现。

为避免 auth 深层导入 rooms/social/backoffice repository，新增 account-lifecycle application 边界和专用 transaction port；其 Prisma adapter拥有这一跨域注销事务，复用公开的纯 policy/transaction helper，其他模块只暴露必要的生命周期规则，不互相调用内部 infrastructure。

### 8. 删除是访问状态，不是证据删除

软注销保留稳定 userId、PhoneIdentity/OAuthIdentity 占用、安全案件、处罚、申诉、审计、房间历史、匿名汇总和用户保存内容。普通用户和公开 API 统一过滤非 ACTIVE 账号；不新增任何恢复、身份释放或物理删除路径。后续数据治理 change 决定保留期限、匿名化和物理清理，并在需要时迁移这些事实。

这一选择避免用户用注销绕过处罚，也避免当前 change 擅自删除仍受调查、审计或用户保存的数据。代价是 provider 身份和手机号摘要在治理政策批准前保持占用，必须在隐私说明中明确。

### 9. 受限账号查询复用实时 RBAC 和审计

新增 `ACCOUNT_RESTRICTED_RECORD_READ` 权限，只映射给 `PLATFORM_ADMIN` 和 `SAFETY_OFFICER`。`GET /v1/backoffice/accounts/{userId}/restricted-record` 每次读取当前角色，并在同一受控查询中返回 account id/status/timestamps、登录方式类别、最小资料快照和安全 case/restriction/appeal 引用。不存在和无权限使用稳定非泄露错误。

成功与拒绝都写 BackofficeAuditEvent，只包含 actor、roles、target userId、request id、结果和规范化原因。响应 schema 和 audit detail 类型都禁止完整手机号/hash、provider subject/token、验证码、私人笔记和内容数据。OPERATIONS_ANALYST 与 AUDITOR 不因已有汇总/审计权限自动获得该读取能力。

### 10. OpenAPI、错误与清理保持单一合同

所有新 DTO/controller 由 NestJS Swagger 元数据生成 `openapi/openapi.yaml`；实现不得手写第二份合同。稳定错误至少覆盖：手机号格式/地区、rate limited、challenge 无效/过期/尝试耗尽、provider unavailable/timeout/uncertain、身份已绑定、账号不可用、step-up 无效、后台角色阻止注销、幂等冲突和受限记录拒绝。

维护任务只清理过期 challenge/grant、过期限流键和达到保留期的 account command 技术记录；不得清理 PhoneIdentity/OAuthIdentity 占用、DELETED 状态、安全事实或用户内容。日志脱敏规则增加 phone/e164/otp/code/verification grant/provider payload 等键及值模式。

## Risks / Trade-offs

- [Risk] 短码验证码容易被撞库或短信轰炸 → 多维 Redis 限流、短 TTL、尝试上限、重发冷却、统一响应和 provider 成本阈值共同限制。
- [Risk] Redis 验证成功而 PostgreSQL 提交失败造成状态不确定 → 使用短期、请求绑定的 verification grant，数据库失败允许同一命令在 grant 期限内重试，成功后 compare-and-delete。
- [Risk] 手机号 HMAC pepper 丢失或直接轮换会让身份无法查找 → 配置启动校验、独立 secret 管理、hash version 和显式双版本迁移，禁止原地轮换。
- [Risk] 账号注销横跨房间、社交和实时状态，部分失败可能留下可见关系 → 核心资格在同一数据库事务失效，外部动作只通过 durable outbox/维护重试，所有入口持续校验 `ACTIVE`。
- [Risk] 注销后保留身份占用与用户内容会增加隐私义务 → 只暴露最小受限查询，明确无公开访问，并由下一项数据治理 change 决定最终期限与删除方式。
- [Trade-off] 已存在两个账号的登录身份冲突不会自动合并 → 返回可解释冲突，避免不可逆业务数据迁移；需要合并时另建有双方重新认证、冲突规则和回滚的 change。
- [Risk] 本地 fake provider 通过但真实短信或 OAuth 配置不可用 → 真实号码、Google、微信 smoke 作为独立验收任务；缺少凭据时标为 BLOCKED，不能宣称生产可用。

## Migration Plan

1. 添加 `PhoneIdentity`、`AccountLifecycleCommand`、`User.deletedAt` 及唯一索引；历史用户保持原状态，现有 OAuthIdentity 和 session 数据不改写。用历史数据库迁移测试证明旧 OAuth 登录和 refresh 仍可用。
2. 部署 API/worker，保持手机号功能开关关闭；配置 hash pepper、Redis、短信 provider、地区和限额后运行 readiness、fake adapter、真实 provider sandbox 和 OpenAPI drift 检查。
3. 先开放 OTP 请求/登录，再开放已登录绑定；监控发送失败、验证失败、限流和成本，但诊断不得包含完整手机号或验证码。
4. 在房间/social/outbox 收敛 runtime 通过后开放账号注销和后台受限查询；执行活动房间、未来预约、好友邀请、限制中用户和 provider 故障 smoke。
5. 回滚时先关闭新的 OTP/绑定/注销入口，保留新增表、手机号摘要占用、deletedAt、命令、审计和已完成注销事实；回退到仍按 `User.status` 拒绝非 ACTIVE 账号的兼容二进制。不得把 `DELETED` 改回 `ACTIVE` 或在紧急回滚中删除身份/安全事实。

## Open Questions

- 生产短信 provider、支持地区、sender/template、成本阈值与真实设备号码由部署环境确定，只要满足本设计的 adapter、隐私、错误和验收合同即可。
- 注销账号各类持久数据的最终保留、匿名化和物理删除期限交由后续运营与数据治理 change；不会改变本 change 的即时访问阻断和受限读取边界。
