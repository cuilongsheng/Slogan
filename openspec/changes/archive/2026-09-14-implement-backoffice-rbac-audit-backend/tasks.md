## 1. 前置核验与模块边界

- [x] 1.1 在 Node 24.21.0 下核验现有 auth/session、User 状态、audit/RoomEvent 公开入口、Prisma 迁移链和当前后端测试基线，将实际 revision、命令与结果记录到 `docs/acceptance/implement-backoffice-rbac-audit-backend.md`；Google/微信 provider review 只按真实状态记录，不作为本地 RBAC 实现的假 PASS 或无关阻塞
- [x] 1.2 建立 `backoffice` 模块及其 application/domain/infrastructure/presentation 公共边界，并扩展 `audit` 的后台审计所有权，删除被真实文件替代的 `.gitkeep`；通过定向 typecheck 与 dependency check 验证 domain 不依赖 NestJS/Prisma、跨模块只走公开入口且无循环依赖

## 2. 持久角色与审计模型

- [x] 2.1 新增四种后台角色、`BackofficeRoleAssignment` 和 `BackofficeAuditEvent` 的独立 Prisma model，加入角色唯一键、撤销历史、版本、普通 actor 请求幂等键、稳定查询索引及 RESTRICT 用户关系；通过 Prisma validate 和 schema 约束测试验证一用户多角色、重复分配防线及现有 User/RoomEvent 不被改写
- [x] 2.2 创建 additive migration，并在空数据库及包含现有用户、会话、房间、举报、预约和 RoomEvent 的升级 fixture 上执行；通过真实 PostgreSQL migration 测试验证历史数据保留、默认无后台角色、旧版本基础 API 在新增表上兼容及回退保留安全数据
- [x] 2.3 实现后台角色、权限、reason 规范化和命令内容比较的纯 domain policy；通过单元测试验证四角色权限并集、管理员不隐含安全员、1–500 Unicode 码点边界、trim 等价重试和不同 action/target/role/reason 冲突

## 3. 当前角色授权边界

- [x] 3.1 实现按当前 ACTIVE 用户读取未撤销角色的 repository port/adapter，不从 token、Redis 或客户端字段取角色；通过真实 PostgreSQL 测试验证多角色、撤销/重新授予、DISABLED/DELETED 用户失权和角色快照不反向改写
- [x] 3.2 实现后台权限 decorator/guard 和公开 application API，在现有 AccessTokenGuard 之后校验当前持久角色；通过定向 HTTP E2E 验证无会话 401、普通用户和错误角色 403、多角色权限并集、直接请求绕过失败及旧 access token 在角色撤销后立即失权
- [x] 3.3 实现 `GET /v1/backoffice/me` 的薄 controller 与最小 presenter；通过 HTTP E2E 验证任一后台角色可读、角色稳定排序，并确认响应只有 userId/roles 且不含 token、provider subject、邮箱、手机号或其他资料

## 4. 后台审计写入与隐私

- [x] 4.1 实现后台审计 domain 类型、repository/query port 和可复用的公开 infrastructure 事务追加入口，保持 RoomEvent 现有行为不变且 Prisma transaction 不进入 application/domain；通过 integration test 验证 actor 类型、角色快照、action/target/reason/result/request 关联准确及 RoomEvent 回归
- [x] 4.2 为 bootstrap、角色列表、角色 mutation 和审计列表建立显式 action/details 白名单，禁止原始 DTO、header、异常对象或自由 JSON 透传；通过单元与真实 repository 测试验证审计不含 token、provider secret、密码、举报正文、SQL 或 stack
- [x] 4.3 扩展日志字段白名单与脱敏路径并捕获实际 StructuredLogger 输出；通过日志测试和失败响应测试验证后台鉴权、校验、冲突及持久化异常只记录固定事件名、requestId 和稳定结果码，不泄露 reason 原文、游标、凭证或数据库细节

## 5. 首个管理员 bootstrap

- [x] 5.1 实现按已有 userId 执行的一次性 bootstrap application use case 和仓库命令，使用固定事务锁原子授予 `PLATFORM_ADMIN`、`SAFETY_OFFICER` 并追加 `SYSTEM_BOOTSTRAP` 审计；通过命令级真实 PostgreSQL 测试验证首次成功、相同完整状态幂等且不重复审计、非法/不可用用户和部分状态失败无部分写入
- [x] 5.2 验证并发 bootstrap 与日常角色管理隔离；通过真实 PostgreSQL 并发测试确认两个不同目标竞争时只建立一个首个管理员、已有管理员后 bootstrap 不能提升其他账号，且命令输出不包含数据库 URL、provider 信息或凭证

