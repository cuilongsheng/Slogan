## Why

当前 API 只有可运行的 NestJS 外壳，尚未具备账号、会话、资料或成年访问能力；房间、语音和安全模块都无法建立可信的用户身份与准入边界。先实现 `identity-and-profile` 的后端闭环，同时确定首批 API、数据库和认证架构，可以为后续房间控制面提供稳定基础。

## What Changes

- 实现现有 `identity-and-profile` capability 的后端：Google/微信第三方身份登录、同一 issuer + subject 幂等关联、首次资料初始化、当前用户资料读取与修改、资料完成状态和 18 岁准入判断。
- 建立 PostgreSQL + Prisma 的首批持久化模型与 migration，覆盖平台用户、第三方身份、资料和可撤销会话。
- 在 Architecture 阶段确定并落实唯一 OpenAPI contract 的生成方式；本变更建议采用 NestJS code-first generation，由确定性验证脚本生成并校验 `openapi/openapi.yaml`，有 CI 后执行同一命令，不得并行维护手写 contract。
- 建立移动端可用的 access token + rotating refresh token 会话模型；refresh token 仅保存不可逆摘要，并支持轮换、撤销和重放检测。
- 通过 provider adapter 隔离 Google 与微信认证；自动化测试使用确定性 fake adapter，真实 provider 验收必须使用各自合法配置，不以模拟结果冒充线上认证成功。
- 为首批公开 API 接入配置校验、结构化日志、安全响应头、CORS allowlist、认证/刷新接口限流、统一错误 code 和请求关联 ID。
- 为 domain policy、Prisma repository、会话轮换和关键 HTTP 流程提供单元、集成与 API e2e 证据，并生成可审阅的 OpenAPI contract。

### Confirmed Scope

- 本变更实现 `openspec/specs/identity-and-profile/spec.md` 已确认的行为，不改变其产品要求。
- 年龄依据用户自报的出生年月计算；本批次不声称完成证件级年龄核验。
- 同一 `provider + providerSubject` 必须映射回同一平台账号。
- 资料未完成或未满 18 岁的身份可以登录及维护自己的资料，但不能取得房间业务准入资格。

### Non-goals

- 不实现房间、Redis 并发容量、LiveKit、房主控制、举报处罚、STT、AI、好友或管理员后台。
- 不实现手机号自主注册、短信验证码或证件级年龄核验。
- 不实现不同 OAuth provider 账号之间的自动合并或手动绑定。
- 不提供公开用户资料查询接口，避免在资料可见性未决前扩大数据暴露面。
- 不实现前端页面或真实设备 UI 验收。

### Future Roadmap

- 0.0.1 后端按交付切片推进：身份与资料 7 个开发日；房间控制面 6–8 日；LiveKit 语音与房主控制 6–9 日；安全举报与审计 4–6 日；联调与发布加固 3–5 日。合计约 26–35 个纯开发工作日，不含 Figma、平台审核、凭证等待和产品 review。
- 后续每个切片独立建立或更新 OpenSpec change，不让一个大 change 同时占用全部模块。
- 手机号注册、账号合并和更强年龄核验保留给后续版本决策。

### Unresolved Decisions

- Google 与微信的正式应用凭证、redirect URI 和各环境配置尚需在实施前由项目所有者提供。
- hosted CI provider 尚未选择，当前先保证所有验证可由单一仓库命令重复执行；初始化 Git 并确定托管平台后再接入对应 pipeline。

## Capabilities

### New Capabilities

<!-- 无。本变更实现已有 current requirements，不引入新的产品 capability。 -->

### Modified Capabilities

<!-- 无。identity-and-profile 的 requirements 不变，skip_specs=true。 -->

## Impact

- Impacted delivery stages: Architecture、Backend / API、Test / Acceptance。
- 主要影响 `apps/api/src/modules/auth`、`users`、`profiles`、`apps/api/src/infrastructure/oauth`、`database`、`observability`、`apps/api/prisma`、`openapi/openapi.yaml` 和 API 测试。
- 将新增 Prisma、PostgreSQL 驱动、JWT/密码学、OpenAPI、日志和 HTTP 安全相关依赖；不引入 Redis 或 LiveKit。
- 数据库从无业务 schema 进入首个 schema；migration 必须可在空库升级，并提供开发环境恢复方案。
- API contract 一经生成即成为唯一发布契约，后续前端只能通过 generated client 消费。
