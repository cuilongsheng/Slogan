## 1. 依赖、配置与模块边界

- [x] 1.1 激活 `.nvmrc` 的 Node 并核对 engines，固定 LiveKit SDK、ioredis、BullMQ，更新 lockfile/toolchain；通过 frozen-lockfile 安装与 package inventory 验证依赖可复现
- [x] 1.2 增加 REALTIME_ENABLED、LiveKit URL/key/secret、60–600 秒 TTL 和 REDIS_URL 条件校验，更新环境示例/fixtures；通过 bootstrap 测试验证启用时缺失/非法配置拒绝启动、关闭时既有控制面可启动
- [x] 1.3 为 token、Authorization、provider credential 与 webhook raw body 配置日志脱敏；通过日志单元测试验证原值不出现在输出中
- [x] 1.4 建立 voice 到 rooms 公开 application API、provider-neutral ports 与 infrastructure wiring，替换真实职责对应的空骨架；通过 `pnpm deps:check` 验证无 Controller 直连 SDK、跨模块深层导入或循环依赖

## 2. PostgreSQL 实时状态与持久补偿

- [x] 2.1 增加 Room ENDING/version/ended 字段、membership opaque identity/credential version/presence/session 水位、历史 identity 撤销记录与 RoomEvent/RealtimeCommand；通过 Prisma validate 与约束测试验证唯一键/索引，不引入房主管理专属 lifecycle/deadline
- [x] 2.2 创建 additive migration，保留 membership、joinOrder 和外键；通过 `pnpm --filter @slogan/api db:test:migrate` 对空库及已有房间数据 fixture 验证升级和保留字段的恢复路径
- [x] 2.3 实现 RoomEvent/inbox 与 outbox repository，事务内保存业务状态和命令，支持幂等、claim/lease、崩溃重取和状态更新；通过真实 PostgreSQL 测试验证重复写、并发 claim、回滚及原始 payload/token 不落库
- [x] 2.4 扩展 rooms 的授权快照、presence 更新与公共结束 transaction API，并使 join/token 对 ENDING 和 endsAt 拒绝；通过行锁/版本竞争测试验证发证与结束并发不返回失效授权，断线不释放 membership 容量

## 3. Provider adapter、凭证与 Webhook

- [x] 3.1 实现幂等确保 provider room、短期 token 与最小 grants；通过 SDK claims 测试验证 room/opaque identity/TTL、只允许 microphone publish/subscribe 且无 data/metadata/admin/video/screen/PII
- [x] 3.2 实现 provider list、remove/revoke、delete adapter，核实所选 SDK 的显式 cutoff、离线 identity 和 not-found 语义；通过 SDK contract 测试验证错误映射/重试与撤销证据，未证实撤销时不得当成功
- [x] 3.3 配置 NestJS raw body 和 WebhookReceiver，验证 provider Authorization 与 application/webhook+json；通过有效/缺失/篡改签名及普通 JSON endpoint 测试验证验签与原有 validation 无回归
- [x] 3.4 实现 inbox 到规范化 presence/room-finished 的持久处理，按 event ID、当前 identity/session/时间水位去重防倒序；通过 PostgreSQL 测试验证旧 session left、未知 room、重复事件和 room-finished 不错误覆盖当前实例

## 4. Redis/BullMQ、到期与恢复

- [x] 4.1 扩展测试 compose 和 Redis infrastructure，在现有 API 进程建立 queue/worker 生命周期、合法确定性 job ID、有限退避与失败记录；通过真实 Redis 测试验证去重、retry、关闭连接和业务冲突不重试
- [x] 4.2 实现公共结束路径与 room-expiry：锁内判定 endsAt/version 后进入 ENDING，撤销全部未撤销 identity 再 DeleteRoom，完成才 ENDED；通过冻结时钟/数据库测试验证无宽限、迟到 job 不放开发证、重复结束和 cleanup 幂等
- [x] 4.3 实现 outbox dispatcher 的提交后首试、pending 重试与 stale/completed no-op；通过 provider failure/recovery 和进程中断集成测试验证先关闭授权、命令不丢失且不伪报断开成功
- [x] 4.4 实现启动/周期补排 expiry/pending command 及 provider presence reconciliation；通过删除 Redis job、丢失全部 webhook、旧 identity 和 worker 重启测试验证状态收敛且 provider 不创造成员资格

## 5. HTTP 与唯一 OpenAPI

- [x] 5.1 实现 realtime-credentials 与 members 两个认证 endpoint；通过 HTTP E2E 验证账号/房间/membership/到期授权、响应最小字段、成员顺序及出生/地区/provider SID 不泄露
- [x] 5.2 实现 webhooks/livekit endpoint 与稳定错误映射；通过 HTTP E2E 验证合法/重复事件 2xx、非法签名 401、用户 Bearer 不替代签名、REALTIME_PROVIDER_UNAVAILABLE 不暴露密钥
- [x] 5.3 更新 NestJS Swagger DTO/decorator 并生成唯一 `openapi/openapi.yaml`；通过 Swagger parser 和 `pnpm --filter @slogan/api openapi:check` 验证三个新增 endpoint、认证差异和既有 join 到期行为无 drift，不生成管理 endpoint

## 6. 依赖交付与验收

- [ ] 6.1 在隔离 LiveKit Cloud 环境执行 opt-in smoke，验证两身份连接、最小 grants、在线/离线 identity 撤销后旧 token 拒绝、DeleteRoom 断开和签名 webhook；将真实结果写入验收记录，无凭证时记 BLOCKED 并保留本项未完成
- [x] 6.2 在 `docs/acceptance/implement-livekit-voice-session-backend.md` 记录供 host-controls 复用的实际公开 API/事务、事件字段、审计/outbox、身份历史、queue 与结束入口，通过链接到实现和定向测试逐项核对；明确前置 Cloud 限制及 host-controls/前端/设备未验收，release state 不冒充已部署
- [x] 6.3 完成本 change 全部实现后运行一次 `pnpm verify:api`、`pnpm format:check` 和 `pnpm deps:check`，记录 Node、命令与 PASS/FAIL/BLOCKED；对照 current voice-session/basic-safety-reporting 与本 delta 建立范围矩阵，管理场景归下一 change，未运行项不标 PASS