## 6. 角色管理和最后管理员保护

- [x] 6.1 实现平台管理员的角色授予/撤销 application service，将角色修改和成功/拒绝审计放入同一事务；通过成功与双边失败注入测试验证全部提交或全部回滚、重复授予/撤销返回持久最终状态且管理员角色不自动赋予安全员动作权限
- [x] 6.2 使用 `(actorUserId,clientRequestId)` 持久幂等及事务外安全重读处理重试和唯一冲突；通过真实 PostgreSQL 并发与进程/连接重建测试验证相同命令只有一个结果/审计，同标识不同命令稳定冲突，不同管理员相同标识相互隔离
- [x] 6.3 实现平台管理员集合的固定事务锁和最后管理员 policy；通过真实 PostgreSQL 测试验证唯一管理员撤销被拒绝并保留审计、先授予后撤销可转移、并发撤销多个管理员不会降为零，以及失败请求不修改其他角色
- [x] 6.4 实现角色分配稳定游标分页及 userId/role/active 白名单过滤，并把敏感读取与审计写入同一事务；通过 integration/HTTP 测试验证分页无重漏、过滤隔离、查看审计写入失败时不返回列表及响应不暴露用户认证资料

## 7. HTTP、审计查询与 OpenAPI

- [x] 7.1 实现角色 grant/revoke endpoint、DTO 和最小响应，要求 UUID clientRequestId 与有效 reason；通过 HTTP E2E 覆盖管理员成功、多角色目标、非管理员绕过、非法 UUID/role/reason/额外字段、目标不存在、幂等重试和请求冲突，检查拒绝路径无未授权副作用
- [x] 7.2 实现仅 `PLATFORM_ADMIN`/`AUDITOR` 可用的 `GET /v1/backoffice/audit-events`，提供稳定游标及时间/actor/action/target/result 过滤且不提供 update/delete/export 路由；通过 HTTP E2E 验证审计员只读、管理员读取、安全员/运营分析员拒绝、非法过滤，以及每次成功敏感读取自身产生访问审计
- [x] 7.3 添加 `BACKOFFICE_ACCESS_DENIED`、`BACKOFFICE_USER_NOT_FOUND`、`LAST_PLATFORM_ADMIN_REQUIRED` 和 `BACKOFFICE_REQUEST_CONFLICT` 的稳定协议映射；通过 HTTP E2E 验证对应 403/404/409、现有认证 401、校验 400 和数据库失败 500 均不泄露内部信息
- [x] 7.4 更新 Swagger decorators/DTO 并生成唯一 `openapi/openapi.yaml`；通过 `pnpm --filter @slogan/api openapi:check` 和现有 Swagger parser 测试核对 bearer auth、角色 enum、必填字段、分页响应、错误状态及无审计修改路由，确认普通 API 无 contract drift

## 8. 集成验证与验收记录

- [x] 8.1 使用真实 PostgreSQL 与确定性测试身份完成“普通用户 → bootstrap 为管理员兼安全员 → 授予审计员 → 撤销角色 → 旧 token 立即失权 → 管理员/审计员读取审计”的 HTTP/CLI 闭环，并查询持久表核对准确角色与审计数量；记录命令和脱敏结果，不使用真实账号/provider 凭证或内存 repository 代替数据库证据
- [x] 8.2 回归现有 auth、profiles、rooms、voice、host controls、reports、appointments、history/notes 和 RoomEvent 流程，使用最小受影响测试确认新增全局 guard/module wiring 不改变普通用户行为，未执行的 LiveKit Cloud 与 OAuth provider smoke 保持原状态
- [x] 8.3 全部实现任务完成后运行一次 `pnpm verify:api`、`pnpm format:check`、`pnpm deps:check` 和 OpenSpec strict validation，将每个 delta 场景、实际测试数量、Node/OpenSpec 版本、迁移/回退证据及 PASS/FAIL/BLOCKED 写入验收文档；明确 PC 管理端、生产 bootstrap、MFA/break-glass 和部署未在本 change 验收，不自动归档
