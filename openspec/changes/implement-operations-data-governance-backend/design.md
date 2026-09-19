## Context

参见 `proposal.md` 的动机。当前 PostgreSQL 已保存账号、房间、成员、预约、分享、安全案件、后台审计、AI/STT 用量、关键词和持久命令事实；Redis 只适合 presence、限流、租约和临时候选。各模块已有零散 purge/readiness 方法，但没有统一策略、运行证明、指标快照或跨域异常生命周期。后台已经按请求读取 PostgreSQL 当前角色，OpenAPI 由 NestJS decorators 单向生成。

## Goals / Non-Goals

**Goals:**

- 在不采集新语音内容或自由文本的前提下，从现有持久事实生成可重放 V1 指标。
- 把指标、异常、策略、清理运行和恢复演练建立为 PostgreSQL 持久真相，并让 Redis 只承担可丢失协调。
- 保持运营分析员、平台管理员和审计员的权限隔离，所有敏感控制面行为先审计后返回。
- 为自动清理提供版本、dry-run、租约、fencing、批次、恢复和 preservation hold 边界。
- 用同一治理证据覆盖本地临时内容清理和 provider 删除声明，同时诚实保留外部证明缺口。

**Non-Goals:**

- 不引入数据仓库、BI SaaS、移动端通用埋点、第三方用户画像或跨站追踪。
- 不构建 PC 管理后台 UI、审计导出、个人数据下载或生产部署流水线。
- 不在本 change 决定安全证据、处罚、申诉、审计、身份和用户私有内容的物理删除期限。
- 不备份 Redis 临时状态，不在恢复演练中调用真实 provider，不把本地恢复测试表述为生产证明。

## Decisions

### 1. PostgreSQL 事件事实加窗口快照，而不是查询时扫描或复制全量事件仓库

指标 runner 以 UTC 日/周窗口读取现有规范化表，写入带 `metricKey`、维度白名单、口径版本、窗口和分子/分母的快照。关闭窗口可重放并由唯一键覆盖同版本结果；实时在线人数单独标记采样时间，不伪装为历史事实。这样避免每次后台请求跨大表聚合，也不新建包含更多个人轨迹的数据仓库。

备选是实时 SQL 或将所有业务动作复制到 analytics event 表。实时 SQL 难以稳定控制负载和口径；通用事件表会扩大数据副本与隐私面，因此拒绝。

### 2. 分组维度使用类型化白名单和 k>=10 抑制

指标键和值使用受控 schema，不接受任意列名或自由标签。运营分析员查询强制最小样本十，并对组合维度再次计算阈值，不能通过多个查询差分还原小组；管理员明细走独立权限、DTO、repository 和审计路径。缓存键只包含规范化过滤摘要，不包含用户或房间资料。

备选是依赖前端隐藏敏感列或只对最终结果四舍五入，两者都无法阻止直接 API 请求和差分攻击。

### 3. 跨域治理通过窄端口协调，不让 operations 模块直接导入其他模块 repository

每个领域公开只读统计投影和受控 purge adapter，例如计数窗口、候选扫描、批次删除与依赖检查；operations/governance application 只依赖这些端口。统一 runner 负责编排，不读取内部 Prisma repository，也不让领域 service 反向依赖治理模块。dependency-cruiser 固化该方向。

备选是一个拥有全部 Prisma model 的超级 repository，虽然开发快，但会绕过领域删除不变量并形成循环依赖。

### 4. 策略快照与执行运行分离，默认拒绝不可逆删除

`RetentionPolicyVersion` 保存不可变分类、范围、期限、依据和自动运行标记；`RetentionDryRun` 保存候选边界与短期有效期；`RetentionRun`/batch 保存 generation、游标和计数。扫描使用稳定 `(eligibleAt,id)` 游标，执行前重新检查 policy、hold 和引用；每批在数据库事务内删除并更新计数。安全证据、审计、身份和用户内容分类在代码 policy 中固定为 `RETAIN`，配置无法绕开，未来只能通过独立 OpenSpec 和迁移放开。

Redis/BullMQ 可以触发运行，但 PostgreSQL 行租约与 fencing generation 决定写入资格。这样 Redis 丢失、重复 job 或旧进程晚到都不会重复或越界删除。

### 5. 异常使用指纹 occurrence 和持久投递 outbox

