## 1. Schema、配置与边界

- [x] 1.1 增加 PhoneIdentity、AccountLifecycleCommand、所需动作/状态枚举和 User.deletedAt，建立手机号 hash 唯一键、每用户一个手机号、每用户每 OAuth provider 一个身份及幂等命令约束，并通过 Prisma validate/generate 与 schema 结构测试验证
- [x] 1.2 编写只向前迁移并用含历史 OAuth 用户、session、房间和安全事实的迁移测试验证旧数据保持可登录、历史用户 deletedAt 为空且新增约束不破坏现有关系
- [x] 1.3 增加手机号认证 feature flag、hash version/pepper、短信 provider、支持地区、TTL、尝试上限、冷却、timeout 和多维限额配置，验证关闭时旧 OAuth API 可启动、启用但 Redis/安全配置缺失时启动或 readiness 安全失败且不回显配置值
- [x] 1.4 建立短信 provider、phone challenge store、账号身份与生命周期 transaction 的 domain/application ports，运行依赖边界检查验证 domain 不导入 NestJS、Prisma、Redis、HTTP DTO 或具体短信 SDK
- [x] 1.5 在验收文档记录部署、分阶段启用与回滚顺序，验证包含保持开关关闭、先迁移、provider/readiness smoke、保留身份占用/DELETED/审计事实且禁止紧急恢复账号

## 2. 手机号规范化、OTP 与短信适配

- [x] 2.1 实现国际号码解析、E.164 规范化、支持地区 policy、版本化 HMAC 查找摘要和最小掩码，验证等价输入映射同一 hash、无效/禁用地区被拒绝且完整号码不进入持久或诊断对象
- [x] 2.2 实现 Redis challenge 的创建、验证码 HMAC、purpose、TTL、重发时间、剩余尝试与 compare-and-delete，使用原子脚本验证错误扣减、过期、尝试耗尽、目的隔离和并发正确码最多一次成功
- [x] 2.3 实现按手机号摘要、来源、设备和全局发送量的 Redis 限流与冷却，验证任一维度超限都不调用 provider、错误不透露命中维度且计数按 TTL 恢复
- [x] 2.4 实现可替换 SmsProvider adapter 的最小请求、timeout 和 SUCCESS/FAILED/UNCERTAIN 错误归一化，使用 fake transport 验证请求不包含用户资料、房间信息、OAuth token 或平台密钥
- [x] 2.5 实现公开 OTP 请求 use case 和 provider 失败清理，验证有效请求返回 challenge/过期/重发时间、无效格式不调用 provider、账号是否存在不改变响应形状且 OAuth 登录在短信故障时仍可用
- [x] 2.6 实现短期 verification grant 的目的/user/request 绑定和重试边界，验证数据库提交失败后只有同一命令可在期限内重试、其他用户/目的/请求不能消费且成功提交后 grant 不可再次使用
- [x] 2.7 增加 challenge、grant、限流键的维护清理和 shutdown 行为，验证过期数据不可读取、明文验证码没有残留且清理不触碰 PhoneIdentity、OAuthIdentity 或账号事实

## 3. 手机号注册、登录与资料衔接

- [x] 3.1 实现 serializable 的手机号 find-or-create 事务，验证首次验证只创建一个 ACTIVE User/PhoneIdentity、重复验证返回原 userId、唯一冲突重试不会产生孤立用户
- [x] 3.2 把手机号 exchange 接入现有 SessionService 和 ProfilesService，验证成功返回 token pair、created 与 PROFILE_REQUIRED/AGE_RESTRICTED/ELIGIBLE，手机号验证本身不绕过资料和成年校验
- [x] 3.3 增加 `POST /v1/auth/phone/challenges` 与 `POST /v1/auth/phone/exchange` DTO/controller/error 映射，验证 challenge/code/phone 字段白名单、稳定状态码、防枚举响应和 OpenAPI runtime 一致
- [x] 3.4 在手机号 exchange、OAuth exchange、session issue/refresh 与 access guard 中统一校验 User.status，验证 DISABLED/DELETED 身份不能获得或刷新会话、不能走未找到后建号分支且旧 access token 立即失效
- [x] 3.5 运行既有 OAuth、refresh rotation、replay revoke、资料初始化和成年门禁回归，验证 feature flag 关闭时公开合同与原行为保持兼容

