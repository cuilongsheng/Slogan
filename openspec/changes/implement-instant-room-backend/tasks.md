## 1. 配置与模块边界（计划 0.5 天）

- [x] 1.1 在环境 schema、`.env.example` 和日志脱敏配置中加入至少 32 字符的 `ROOM_PASSWORD_PEPPER` 与非空 `ROOM_RULES_VERSION`，并通过 bootstrap tests 验证缺失或非法配置会阻止启动且 secret 不会进入日志
- [x] 1.2 完善 `apps/api/src/modules/rooms` 的 domain、application、infrastructure 和 presentation 目录及公开 module exports，并通过 `pnpm deps:check` 验证 Controller、Prisma 和跨模块依赖没有越过既定边界
- [x] 1.3 定义房间 DTO、view model、稳定错误 code 和 authenticated principal 输入边界，并通过编译时类型检查与 DTO validation 单元测试验证非法 topic、CEFR、capacity、PIN、cursor 和 `rulesAccepted` 被一致拒绝

## 2. PostgreSQL Schema 与迁移（计划 0.5 天）

- [x] 2.1 增加 `Room`、`RoomMembership`、房间状态和成员角色 Prisma schema，包含 UUID、host、topic、CEFR、capacity、password digest、时间、加入顺序、规则版本及 `(roomId, userId)` 唯一约束，并通过 Prisma schema validation 验证模型可生成
- [x] 2.2 创建只增不减的 migration 与查询所需外键/索引，在从现有 identity/profile migrations 升级的干净测试数据库执行 `pnpm --filter @slogan/api db:test:migrate`，并用 integration schema inspection 验证表、约束和索引存在
- [x] 2.3 实现 rooms repository 的 Prisma 映射与事务入口，确保 domain/application 不暴露 Prisma 类型，并通过 repository integration smoke tests 与 `pnpm deps:check` 验证映射和依赖方向

## 3. 房间领域规则与安全（计划 1 天）

- [x] 3.1 实现即时房间创建 policy：仅接受 2–6 人容量、已支持 CEFR、有效 topic，并由服务端设置 `startedAt` 和默认两小时 `endsAt`；通过冻结时钟和表驱动单元测试验证边界
- [x] 3.2 实现 `RoomAccessPolicy`，覆盖 `ELIGIBLE` 准入、有效开放状态、规则确认、密码结果和容量结果，并通过表驱动单元测试逐一验证稳定错误 code
- [x] 3.3 实现 room-scoped HMAC-SHA-256 密码 digest 与恒定时间校验，数据库和响应仅保留 digest/`passwordProtected`，并通过安全单元测试验证正确 PIN、错误 PIN、不同 room ID、无密码房和输出脱敏
- [x] 3.4 实现创建房间的 application use case，在单一事务内写入 Room 与加入顺序为 1 的 HOST membership，并通过 integration tests 验证容量包含房主、默认时长、密码 digest 和失败事务无残留

## 4. 查询与并发加入（计划 1.5 天）

- [x] 4.1 实现认证用户的开放房间游标列表，按 `startedAt desc, id desc` 返回默认 20、最大 50 条，并通过 integration tests 验证过期/结束房间过滤、稳定翻页、`memberCount` 语义和只投影房主昵称
- [x] 4.2 实现认证用户的房间详情查询，返回房间展示字段与当前请求者 membership 状态，并通过 integration tests 验证开放房间、已加入用户、未加入用户、未知/不可见资源统一 `ROOM_NOT_FOUND` 和到期 `ROOM_ENDED`
- [x] 4.3 实现加入 application use case，在事务中锁定 Room、重复 membership 幂等返回、统计容量、分配加入顺序并保存规则版本/时间，并通过 integration tests 验证公开房、密码房、未确认规则、资料未完成、未满 18 岁、满员和过期路径
- [x] 4.4 增加真实 PostgreSQL 最后一席并发测试，同时提交至少两个合格用户的加入请求，并验证只有一个新增 membership、失败方收到 `ROOM_FULL`、无重复 join order 且事务失败不残留数据
- [x] 4.5 对 serialization/deadlock 数据库冲突实现有限重试且不重试业务冲突，并通过 repository/application tests 验证重试上限、成功恢复和最终错误映射，不产生 500 或重复 membership

## 5. HTTP API 与唯一 OpenAPI Contract（计划 1 天）

- [x] 5.1 实现 `POST /v1/rooms` 与 `GET /v1/rooms` 的 authenticated Controller/DTO/response mapping，并通过 HTTP E2E 验证未认证、资料未完成、未满 18 岁、公开/密码创建、分页列表和响应不泄露密码 digest
- [x] 5.2 实现 `GET /v1/rooms/{roomId}` 与 `POST /v1/rooms/{roomId}/memberships`，并通过 HTTP E2E 验证详情、幂等加入、规则未确认、缺失/错误密码、满员、过期及稳定错误体
- [x] 5.3 更新 NestJS code-first decorators 并确定性生成 `openapi/openapi.yaml`，通过 `pnpm --filter @slogan/api openapi:check` 和 Swagger parser validation 验证唯一 contract 无 drift 且四个端点、schema、认证和错误响应齐全

## 6. 后端验证与延期验收（计划 0.5 天）

- [x] 6.1 运行 `pnpm verify:api`，验证 bootstrap、domain、repository、并发、HTTP E2E、lint、typecheck、build 和 OpenAPI drift 全部通过，并将命令、结果和已知边界记录到该 change 的 acceptance evidence
- [x] 6.2 运行 workspace `pnpm format:check` 与 `pnpm deps:check`，确认 rooms 改动未破坏 monorepo 格式或依赖边界，并在 evidence 中记录 PASS、FAIL 或可复现的 BLOCKED 原因
- [x] 6.3 对照 `openspec/specs/instant-room-discovery/spec.md`、`openspec/specs/localization-and-room-rules/spec.md` 及本 change design 核对后端 criteria；仅记录 verification 已完成，product-owner、视觉、设备与前端联调验收标记为 DEFERRED，保持 change 未归档等待统一验收
