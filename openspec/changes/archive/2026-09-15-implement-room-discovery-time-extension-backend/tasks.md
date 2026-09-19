## 1. 数据模型与迁移

- [x] 1.1 在 Prisma multi-file schema 中增加 `RoomVisibility`、Room 的 visibility/shareCode/extensionCount、`RoomTimeExtension` 及 `SYNC_ROOM_TIME` command 类型和关系，并运行 `pnpm --filter @slogan/api db:generate` 验证 Prisma schema 可生成。
- [x] 1.2 编写向前迁移，为既有即时与预约房间回填 `PUBLIC`、唯一 shareCode 和零延长次数，增加范围/唯一性/索引约束，并用迁移集成测试同时验证全新 schema 与历史 schema 升级。
- [x] 1.3 增加 `ROOM_SHARE_BASE_URL` 的 Zod 启动校验、测试环境配置和安全 URL 拼接，并用 bootstrap 单元测试验证生产 HTTPS、本地测试 HTTP 及非法配置拒绝。

## 2. 房间可见性、筛选与分享

- [x] 2.1 扩展房间 domain 类型与 policy，规范化 `PUBLIC | LINK_ONLY`、CEFR 和 1–120 字符主题查询，并用 policy/DTO 单元测试覆盖默认 PUBLIC、非法可见性、大小写及空白主题。
- [x] 2.2 更新即时和预约创建事务以原子保存 visibility 与随机 shareCode，保持密码独立和旧请求默认 PUBLIC，并用 repository 集成测试验证两个房间类型及 shareCode 唯一性。
- [x] 2.3 为即时公开列表增加 visibility、CEFR、主题过滤和绑定筛选上下文的版本化游标，同时兼容无筛选旧游标，并用 repository 集成测试覆盖组合过滤、LINK_ONLY 排除、翻页无重复和游标错配。
- [x] 2.4 为预约公开列表复用同一筛选规范和游标上下文，同时保留预约时间结算、排序及容量投影，并用 appointment 集成测试覆盖 SCHEDULED/OPEN、组合过滤、LINK_ONLY 排除和边界翻页。
- [x] 2.5 实现按 shareCode 查询的专用最小投影，使用数据库时间排除取消、结束中、已结束和已过期房间，并用集成测试证明响应不包含密码摘要、成员、预约人、凭证或 provider 字段。
- [x] 2.6 增加无 bearer token 的分享解析 controller 与稳定 404/不可用错误映射，并用 E2E 测试验证未登录可解析、非法/未知 code 被拒绝且解析动作不创建 reservation、membership 或凭证。
- [x] 2.7 扩展即时和预约创建、列表、详情的 DTO/presenter，按 contract 返回 visibility 和允许位置的 shareUrl，并用 E2E 回归验证旧创建请求、公开/链接房间、密码组合及现有响应字段。
- [x] 2.8 用直接 API E2E 测试证明 shareCode 不能绕过登录、资料、年龄、安全限制、规则确认、密码、容量、预约和 realtime-credentials 授权。

## 3. 房间延长事务与到期行为

- [x] 3.1 实现延长 policy：仅当前合格房主、仅 OPEN 且数据库 now 早于 endsAt、1–60 整数分钟、最多 3 次，并用单元测试覆盖即时/预约、接任房主、开始前、到期边界和次数用尽。
- [x] 3.2 实现加锁的延长 repository 命令，在同一事务更新 endsAt/count/stateVersion 并写入 extension fact、RoomEvent 和同步 command；用集成测试验证所有事实全成或全败。
- [x] 3.3 实现 `(actorUserId, clientRequestId)` 幂等重放和内容冲突，并用集成测试验证相同请求不重复延长、跨房间或不同分钟复用冲突以及并发第三次最多一个成功。
- [x] 3.4 增加统一 `POST /v1/rooms/{roomId}/extensions` application/presentation 流程及稳定 400/403/404/409 映射，并用 E2E 测试校验当前/旧房主、普通成员、SCHEDULED、ENDING/ENDED/CANCELLED 和响应投影。
- [x] 3.5 延长提交后按新 endsAt 安排 expiry job，并强化到期路径对 PostgreSQL 当前时间的锁内复查；用单元与集成测试证明旧 job 不提前结束、不撤销身份，新 endsAt 到达后只结束一次。

## 4. LiveKit 时间同步与恢复

- [x] 4.1 增加版本化 room-time metadata serializer，字段只含 schemaVersion/stateVersion/endsAt/extensionCount，并用单元测试验证稳定 JSON、UTC 时间、字段白名单和版本单调性。
- [x] 4.2 扩展 realtime provider port 与 LiveKit adapter，使 `ensureRoom` 写入最新 metadata、既有房间可更新 metadata，并用 fake adapter/SDK 边界测试覆盖创建、更新、远端不存在和 provider 错误映射。
- [x] 4.3 将 `SYNC_ROOM_TIME` 接入 RealtimeCommand claim/retry/recovery 和 voice dispatcher，worker 每次读取数据库最新快照、在调用后检测新版本，并用集成测试验证重复、失败重试、执行中再次延长及最终收敛。
- [x] 4.4 把延长结果与现有 `COMPLETED | PENDING | UNAVAILABLE` provider 状态连接，远端尚不存在时由下一次 ensureRoom 带入最新 metadata，并用 service/E2E 测试验证三种状态不回滚业务结果。
- [x] 4.5 执行 Redis/worker 停止后延长、原 endsAt 越界、设施重启的 runtime smoke，验证房间继续开放、恢复后调度到新 endsAt 且 metadata command 收敛，并将命令和时间证据写入验收记录。
- [x] 4.6 在具备 LiveKit Cloud 配置时执行两名成员在线的真实 metadata smoke，验证房主延长后双方收到最新 endsAt/stateVersion、旧版本不回退；无配置时在验收记录中明确标记 BLOCKED，禁止记为 PASS。

## 5. Contract、回归与验收

- [x] 5.1 更新 NestJS Swagger DTO/decorator 并重新生成唯一 `openapi/openapi.yaml`，运行 `pnpm --filter @slogan/api openapi:check` 验证分享 public security、筛选参数、延长请求/响应和稳定错误均无 drift。
- [x] 5.2 增加分享解析与延长失败路径的日志/隐私断言，验证日志和错误响应不包含密码、shareCode 全量请求体、成员资料、token、SQL、stack 或 provider secret。
- [x] 5.3 在仓库 `.nvmrc` Node 版本下运行 `pnpm verify:api && pnpm deps:check`，记录 unit/integration/E2E、build、OpenAPI 和依赖边界的完整结果，只把实际通过项标记 PASS。
- [x] 5.4 创建 `docs/acceptance/implement-room-discovery-time-extension-backend.md`，逐项映射 OpenSpec 场景、迁移、并发、Redis 恢复和 LiveKit 证据，并运行 `openspec validate implement-room-discovery-time-extension-backend --strict` 与 `git diff --check` 验证交付可审查。
