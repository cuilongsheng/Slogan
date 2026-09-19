## Why

现有后端已经具备房间、预约、AI/STT、安全案件和后台角色能力，但缺少统一的运营指标、异常告警和可证明的数据清理边界，无法支持运营分析员履职，也无法在公开测试前证明数据最小化、故障发现与恢复能力。V1 后端需要把这些跨域事实收敛为最小权限、可审计且可恢复的运维闭环。

## What Changes

- 增加平台汇总与趋势指标，包括资料完成、首次进入、房间与有效交流、预约履约、分享转化、AI/关键词使用、留存及安全处理；指标使用服务端事实和明确口径、时区与新鲜度，不从日志或客户端声明反推。
- 增加平台管理员的受限运营明细与内部活跃用户排序；运营分析员只能读取达到最小分组阈值的匿名聚合，不得读取用户、房间成员、举报正文、案件证据或私人内容。
- 增加持久异常事件、去重、状态转换和查询能力，覆盖 provider/Redis/PostgreSQL readiness、durable command 或 job 堆积、处理延迟、清理失败和指标过期；告警失败不阻塞语音房或业务事务。
- 增加数据分类、保留策略快照、清理运行、dry-run、批量上限、租约/fencing、失败恢复和删除计数证明；临时内容按既有最长七天边界清理，尚未批准期限的举报、处罚、申诉、审计和账号身份事实默认禁止自动物理删除。
- 增加数据库备份、隔离恢复、完整性检查和恢复演练的运维合同与验收记录；生产凭据、真实部署和公开用户测试仍由目标环境执行，不以本地 fixture 代替。
- 扩展后台权限和审计：平台管理员可读取全部运营视图与治理运行，运营分析员只读匿名指标，审计员只读告警/治理审计结果；所有敏感查看、策略启用、清理和告警状态操作均留下最小审计。
- 扩展 OpenAPI、配置、迁移、维护 runner、观测脱敏及本地/真实环境验收文档。

## Capabilities

### New Capabilities

- `operations-metrics`: 定义 V1 指标口径、匿名聚合、趋势查询、新鲜度、内部明细和最小权限边界。
- `operational-alerting`: 定义跨 provider、存储、队列、清理和指标流水线的异常事实、去重、恢复与受限查询。
- `data-retention-governance`: 定义数据分类、策略快照、安全清理、dry-run、恢复、保留证明和禁止删除边界。
- `backup-recovery-readiness`: 定义 PostgreSQL/必要配置的备份、隔离恢复、完整性验证和目标环境演练证据。

### Modified Capabilities

- `backoffice-access-control`: 为平台管理员、运营分析员和审计员增加相互隔离的指标、运营明细、告警与治理权限。
- `backoffice-audit`: 将运营敏感读取、告警处理、保留策略启用、清理运行和恢复演练纳入最小追加审计。
- `temporary-speech-processing`: 将临时语音处理的最长保留和删除结果接入统一治理证明，并在删除证明失败时产生降级事实。

## Impact

- `apps/api/prisma/`：新增指标快照、异常事件、保留策略/运行/分片和恢复演练事实及相应索引；只使用向前兼容迁移。
- `apps/api/src/modules/`：新增 operations/governance application 与 infrastructure 边界，并扩展 backoffice、audit、assistance、room-speech-processing、speech-safety、post-room-learning 和 account-lifecycle 的最小公开端口。
- `apps/api/src/workers/`：增加可独立运行、带租约与 fencing 的指标、告警和清理 runner；复用 PostgreSQL 持久事实与 Redis 协调，不把 Redis 当作审计真相。
- `openapi/openapi.yaml`：增加后台指标、受限明细、异常和治理查询/命令 API；所有分页、时间范围、聚合阈值与错误保持稳定合同。
- `apps/api/src/config/` 与部署资料：增加 feature flag、周期、阈值、批量、保留和告警 sink 配置；真实备份恢复与外部告警投递需要目标环境凭据和运行证明。
- 不包含 PC 管理后台 UI、移动端埋点 SDK、任意原始音频/完整转写采集、数据仓库/BI 产品、审计导出、个人数据下载、未批准的安全证据物理删除或生产环境自动部署。
