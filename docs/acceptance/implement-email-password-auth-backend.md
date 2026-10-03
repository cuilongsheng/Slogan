# 邮箱密码认证后端验收

状态：本地实现与验证完成（17/18 项）；真实邮件验收 BLOCKED，未完成项目验收，未部署，未归档。

## 数据与密码基础

- 2026-09-23：Prisma validate/generate 通过。增量迁移在本地 PostgreSQL 17.6 测试库执行成功。
- `email-auth-migration.spec.ts`：2/2 通过；空库与 OAuth/手机号/会话/注销用户历史 fixture 均验证，旧行保持不变，无自动创建邮箱身份，注销身份唯一占用有效。
- `email-password.policy.spec.ts`：4/4 通过；大小写、plus/dot、Unicode 码点、原始密码字节、独立盐、dummy 校验及队列上限。
- Node 24.21.0 本地 scrypt 抽样：两次并行 N=32768/r=8/p=1 共 66ms，进程最大 RSS 114784 KiB。此为本机抽样，不是生产容量承诺。
- 每个散列核心工作内存约 32MiB，maxmem=64MiB；每个进程最多 2 个计算、20 个排队，超出返回不可用；多进程须按进程数预算资源。

## 外部验收

2026-09-23 用户确认尚未配置真实 SMTP/已验证发信域名/受控收件邮箱。任务 5.4 保持 BLOCKED、未勾选，不归档；不得用本地捕获邮件代替。本地证据见下表。

## 场景证据映射

以下均为本地证据。`test/` 路径相对 `apps/api/`。

| OpenSpec scenario    | 证据                                                                                                       | 状态    |
| -------------------- | ---------------------------------------------------------------------------------------------------------- | ------- |
| 新注册与已占用身份   | integration/email-auth：pending cap、旧申请密码不变；e2e/email-auth：占用拒绝                              | PASS    |
| 同一身份并发验证     | integration/email-auth：并发验证仅一个用户提交、失败事务回滚                                               | PASS    |
| 完成验证             | e2e/email-auth：POST 确认无会话，密码登录进入 PROFILE_REQUIRED                                             | PASS    |
| 过期、重复或错误目的 | integration/email-auth：错目的、期限、重复确认拒绝                                                         | PASS    |
| 重发与抢占防护       | integration/email-auth：管理摘要查找、60 秒、旧 generation、固定过期                                       | PASS    |
| 成功登录与权限边界   | e2e/email-auth：PROFILE_REQUIRED、AGE_RESTRICTED、后台无角色拒绝                                           | PASS    |
| 禁用、注销和无效密码 | e2e/email-auth：统一凭据错误、非 ACTIVE 拒绝                                                               | PASS    |
| 密码重置成功         | e2e/email-auth：SMTP 捕获、旧 access/refresh/密码失效、新密码恢复                                          | PASS    |
| 并发旧密码登录与刷新 | integration/email-auth：真实 PostgreSQL reset/refresh/login 并发、晚到旧版本拒绝                           | PASS    |
| 重放与账号枚举       | e2e/email-auth 与 integration/email-auth：已知/未知响应一致、仅合格账号投递、双消费仅一次                  | PASS    |
| 绑定成功             | e2e/email-auth：OAuth 与手机号重新认证、原 userId 和原身份保留                                             | PASS    |
| 身份冲突或会话失效   | e2e/email-auth：跨账号身份冲突、重复凭据、原会话撤销；integration/email-auth：proof 命令/会话/目的/期限    | PASS    |
| 注销后重入           | e2e/email-auth 与 integration/email-auth：密码清除、占用保留、旧 reset/proof 拒绝、命令重放                | PASS    |
| 投递失败与不确定结果 | runtime/auth-mail.smoke：真实本地 SMTP 接收/拒绝/超时、5 次上限、租约恢复/fencing/重复邮件单次消费         | PASS    |
| 链接安全与日志       | runtime/auth-mail.smoke：固定 HTTPS fragment；e2e/email-auth：GET 不消费/拒绝 redirect；unit/log-redaction | PASS    |
| 配额和依赖失败       | integration/email-quota：双实例 Redis 来源/目标/全局配额、冷却、未知目标、失败拒绝；e2e：代理头不可绕过    | PASS    |
| 真实邮件验收缺失     | 用户确认暂无配置，5.4 未执行，不归档                                                                       | BLOCKED |

运行与回滚说明：`docs/email-password-auth-runbook.md`。未修改移动端/管理端 UI，未执行生产发布。

## 最终 affected-scope

2026-09-23 最终完整检查全部退出码为 0。环境：Node 24.21.0、PostgreSQL 17.6、Redis 7.4.11；SMTP 捕获使用 smtp-server 3.19.13，发送使用 nodemailer 10.0.10。

| 检查       | 实际命令                                                                                                                                                   | 结果                       |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| 测试依赖   | `pnpm --filter @slogan/api db:test:up`                                                                                                                     | PASS                       |
| 格式       | `pnpm exec prettier --check 'apps/api/**/*.{ts,js,cjs,json}' docs/email-password-auth-runbook.md docs/acceptance/implement-email-password-auth-backend.md` | PASS                       |
| Prisma     | `pnpm --filter @slogan/api exec prisma validate`、`pnpm --filter @slogan/api db:generate`                                                                  | PASS                       |
| 静态检查   | `pnpm --filter @slogan/api lint`、`pnpm --filter @slogan/api typecheck`、`pnpm deps:check`                                                                 | PASS                       |
| 构建与合同 | `pnpm --filter @slogan/api build`、`pnpm --filter @slogan/api exec node dist/scripts/generate-openapi.js --check`                                          | PASS                       |
| 单元测试   | `pnpm --filter @slogan/api test:unit`                                                                                                                      | 37 suites / 209 tests PASS |
| 集成测试   | `pnpm --filter @slogan/api test:integration`                                                                                                               | 36 suites / 196 tests PASS |
| HTTP E2E   | `pnpm --filter @slogan/api test:e2e`                                                                                                                       | 16 suites / 82 tests PASS  |
| 运行时     | `pnpm --filter @slogan/api test:runtime`                                                                                                                   | 8 suites / 15 tests PASS   |
| 差异与规格 | `git diff --check`、`openspec validate implement-email-password-auth-backend --strict`                                                                     | PASS                       |

共 97 个测试套件、502 个测试通过；这是当前工作区完整 API 测试数量，包含既有功能，不代表全部为本次新增。生成的 OpenAPI 以生成器 drift 检查为准，不额外手动格式化。

运行时证据包含真实 auth-mail worker 子进程：SMTP 接收后强制终止、持久化 RUNNING 租约、重启恢复和重复邮件 token 仅能消费一次。测试手动推进租约到期时间，未等待完整生产租约周期。真实外部送达、域名配置和收件箱效果仍未验证。

测试 shell 的隔离环境覆盖见运行说明；未修改本地凭据文件。Jest 曾提示退出延迟和 Node 实验性 VM 警告，最终进程正常退出且退出码为 0。
