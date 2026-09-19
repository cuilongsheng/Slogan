## Why

身份与资料后端已经提供可信 `userId` 和 `PROFILE_REQUIRED`、`AGE_RESTRICTED`、`ELIGIBLE` 准入结果，但产品仍没有可供前端联调的房间 API。下一步先实现即时房间发现与加入的服务端控制面，使设计中的列表、创建和加入页面能够围绕真实 OpenAPI contract 开发，同时把容量、密码和准入规则固定在后端。

## What Changes

- 实现 `instant-room-discovery` 已确认 requirements 的后端闭环：合格用户创建 2–6 人、默认 2 小时的即时房间，支持公开房间和 4 位数字密码房间。
- 提供经过认证的即时房间列表、详情、创建和加入 API；列表与详情返回主题、CEFR、当前人数/上限、开始/结束时间、房主昵称和密码状态。
- 将房主作为创建后的首个有效成员；重复加入保持幂等，不重复占用容量。
- 在加入事务中执行账号状态、资料/年龄、房间状态、规则确认、密码和容量校验；并发竞争最后一个名额时最多一个请求成功。
- 使用服务端 pepper 的 HMAC 保存和校验 4 位房间密码，不保存或返回明文密码。
- 增加房间与成员关系的 PostgreSQL additive migration、repository/application/domain 分层、稳定错误 code、NestJS code-first OpenAPI 输出及对应单元、集成和 HTTP E2E 证据。

### Confirmed Scope

- 只实现 `openspec/specs/instant-room-discovery/spec.md` 和入房时服务端需要执行的 `localization-and-room-rules` 确认边界，不修改这些 current requirements。
- 房间容量包含房主；创建成功时当前人数为 1。
- 密码状态可以公开，密码内容不能公开；密码比较必须使用恒定时间比较。
- PostgreSQL 保存房间和成员事实，并通过事务/行锁保证容量；当前不为这一项单独引入 Redis 双写。
- OpenAPI 继续由 NestJS code-first 确定性生成，`openapi/openapi.yaml` 仍是唯一发布 contract。
- `implement-identity-profile-backend` 暂不归档；本 change 只依赖其已实现并验证的身份、会话和准入 application API。

### Non-goals

- 不实现 LiveKit token、音频发布/订阅、实时 presence、断线重连或 webhook。
- 不实现房主移交、移除成员、重新邀请、主动结束、房间延长或安全员操作。
- 不实现预约房间、好友、空闲人员、房间历史、举报、STT、AI 或会后词汇。
- 不实现前端页面、Figma 还原、generated frontend client 或统一产品验收。
- 不建立当前 requirements 尚未定义的 3/12/24 小时临时限制和申诉模型；当前只校验账号为可用状态以及资料/年龄准入结果。

### Future Roadmap

- 下一后端 change 接入 LiveKit 语音凭证、房主控制、离开/移交、60 秒重连和房间结束。
- 基础举报、审计和临时限制在独立安全 change 中实现。
- Redis 仅在 presence、跨实例协调或已证明需要的容量缓存出现时引入，PostgreSQL 继续作为成员事实来源。

### Unresolved Decisions

- 暂无阻塞本 change 的产品决策。房间普通成员离开、房主离开和实时在线人数属于后续 LiveKit/host-controls change，不在本批次定义新行为。

## Capabilities

### New Capabilities

<!-- 无。本变更实现已有 current requirements，不引入新的产品 capability。 -->

### Modified Capabilities

<!-- 无。current requirements 不变，skip_specs=true。 -->

## Impact

- Impacted delivery stages: Architecture、Backend / API、Test / Acceptance。
- 主要影响 `apps/api/src/modules/rooms`、profiles/auth 的公开 application 边界、`apps/api/prisma`、API 测试和 `openapi/openapi.yaml`。
- 增加房间密码 pepper 配置；不引入 Redis、LiveKit 或新的服务进程。
- 数据库增加即时房间与成员关系表和索引；migration 必须能从现有 identity/profile schema 前向升级，回滚采用应用回退与 forward fix，不对已有数据执行破坏性 down migration。
- 该 change 完成后只提供后端/API 联调条件，产品验收继续按用户要求延后到前端完成后统一进行。