## 4. 多登录方式绑定

- [x] 4.1 实现 `GET /v1/me/login-methods`，验证只返回已验证方式类别、时间和手机号最小掩码，不返回 phone hash、完整号码、issuer、subject、authorization code 或 token
- [x] 4.2 实现已登录手机号绑定 challenge/confirm，验证当前用户和 LINK purpose 绑定、成功不创建新 User、同一身份本人重试幂等且其他账号占用返回非泄露冲突
- [x] 4.3 实现 Google/微信 OAuth link 命令，验证必须使用当前有效会话和新 provider 授权码、只调用 linkIdentity、不调用 findOrCreateUser，并拒绝把其他 userId 的身份移入当前账号
- [x] 4.4 在数据库事务和唯一约束中实现每用户每 OAuth provider/每用户手机号边界，验证并发绑定最多一个成功、无部分记录且现有 userId 的资料、历史、单词本和安全事实不变
- [x] 4.5 增加 provider email、昵称、头像和手机号相似性不参与自动合并的测试，验证相似建议资料仍创建独立首次登录账号或返回明确绑定冲突，不复制跨账号业务数据
- [x] 4.6 增加 ACTIVE 状态、目的、当前用户和 provider 配置门禁，验证撤销会话、禁用/注销账号、错误 provider、过期 grant 和直接绕过 UI 都不能增加登录方式

## 5. 重新认证与账号软注销

- [x] 5.1 实现 PHONE/OAuth 的 ACCOUNT_DELETE step-up proof，验证 proof 短期、单用途、绑定当前 userId/identity/nonce，过期、复用、身份不属于本人和跨目的使用全部被拒绝
- [x] 5.2 实现 AccountLifecycleCommand 的 clientRequestId、规范化 payload hash 与结果快照，验证相同 UUID/载荷返回原注销结果、改变载荷冲突且并发命令只提交一次生命周期变化
- [x] 5.3 实现注销前 ACTIVE 用户、确认内容和有效后台角色门禁，验证普通用户可继续、任一后台角色持有者必须先撤销角色且拒绝路径不修改账号/会话/关系
- [x] 5.4 实现账号注销核心 serializable 事务：设置 DELETED/deletedAt、撤销全部 AuthSession、失效 realtime issuance/identity、递增活动 membership credentialVersion 并写 REVOKE_IDENTITY，验证任一持久步骤失败会整体回滚
- [x] 5.5 复用既有房主离开规则收敛注销用户的活动房间，验证有合格成员时只接任一次、无成员时可靠结束、LiveKit 命令失败可重试且旧 token/API 始终不能恢复资格
- [x] 5.6 取消注销用户主持的未来预约房间和本人 reservation，验证重复注销/维护扫描幂等、其他房间不受影响且已结束房间历史不被改写
- [x] 5.7 终结注销用户的待处理好友请求和房间邀请并清除 presence 可见性，验证好友/空闲/邀请/公开资料列表立即隐藏该用户且安全案件、限制和审计事实保持不变
- [x] 5.8 增加受限中用户、存在举报/案件/申诉、拥有私人笔记/单词本和历史 membership 的注销测试，验证注销不解除处罚、不删除证据或用户内容、原手机号/OAuth 身份仍被占用且不提供恢复
- [x] 5.9 增加 Redis、LiveKit 和 runner 故障下的注销 runtime 测试，验证数据库访问先阻断、durable command 可在重启后收敛、外部失败不回滚成 ACTIVE 且无部分可见关系

