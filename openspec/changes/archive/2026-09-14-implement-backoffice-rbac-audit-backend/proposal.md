## Why

现有后端只有普通用户身份与会话，尚不能可信地区分平台管理员、安全员、运营分析员和审计员，也没有可供后续案件处理复用的后台操作审计。安全案件、账号限制和运营查询继续开发前，需要先建立最小权限、可撤销角色和不可绕过的服务端后台边界。

## What Changes

- 新增数据库持久化的后台多角色授权，支持 `PLATFORM_ADMIN`、`SAFETY_OFFICER`、`OPERATIONS_ANALYST` 和 `AUDITOR`；同一用户可同时拥有多个角色。
- 复用现有 OAuth、access token、持久会话和账号状态校验，不建立第二套后台登录；每次后台请求从 PostgreSQL 读取当前有效角色，使角色撤销无需等待旧 token 过期。
- 新增一次性运维 bootstrap 命令，按已有平台 `userId` 为首个后台账号同时授予平台管理员和安全员角色；命令幂等、留下系统审计且不接受邮箱作为唯一身份。
- 新增仅平台管理员可用的角色查看、授予和撤销 API；禁止撤销最后一个有效平台管理员，角色变更与成功审计必须在同一数据库事务中提交。
- 新增后台当前身份 API，向已授权后台用户返回最小身份和角色集合；无后台角色的普通用户不能进入任何后台 API。
- 新增独立后台审计事实，记录 actor、操作时角色快照、action、target、reason、result、时间和请求关联标识；平台管理员和审计员可以分页查询，查询本身也必须被审计。
- 更新唯一 OpenAPI contract，并以权限绕过、角色即时撤销、并发角色修改、最后管理员保护和日志脱敏作为主要验收失败路径。

### Confirmed Scope

- 用户于 2026-09-14 确认首个后台账号由本人使用，并希望同时拥有管理员和安全员角色；采用按现有 `userId` 执行的一次性运维 bootstrap。
- 平台管理员、安全员、运营分析员和审计员遵循最小权限；管理员账号只有在同时持有安全员角色时，才能执行后续案件处理动作。
- 角色可以并存、撤销后立即失效；当前 change 只建立角色、后台入口保护、角色管理和后台审计，不赋予未实现业务能力。
- 继续采用 NestJS code-first 确定性生成 `openapi/openapi.yaml`，PostgreSQL 是角色和审计的持久事实来源。

### Non-goals

- 不实现举报案件、证据包、案件分配、账号限制、申诉、永久禁用、房间禁用/恢复或安全员处罚动作。
- 不实现 PC 管理端页面、移动端入口、后台独立密码、SSO、MFA、组织/租户、字段级自定义权限或用户自助申请角色。
- 不实现平台指标、活跃排名、风险聚合、通用用户/房间后台查询或审计导出。
- 不改变普通用户房间、预约、举报、LiveKit 和历史接口的授权行为，不把角色写入 LiveKit token。
- 不执行生产部署或创建真实管理员数据；bootstrap 只提供受控命令和本地验收证据。

### Future Roadmap

- `implement-safety-case-restrictions-backend` 复用安全员角色和后台审计，新增案件、限制、申诉与恢复。
- `implement-room-safety-actions-backend` 复用相同权限边界实现房间警告、禁用和恢复。
- 后续运营与审计 change 增加聚合指标、受限业务查询、告警和导出；不会在本 change 预建空接口。
- 管理员账号的 provider 凭证恢复、MFA 和生产 break-glass 流程在部署/安全加固 change 中决定，不能通过普通 API 绕过现有会话校验。

### Unresolved Decisions

- 当前实现范围没有阻塞规划的产品选择。生产环境由谁执行 bootstrap、如何保管数据库访问权及管理员 provider 凭证恢复流程，留给部署 change，不在仓库中保存真实账号或凭证。

## Capabilities

### New Capabilities

- `backoffice-access-control`：后台多角色授权、首个管理员 bootstrap、服务端角色校验、角色管理及最后管理员保护。
- `backoffice-audit`：后台高权限访问和操作的持久、可查询、最小化审计记录。

### Modified Capabilities

无。

## Impact

- Impacted delivery stages: Architecture、Backend / API、Test / Acceptance。
- 主要影响 `apps/api/src/modules/auth` 的认证后身份上下文、`users` 的角色归属、`audit` 的后台审计能力、跨模块后台授权 guard/decorator、Prisma model/migration、bootstrap script 和 `openapi/openapi.yaml`。
- 新增后台当前身份、角色管理和审计查询 API；现有普通 API contract 保持兼容。
- 角色修改和审计需要同事务边界；审计读取需要稳定分页、字段白名单和访问审计，不能记录 token、provider secret、密码或举报正文。
