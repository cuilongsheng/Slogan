## 1. 数据与安全基础

- [x] 1.1 增加 EmailCredential、EmailEnrollment、EmailChallenge、EmailAuthProof、EmailDelivery 模型、唯一约束和 additive migration，运行 Prisma validate/generate，并用空库与含 OAuth/手机号/会话/注销账号的真实 PostgreSQL 历史 fixture 验证无自动身份关联或旧数据变化
- [x] 1.2 实现用户名/邮箱规范化、密码长度及常见密码策略、异步带版本散列和 dummy 校验，单元测试覆盖大小写、plus/dot、Unicode、无裁剪、独立盐和错误密码，记录本地散列耗时与并发内存边界
- [x] 1.3 增加默认关闭开关、SMTP/TLS、可信链接、HMAC/AES keyId 和配额配置及 domain ports，启动测试验证缺配置安全失败、不回显秘密、关闭后既有认证照常工作
- [x] 1.4 实现 Redis 来源/目标摘要/全局配额与重发冷却，用双实例 Redis 测试验证原子计数、未知身份同样限流及 Redis 失败拒绝新增尝试

## 2. 邮件投递和注册验证

- [x] 2.1 实现事务邮件 outbox、加密载荷、SMTP adapter 和 auth-mail worker 的领取/租约/fencing/重试，使用本地 SMTP 捕获服务验证成功、拒绝、超时不确定和重启重复投递不增加凭据使用次数
- [x] 2.2 实现待验证注册、管理凭据和重发，PostgreSQL 测试验证每目标申请上限、无 User/session、重复申请不改旧密码、60 秒冷却和 24 小时固定过期边界
- [x] 2.3 实现注册验证一次性消费及邮箱身份创建，用并发测试验证 username/email 唯一竞争、同 token 重放、过期/错目的/旧 generation 拒绝及 GET 不消费
- [x] 2.4 实现完成、替换和过期邮件载荷清除及 enrollment/challenge/proof 元数据清理，runtime 验证 24 小时内容清理、7 天技术元数据清理、worker 重启收敛且不删除正式身份

## 3. 登录、找回与会话一致性

- [x] 3.1 实现用户名密码登录和现有 session 签发适配，定向 HTTP 测试验证正确/错误/未验证/禁用/注销分支、统一凭据错误及资料/成年/后台角色边界
- [x] 3.2 实现统一找回受理和重置邮件，用 HTTP 与 SMTP 测试验证已知/未知/非 ACTIVE 邮箱响应一致、只有合格账号收到邮件及限流不泄露存在性
- [x] 3.3 实现重置原子更新、credentialVersion 和全部平台会话撤销，真实 PostgreSQL 并发测试验证旧密码登录晚到、refresh 竞争、双重消费和响应丢失后新密码登录恢复

## 4. 既有账号绑定与注销

- [x] 4.1 增加当前账号 OAuth/手机号重新认证的 LINK_EMAIL 证明，用定向集成测试验证身份归属、用户/会话/命令绑定、5 分钟过期及注销 proof 不可互换
- [x] 4.2 实现绑定申请与邮件确认、命令重放冲突及 EMAIL_PASSWORD 脱敏登录方式，HTTP/PostgreSQL 测试验证原 userId 保留、跨账号冲突、原 session 撤销和重复绑定拒绝
- [x] 4.3 增加密码注销 proof 并接入现有注销事务，测试验证错误密码/过期 proof 拒绝、密码重置使旧 proof 无效、重放安全、注销后凭据失效与身份占用保留，回归原 OAuth/手机号注销

## 5. 合同与最终验收

- [x] 5.1 补齐 DTO、稳定错误、OpenAPI decorators 和脱敏规则，生成唯一 OpenAPI 并运行 drift 与定向 E2E，验证直接请求不能绕过确认、用途、配额或 RBAC 边界且日志不含凭据/邮箱/正文
- [x] 5.2 全部实现完成后执行一次最终 affected-scope：format、Prisma validate/generate、lint/typecheck、依赖边界、build、OpenAPI drift、完整 API unit/integration/e2e/runtime、git diff --check 和 OpenSpec strict；记录实际命令/数量，失败仅先修复最小范围再重跑最终检查
- [x] 5.3 编写中文验收与运行说明，记录本地 SMTP/数据库/Redis 版本、迁移/关闭回滚、凭据清理、邮件不确定重发、原型冲突处理及外部 BLOCKED；核对每个 spec scenario 的证据，不能仅凭测试全绿勾选未执行验收
- [ ] 5.4 在隔离真实 SMTP/域名及受控收件邮箱上执行注册送达、验证、冷却重发、重置与旧 session 拒绝 smoke，记录脱敏证据；缺配置时保持 BLOCKED、此项未完成且不归档，不以本地捕获邮件或 HTTP fixture 代替