## 6. 已注销账号后台受限查询

- [x] 6.1 在 backoffice policy 增加 ACCOUNT_RESTRICTED_RECORD_READ 且只授予 PLATFORM_ADMIN/SAFETY_OFFICER，验证普通用户、仅 OPERATIONS_ANALYST、仅 AUDITOR 和角色撤销后的旧 token 均被拒绝
- [x] 6.2 实现已注销账号最小查询 repository/application API，验证只返回 userId、状态/时间、方式类别、最小资料快照和 case/restriction/appeal 引用，不返回手机号/hash、provider subject/token、验证码、私人笔记或内容数据
- [x] 6.3 增加 `GET /v1/backoffice/accounts/{userId}/restricted-record`，验证存在、缺失和未授权目标使用稳定非泄露合同且查询不能恢复账号、解绑身份或修改安全事实
- [x] 6.4 为成功与拒绝查询写最小 BackofficeAuditEvent，验证包含 actor、当前角色、target、requestId、time、result/reason，不复制响应私人字段且重复读取各自可追踪

## 7. API、隐私、维护与结构

- [x] 7.1 为 OTP、身份绑定、step-up、注销和后台查询补齐稳定业务错误与异常映射，验证响应不含 stack、SQL、完整号码、验证码、grant、provider body 或其他账号存在性线索
- [x] 7.2 扩展结构化日志/trace 脱敏和禁止内容键/值规则，验证 phone/e164/otp/code/grant/provider payload、OAuth code/token、pepper/secret 在成功、失败、timeout 和异常路径均不可见
- [x] 7.3 更新模块公开入口与 dependency-cruiser 规则，验证 auth、account-lifecycle、profiles、rooms、social、backoffice、audit 和 voice 只通过公开 application/domain port 交互且无循环依赖
- [x] 7.4 实现 account command 技术记录与孤立 OTP Redis 键的保留清理，验证不会删除 PhoneIdentity/OAuthIdentity、DELETED 状态、案件、处罚、申诉、审计、房间历史、汇总、私人笔记或单词本
- [x] 7.5 重新生成 `openapi/openapi.yaml` 并运行 drift 检查，验证手机号挑战/交换、登录方式、绑定、注销和受限查询的默认值、枚举、错误、时间和敏感字段与运行时一致

## 8. 验证与验收

- [x] 8.1 完成号码规范化、OTP 原子消费、限流、provider adapter、账号唯一、绑定冲突、step-up、幂等注销和脱敏的 unit tests，并验证目标测试全部通过
- [x] 8.2 在真实 PostgreSQL 与 Redis 上完成历史迁移、唯一约束、并发 exchange/link、注销事务回滚、outbox 重启恢复和临时键清理 integration/runtime tests，并记录数据库与 Redis 版本及结果
- [x] 8.3 完成 OTP 注册/登录、三个登录方式共享资料、禁用/注销拒绝、注销跨房间/预约/社交收敛及后台 RBAC/审计的 HTTP E2E，验证直接请求不能绕过服务端边界
- [x] 8.4 运行 format、Prisma validate/generate、OpenAPI drift、依赖边界、build、完整 unit/integration/e2e/runtime、`git diff --check` 和 OpenSpec strict validation，并在一次最终 affected-scope 验证中记录命令、数量与结果
- [x] 8.5 编写 `docs/acceptance/implement-account-access-lifecycle-backend.md`，分别记录本地实现、隐私检查、迁移/回滚、provider/地区配置、真实环境证明和所有 BLOCKED 项
- [ ] 8.6 使用真实国际手机号与合格短信 provider 完成请求、送达、错误码、冷却、限流和成本 smoke，并使用真实 Google/微信配置验证首次登录、绑定、冲突和注销后拒绝；缺少任一必要凭据/政策证据时记录 BLOCKED、保持本任务未完成且不归档 change
