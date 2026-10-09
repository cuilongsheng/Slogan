# 房间体验修正：Vercel 队列发布方案

适用 OpenSpec：`simplify-room-and-mobile-experience`。当前状态：2026-10-07 已备份线上数据库并成功执行四个迁移；2026-10-08 的 fc7bbf8 已部署，但真实云端清理检查失败。下述请求内播种恢复补丁已通过本地完整 API 检查，待部署重验。

## 问题和处理

旧 leave 接口在数据库提交后继续等待 LiveKit；provider 失败会把已提交的退出误报为 503。新接口返回成员 LEFT、房间业务状态和 PENDING 清理状态，清理命令保留在 PostgreSQL。客户端立即开始静音、断开，退出确认失败时以原成员代次重试。

普通 Nest/BullMQ worker 需要存活的进程。Vercel 可以使用平台托管的 Queues 消费函数承接这项工作，无须另买常驻服务器。这里的队列消费者负责短任务，不承担持续订阅音频的房间语音 worker。

## 拓扑和恢复

- 公开 Nest API：`apps/api/src/main.ts`；Vercel 模式在请求上下文内播种恢复扫描消息，平台 `waitUntil` 追踪发布，不阻塞 HTTP 返回。
- 私有消费者：`apps/api/api/realtime.ts`；`apps/api/vercel.json` 绑定 `queue/v2beta` 和主题 `slogan-realtime`。独立函数很重要：队列触发函数在 Vercel 上不是公开 HTTP API。
- 适配器：`RealtimeQueue` 在 `VERCEL=1` 时发布托管队列消息，不启动 BullMQ Worker；其他环境沿用 Redis/BullMQ。
- 消费者读取 PostgreSQL 的持久命令，执行撤销身份、删除房间、到期及预约任务。数据库和下一次扫描发布失败向 SDK 抛错，按退避重投递。
- 有待清理命令或活跃房间时，下一次扫描延迟 30 秒；空闲时 300 秒。消息只包含任务类型和标识，不包含消息正文、音频或凭证。
- 并发 HTTP 请求共用一个在途播种；只有成功发送才进入五分钟冷却，失败在下一请求重试。后续请求也能重新播种中断的扫描链。启动阶段不发送恢复消息，避免缺少请求 OIDC 上下文。
- 即使单次命令发布失败，扫描仍会再次读取 PostgreSQL。重复投递由既有事务、命令代次和状态检查吸收；不回退已退出成员的业务状态。

Vercel Queues 当前为 beta，有用量限制及按操作计费规则；本实现不能承诺无限免费或与服务故障无关的即时撤销。SDK 保留期设为 7 天，过期消息不能承担无限期恢复。如果首轮播种失败、扫描链停止或停机超过保留期，应检查日志、恢复数据库/队列并重新播种（部署后或冷却到期后的 HTTP 请求），从数据库重建任务；命令本身不因队列过期而删除。上线须验证该恢复路径，不能用本地 SDK mock 代替。

## 发布顺序

1. 在确认的数据库目标备份后，执行 Prisma 增量迁移：`20261007100000_room_level_ranges`、`20261007100100_room_text_messages`、`20261007100200_room_level_range_upper_bound`、`20261007100300_room_message_foreign_keys`。已发布的历史迁移不改写。
2. Vercel 项目保持 API 根目录 `apps/api` / NestJS 构建；发布本次 API 与独立消费者，确认控制台出现 `slogan-realtime` 的消费者。平台的 `VERCEL` 标识自动提供；不要手工在常驻环境设置它。
3. 复用已批准的数据库、LiveKit 和 `REALTIME_ENABLED` 配置，检查消费者也能访问这些配置。本次不修改供应商、密钥、Google 登录或远程环境变量。
4. 验证正常 leave 与 LiveKit 故障下 leave 都返回业务成功；停止所有客户端和请求后，仍有消费者执行及 PostgreSQL 命令从 PENDING 到 COMPLETED 的记录。再验证重投递、消费者重启、provider 恢复及旧身份不能重入。
5. API 合同就绪后发布 admin/mobile Pages 和 Android 包。旧在线 API 没有新增消息/等级字段时，不把新版 APK 的网络失败认定为新功能验收通过。

## 回滚

保留新增字段和消息表；旧单级请求兼容。房主接任选择属于客户端兼容性变化，不能把旧 APK 与新行为组合称为已验收。停止新前端入口后可以回滚前端版本，但不要回退 LEFT、ENDING、ENDED 或删除未处理命令。先排空命令或确认另一个消费者已接管，再移除队列函数/触发配置。回滚消费者时保留主题和数据库，以恢复扫描重建任务。

## 已有证据和发布门槛

本地 `vercel build` 成功产出公开 `index.func` 与独立 `api/realtime.func`，后者具有 `queue/v2beta` / `slogan-realtime` 触发配置。托管 runner 与 queue adapter 的测试覆盖响应外处理、失败重投递、扫描重建、延迟及播种去重；PostgreSQL 集成覆盖 provider 故障和恢复。四个迁移已于 2026-10-07 成功应用到已确认的 Neon main / neondb，共 25 个完成迁移、0 个失败；现有 5 个用户和 4 个房间保留，等级字段及消息外键已核对。见 [迁移证据](../acceptance/simplify-room-and-mobile-experience/production-migrations.json)。云端队列实际触发仍待发布后验证，因此 OpenSpec 5.3 保持未完成。

依据：[Vercel Queues](https://vercel.com/docs/queues)、[SDK](https://vercel.com/docs/queues/sdk)。这些文档证明平台能力，不能证明本项目已经上线运行。

2026-10-08 实际生产检查发现清理命令六分钟仍未执行。请求内播种补丁与日志安全分类已有本地测试；云端触发未通过前，5.3 不勾选，具体错误仍需对照线上日志。