`OperationalIncident` 以组件、类别、范围摘要和规则版本形成指纹，同一开放 occurrence 原子累加；恢复关闭当前 occurrence，再次失败建立新 occurrence。外部 sink 只接收白名单摘要，并由独立 `OperationalAlertDelivery` 重试。业务事务只写本领域状态；探测或 outbox 之后发现异常，告警 sink 失败不回滚业务。

备选是只写日志或在业务请求内同步调用 Slack/邮件。日志无法提供状态闭环，同步通知会扩大延迟和故障耦合，因此拒绝。

### 6. 清理证明记录结果和策略，不保存被删内容

治理事实只保留类别、范围摘要、策略版本、计数、时间和稳定错误。临时语音的本地清理由现有处理边界上报；provider 删除/不留存使用配置声明及可用确认接口，结果不确定时建立 incident。证明中不保存音频、转写、AI 文本或 provider 原始响应，避免“为证明删除而再复制内容”。

### 7. 备份恢复由受控脚本执行，应用只保存最小演练事实

备份/恢复脚本复用部署环境的 PostgreSQL 工具，在启动前检查环境标识、目标隔离、外部 provider 全部 disabled/fake 和 schema 兼容。恢复后运行只读不变量检查器；应用数据库仅记录备份摘要、版本、观察 RPO/RTO 和检查结果。备份位置、连接串和加密密钥留在部署 secret 管理，不写业务库或审计。

本地 Docker 恢复用于验证脚本和不变量；目标环境演练必须单独记录版本、时间和观察值。没有目标环境凭据时对应验收任务保持 BLOCKED。

### 8. API 继续采用 NestJS code-first 单向生成 OpenAPI

后台 API 按 `/v1/backoffice/operations/*`、`/v1/backoffice/incidents/*` 和 `/v1/backoffice/governance/*` 分组，使用稳定 cursor、ISO 时间、枚举和显式范围 DTO。Swagger decorators 是唯一生成源，更新后确定性生成 `openapi/openapi.yaml` 并运行 drift 检查，不维护第二份手写协议。

## Risks / Trade-offs

- [直接聚合可能增加 PostgreSQL 负载] → 只处理闭合窗口、使用水位和索引、限制重算范围，并在真实规模 fixture 上记录执行计划和延迟。
- [小样本可被多个维度差分推断] → 固定白名单、组合后重新应用阈值、限制窗口/维度数量并审计查询范围。
- [统一清理 runner 权限过大] → 领域窄端口、代码级禁止删除类别、dry-run、短租约、fencing、批次事务和 preservation hold 多层约束。
- [告警风暴] → 指纹去重、连续失败阈值、冷却和恢复 occurrence，投递队列设置上限并对自身降级只产生单一聚合事件。
- [指标口径后续调整] → 版本化口径并保留旧快照；新版本不静默改写历史展示，重算范围需显式标记。
- [备份存在但不可恢复] → 只有隔离恢复和不变量检查通过才标记 verified；本地、预发和生产证据明确区分。
- [真实 provider 或部署环境缺失] → 本地实现和测试可以完成，但外部告警、provider 删除和目标环境恢复任务保持未完成且 change 不归档。

## Migration Plan

1. 以 feature flags 关闭状态部署 additive migration、权限枚举兼容映射和新 runner binary；旧 API 不读取新表。
2. 运行历史 fixture migration，建立指标/治理索引并验证现有房间、安全、审计和用户内容未改变。
3. 先启用只读指标 backfill，在管理员环境校验口径、抑制和查询计划；之后向运营分析员开放匿名查询。
4. 启用 incident 探测和内部查询，再配置外部 sink 并验证 outbox 重试；sink 未就绪不影响业务 readiness。
5. 只为临时内容和已批准技术记录启用 retention policy，先 dry-run 对账，再以小批量开启自动运行；安全/审计/身份/用户内容保持 `RETAIN`。
6. 在本地与预发执行隔离恢复，最后在目标环境按批准窗口执行真实演练并记录实际 RPO/RTO。
7. 回滚时先关闭 runner 和写 API，再回退应用；保留新表、快照、异常、策略、运行和演练事实，不执行破坏性 down migration。已提交删除不可恢复，因此回滚不能依赖重新创建被清理内容。
