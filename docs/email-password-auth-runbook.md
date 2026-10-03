# 邮箱密码认证运行说明

后端和移动端页面已有本地实现；真实发信验收与部署仍未完成。真实 SMTP/发信域名/受控邮箱未配置，后端验收任务 5.4 保持 BLOCKED；完成真实投递验收前不要开启真实环境入口或归档后端 change。

## 配置与启动

先执行 `source ~/.nvm/nvm.sh && nvm use`，保持 Node 24.21.0、pnpm 12.3.4。迁移为 `20260923000000_email_password_auth`，只新增五张表、索引与邮箱凭据到 User 的关系，不从 OAuth 邮箱自动创建身份。

1. 关闭 `EMAIL_PASSWORD_AUTH_ENABLED`，备份目标数据库，再通过目标环境的 `DATABASE_URL` 执行 `pnpm --filter @slogan/api db:migrate:deploy`。
2. 将 `EMAIL_SMTP_HOST`、`EMAIL_SMTP_PORT`、`EMAIL_SMTP_USER`、`EMAIL_SMTP_PASSWORD`、`EMAIL_SMTP_FROM` 配置到部署秘密环境。密码不写入 Git。TLS 模式用 `TLS`（常用 465）或 `STARTTLS`（常用 587），强制证书校验、最低 TLS 1.2；SMTP 总超时由 `EMAIL_SMTP_TIMEOUT_MS` 限定。
3. 配置 `EMAIL_VERIFY_URL` 和 `EMAIL_RESET_URL` 为固定可信 HTTPS 页面，分别指向移动端 Web 路由 `/email/verify` 和 `/email/reset`，不允许 userinfo、query 或 fragment。开发机预览可分别使用 `http://localhost:8082/email/verify` 和 `http://localhost:8082/email/reset`；真实环境必须使用已验证的 HTTPS 域名。客户端从 fragment 读取单次 token，立即清理浏览器地址栏，再由用户明确 POST 确认；GET 不消费凭据。原生设备的关联域名/通用链接仍需真机验收。
4. 配置独立 HMAC/AES 密钥环：`EMAIL_AUTH_HMAC_KEYS`、`EMAIL_AUTH_AES_KEYS` 均为 JSON 对象，键是 keyId，值是独立的 32 字节随机密钥的标准 base64；活动键由 `EMAIL_AUTH_HMAC_KEY_ID`、`EMAIL_AUTH_AES_KEY_ID` 选择。最多保留 4 个键。可在秘密管理环境使用 `openssl rand -base64 32` 生成，密钥不与数据库明文备份。轮换期间保留旧键，等待已有申请、挑战和载荷清理后再移除；多实例同步活动 HMAC keyId，避免配额分裂。
5. 配置 `REDIS_URL`。来源默认 20 次/15 分钟，登录目标 10 次/15 分钟，邮件目标 5 次/小时，全局邮件 100 次/小时；对应 `EMAIL_AUTH_*_LIMIT` 有硬上限。未知身份照样计数；Redis 失败拒绝新密码尝试/邮件请求，SMTP 故障不阻止已有账号的密码登录。
6. 若经过代理，`EMAIL_AUTH_TRUSTED_PROXIES` 仅填写受控代理的 IP/CIDR；默认不信任转发来源。禁止宽泛信任公网来源。反向代理不得记录请求正文、完整 URL 查询或邮件 fragment。
7. 配置完整并完成目标环境验收后才开启 `EMAIL_PASSWORD_AUTH_ENABLED=true`。API 执行 `pnpm --filter @slogan/api start`，独立 worker 执行 `pnpm --filter @slogan/api start:auth-mail-worker`；发布前先 build。两者使用相同数据库、密钥与开关。worker 每秒检查，单批最多 20 条，无重入；关闭时不投递。

本地 SMTP 捕获仅在 `NODE_ENV=test`、`EMAIL_SMTP_TLS_MODE=LOCAL_TEST` 且 host 为 loopback 时允许明文。本地 runtime 测试使用 smtp-server 3.19.13，实际 SMTP 客户端为 nodemailer 10.0.10；不把捕获邮件当作外部送达证据。

## 会话、重试与清理

