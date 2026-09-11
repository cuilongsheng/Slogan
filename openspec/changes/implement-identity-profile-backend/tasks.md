## 1. API 与运行时基础（计划 1 天）

- [x] 1.1 安装并固定 Prisma/PostgreSQL、OpenAPI、validation、JWT、日志、Helmet 和限流依赖，更新 toolchain registry，并通过 `pnpm install --frozen-lockfile` 与 direct-dependency audit 验证依赖闭环
- [x] 1.2 扩展 Zod 环境配置与 `.env.example`，覆盖 database、JWT/session、CORS 和 Google/微信 provider 配置，并用 bootstrap tests 验证缺失 secret、非法 TTL、非法 origin 会阻止启动
- [x] 1.3 建立 `/v1` prefix、全局 validation、稳定 error body、request ID、Helmet、CORS、Pino/pino-http 和认证限流，使用 API e2e 验证错误不泄露 stack/token 且安全响应头存在

## 2. PostgreSQL 与持久化边界（计划 1 天）

- [x] 2.1 定义 `User`、`OAuthIdentity`、`AuthSession` 和 `UserProfile` Prisma schema 及首个 additive migration，并在全新测试数据库运行 migration 后用 schema inspection 验证表、外键和唯一索引
- [x] 2.2 实现 database module、Prisma lifecycle 和 transaction boundary，确保 Prisma 类型不越过 infrastructure，并通过 dependency-cruiser 与 repository integration smoke test 验证
- [x] 2.3 实现 identity 并发 find-or-create 和 session/profile repositories，通过集成测试验证同一 `(issuer, subject)` 并发请求只产生一个账号、失败事务不残留半成品

## 3. 资料与成年准入领域（计划 1 天）

- [x] 3.1 实现 profile 值对象和字段校验，包括头像、名称、性别 code、国籍或城市、interest codes、CEFR、出生年/月，并以表驱动单元测试覆盖必填、边界长度、重复兴趣和非法枚举
- [x] 3.2 实现 `PROFILE_REQUIRED`、`AGE_RESTRICTED`、`ELIGIBLE` policy 和保守月份算法，通过冻结时钟测试验证跨年、闰年、18 岁当月及次月边界
- [x] 3.3 实现 profiles application use cases 和本人资料 repository adapter，通过集成测试验证完整提交幂等、出生年月变更会重新计算状态且不会暴露他人资料

## 4. OAuth 身份与平台会话（计划 2 天）

- [x] 4.1 定义 `OAuthProviderPort`、provider identity 和稳定 provider error mapping，并用 deterministic fake adapter 验证成功、取消、无效 code、超时和 provider unavailable 路径
- [x] 4.2 实现首次/再次 OAuth 登录 use case，通过 application/integration tests 验证首次创建账号、后续返回同一账号、provider 建议资料不自动完成 profile
- [x] 4.3 实现 access JWT 与 rotating opaque refresh token，使用事务更新 digest，并通过安全单元/集成测试验证签发、过期、撤销、并发刷新和 refresh token 重放后 session 失效
- [x] 4.4 实现 Google adapter 的授权码交换与 issuer/subject 校验，通过 mock HTTP contract tests 验证请求参数、超时、错误映射和日志脱敏；有测试应用凭证时补真实 runtime evidence
- [x] 4.5 实现微信 adapter 的授权码交换与稳定 identity 映射，通过 mock HTTP contract tests 验证请求参数、超时、错误映射和日志脱敏；有测试应用凭证时补真实 runtime evidence

## 5. HTTP API 与唯一 OpenAPI Contract（计划 1 天）

- [x] 5.1 实现 `POST /v1/auth/oauth/{provider}/exchange`、`refresh`、`logout` controller/DTO/guard，并通过 HTTP e2e 验证 token lifecycle、未认证访问和稳定错误 code
- [x] 5.2 实现 `GET /v1/me` 与 `PUT /v1/me/profile`，通过 HTTP e2e 对应验证 identity-and-profile 的首次登录、资料未完成、资料完成、未满 18 岁和已满 18 岁 scenarios
- [x] 5.3 建立确定性 NestJS code-first OpenAPI 生成与 drift check，生成 `openapi/openapi.yaml`，并通过 OpenAPI validation 和二次生成零 diff 验证其为唯一发布 contract

## 6. 综合验收与交付（计划 1 天）

- [x] 6.1 建立独立测试数据库初始化/清理流程，运行 clean migration、repository integration 和 HTTP e2e，验证测试可重复执行且不依赖真实凭证或个人数据
- [x] 6.2 增加 provider-neutral 的 API verification 命令并执行 workspace format、lint、typecheck、build、unit/integration/e2e、dependency boundary 和 OpenAPI drift 全套检查，在 acceptance evidence 中逐项记录 PASS、FAIL 或 BLOCKED；若 hosted CI 已确定则接入同一命令
- [x] 6.3 使用 Google 与微信测试应用分别验证成功、取消授权和无效 code；若凭证或平台审核未就绪，在 acceptance evidence 中明确 BLOCKED 原因且不阻止其余自动化证据完成
- [ ] 6.4 对照 `openspec/specs/identity-and-profile/spec.md` 和本 change 的 design/risks 完成 product-owner review，确认 criteria、runtime、migration 与 contract evidence 后再决定 archive