- 注册成功仅返回 32 随机字节管理凭据、过期和冷却时间，无 User/session；管理凭据丢失不能凭邮箱修改原申请。每个目标最多 3 个同时有效申请，24 小时固定过期。
- 注册/绑定验证 token 30 分钟、重置 token 15 分钟、重新认证 proof 5 分钟；重发至少 60 秒，替换 generation，不延长申请期限。token、管理凭据和 proof 在数据库中只保存 HMAC 摘要。
- SMTP outbox 仅保存 AES-256-GCM 加密的最小投递参数，AAD 绑定投递 ID/keyId。每次领取有 60 秒租约和 generation fencing，最多 5 次指数退避。Message-ID 固定，但 SMTP 超时/提交丢失仍可能重复发同一链接；链接单次消费，不提供 exactly-once 承诺。
- 投递完成立即清除载荷；最终失败也立即清除。worker 清理过期/已消费挑战的待投递载荷，过期申请立即清除临时身份与密码；最迟不得超过 24 小时。到期 7 天后的临时元数据删除。worker 长期停机会延误清理，应监控进程与最老待清理记录年龄，恢复后首先清理再领取。正式身份和安全审计不会被该清理删除。
- 已消费或命令重复不会替换原凭据；同一绑定命令再次提交返回 `EMAIL_COMMAND_CONFLICT`，不要自动生成新命令绕过重新认证。失败事务回滚 proof 消费。密钥丢失导致待发载荷无法恢复时标记失败，不泄露明文；保留 HMAC 旧键时可持管理凭据受控重发，否则原申请过期后重新申请。
- 密码计算在事务外，提交时锁 User 再锁 EmailCredential 并重查版本。重置递增版本、撤销全部平台会话、失效旧 proof/挑战；响应丢失后用新密码登录。不声称已发 LiveKit 媒体 token 立即失效。
- 注销后销毁密码散列、失效临时凭据，保留用户名/邮箱唯一占用。受限记录仅暴露 EMAIL_PASSWORD 类型；普通登录方式只返回固定脱敏 mask，不返回邮箱。

## 回滚

关闭 API 与 worker 的邮箱开关并回退应用版本，保留新增表与既有身份。关闭期间邮箱独有用户无法密码登录，发布前应说明影响。不要删表、恢复旧密码、恢复已撤销会话，也不要通过旧数据库快照让已注销身份复活。既有 OAuth/手机号入口和原会话撤销机制继续运行。

## 本地验证环境隔离

本地 PostgreSQL 17.6 与 Redis 7.4.11 由 `apps/api/docker-compose.test.yml` 提供，端口 54329/56379。邮箱配额测试使用 Redis DB 8，HTTP 测试使用 DB 9，并清理这些测试库；仅对隔离测试容器执行测试。

现有 `apps/api/.env` 的空白可选 STT/备份值会被 Zod 拒绝，默认 Redis 地址也可能让旧 realtime runner 等待连接。本次未改动该凭据文件。复现验证时，在测试 shell 显式设置以下无秘密配置；测试自行开启 Redis 时会覆盖空值：

```sh
export REDIS_URL=
export AI_EXPRESSION_DATA_USE=REQUEST_PROCESSING_ONLY
export STT_DATA_USE=REQUEST_PROCESSING_ONLY
export STT_DELETION_MODE=NO_RETENTION
export STT_STREAMING_MODE=SHORT_WINDOW
export BACKUP_ENVIRONMENT_ID=local-test
export BACKUP_ENCRYPTION_KEY_ID=local-test-key
export BACKUP_RETENTION_COUNT=1
export BACKUP_RPO_SECONDS=60
export BACKUP_RTO_SECONDS=60
```

这些值只用于隔离测试与合同生成，不能作为真实 STT、备份或邮件供应商证明。最终命令与结果见验收记录。

## 原型与合同

唯一合同为 NestJS decorators 生成的 `openapi/openapi.yaml`。现有 `packages/api-client` 仍是无生成脚本的目录骨架，本次没有另写客户端类型或第二份合同；未来客户端按唯一合同生成。邮箱验证返回成功后要求密码登录，不以邮件链接自动发业务会话。原型 `add-email-password-auth` 的视觉验收仍独立；未来同步其 delta 时须处理这个流程差异，不直接覆盖后端规格。
