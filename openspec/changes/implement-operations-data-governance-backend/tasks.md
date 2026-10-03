## 1. Schema、配置与模块边界

- [x] 1.1 增加 MetricSnapshot、OperationalIncident/Observation/AlertDelivery、RetentionPolicyVersion/DryRun/Run/Batch/Hold、DeletionEvidence 和 RecoveryDrill 等枚举与模型，建立窗口版本、开放异常指纹、幂等命令和 fencing 所需唯一约束，并通过 Prisma validate/generate 与 schema 测试验证
- [x] 1.2 编写 additive migration，并在空数据库及包含账号、房间、预约、AI/STT、安全案件、限制/申诉、审计和持久命令的历史 fixture 上执行，使用真实 PostgreSQL 验证旧数据、引用和现有 API 保持兼容
- [x] 1.3 增加 OPERATIONS_GOVERNANCE_ENABLED、指标口径/周期/新鲜度、最小样本、异常阈值/冷却、runner 租约、清理批量/dry-run TTL、告警 sink 及备份目标配置，验证默认关闭、非法上限或缺少安全配置时启动/readiness 安全失败且不回显配置值
- [x] 1.4 建立指标事实读取、incident repository/sink、领域 retention adapter、治理事务和恢复证据的 domain/application ports，运行 dependency-cruiser 验证 domain 不导入 NestJS、Prisma、Redis、HTTP DTO 或其他模块内部实现
- [x] 1.5 为 operations/governance 模块建立公开入口、worker 入口和 feature flag 装配，验证关闭时不启动 runner、不暴露写操作且既有 API/worker 回归不变
- [x] 1.6 编写迁移、分阶段启用和回滚文档，验证明确先迁移后只读指标、再告警、最后 dry-run/小批量清理，并要求回滚保留治理事实且不尝试恢复已删除内容

## 2. 指标事实、口径与快照

- [x] 2.1 实现 UTC 日/周窗口、口径版本、维度白名单和规范化 snapshot key policy，验证边界时刻、夏令时输入、重复维度、非法组合和同窗口幂等键的 unit tests
- [x] 2.2 在账号/资料、房间/成员连接、预约/分享、AI/关键词和安全领域增加窄的只读统计投影，验证投影只返回计数/时长/类别且不包含自由文本、私人内容、认证身份或 provider 数据
- [x] 2.3 实现资料完成、首次创建/加入、首次语音连接、五分钟有效交流和平均有效房间时长口径，使用重连、重叠连接、取消和未开始房间 fixture 验证不重复累计
- [x] 2.4 实现 AI 后继续交流、会后保存表达、七日再参与、分享打开到加入和预约实际进入口径，验证匿名归因、重复打开、跨链接、取消预约和失败请求不会污染分子/分母
- [x] 2.5 实现举报处理时长、重复被移除/举报用户、房主处理完成率和误判/滥用结果口径，验证未结案件、重复举报和缺失终态返回 PARTIAL/UNAVAILABLE 而非错误零值
- [x] 2.6 实现带 PostgreSQL 租约、水位、fencing 和唯一窗口版本的指标 runner，验证并发领取、重复执行、进程重启、旧 generation 晚到提交和显式重算均保持一个生效快照
- [x] 2.7 实现实时在线人数的独立采样路径和指标新鲜度判断，验证 Redis/presence 不可用时只标记实时值不可用，历史快照仍可读且过期窗口产生去重异常

## 3. 指标隐私、后台查询与运营明细

- [x] 3.1 实现不低于十的最小样本抑制、组合维度再判断和稳定 suppressed 响应，验证小样本、空分组及多次差分查询不返回可反推用户/房间的数值
- [x] 3.2 扩展 backoffice permission map，为 OPERATIONS_ANALYST、PLATFORM_ADMIN 和 AUDITOR 配置互不隐含的指标、明细、incident 与治理权限，并用 policy tests 验证所有单角色及角色撤销后的边界
- [x] 3.3 实现匿名指标 summary/trends 查询，支持受控时间范围、grain、metric 和维度过滤，验证稳定排序/分页、新鲜度、分子分母、PARTIAL/UNAVAILABLE 与非法过滤合同
- [x] 3.4 实现仅 PLATFORM_ADMIN 可用的房间运营明细和内部活跃用户排序，验证只返回最小非内容投影、稳定游标，不公开到普通 API 且不被处罚或推荐服务读取
- [x] 3.5 为指标聚合读取和管理员明细读取写最小审计，验证敏感读取在审计失败时不返回数据，审计中不包含指标明细、用户列表或任意自由文本
- [x] 3.6 使用真实 PostgreSQL 规模 fixture 验证指标查询与 runner 的索引/执行计划、窗口上限和超时边界，并记录可重复的测试规模与结果而不虚构生产容量

## 4. 异常发现、生命周期与投递

- [x] 4.1 实现 incident 指纹、严重度、连续失败阈值、冷却和 OPEN/ACKNOWLEDGED/RESOLVED 状态 policy，验证重复观察、恢复后复发、非法状态转换和原因规范化
- [x] 4.2 实现 incident repository 的并发 upsert、occurrence 历史和幂等确认/解决命令，使用真实 PostgreSQL 验证同一开放指纹唯一、计数正确和请求标识载荷冲突
- [x] 4.3 实现 PostgreSQL/Redis/LiveKit/AI/STT/SMS readiness、命令/job 堆积、案件/限制延迟、清理失败、指标过期和恢复失败 probes，验证 probe 只上报白名单范围与原因码
- [x] 4.4 实现 incident 列表/详情、聚合趋势及管理员确认/解决 API，验证管理员完整控制、审计员只读、运营分析员仅聚合、普通用户/安全员拒绝和旧 token 角色撤销即时生效
- [x] 4.5 实现可替换告警 sink、持久 delivery outbox、退避和 fencing runner，使用 fake sink 验证成功、失败、timeout、不确定和重启恢复不回滚业务或重复发送已完成投递
- [x] 4.6 扩展日志脱敏和异常 payload 白名单测试，捕获 probe、sink、查询和状态命令的成功/失败日志，验证连接串、URL query、provider body、token、密钥及内容数据均不可见

## 5. 保留策略、dry-run 与安全执行

- [x] 5.1 实现数据类别 registry 和代码级默认动作，验证临时语音上限不超过七天，安全证据、处罚/申诉、审计、身份及用户私有内容固定 RETAIN 且环境变量/API 不能绕过
- [x] 5.2 实现不可变 RetentionPolicyVersion 的创建、校验和启用事务，验证只有 PLATFORM_ADMIN 可操作、依据/范围/期限完整、并发启用串行化且成功/拒绝审计与结果一致
- [x] 5.3 实现 RetentionDryRun 的稳定候选边界、计数/时间摘要和过期规则，验证响应不含候选标识或内容、重复请求幂等且过期或策略变化后不能执行
- [x] 5.4 实现按类别/目标/时间范围的 preservation hold 创建、解除和命中判断，验证 hold 原子阻止候选、解除需独立审计且旧 runner 不能绕过最新 hold
- [x] 5.5 实现实际清理命令的确认文本、clientRequestId、payload hash 和 dry-run 绑定，验证相同命令安全重放、改变载荷冲突、未确认/无权限/未批准类别均无状态变化
- [x] 5.6 实现 RetentionRun/Batch 的 PostgreSQL 租约、generation、稳定游标、批量上限和计数提交，验证并发 runner、进程重启、旧租约晚到、单批失败回滚和最终计数与删除事实一致
- [x] 5.7 实现策略、dry-run、hold 和运行的管理员/审计员/运营聚合查询，验证字段最小化、稳定分页、成功与拒绝审计及审计失败时不返回敏感控制面数据

## 6. 领域清理适配与删除证明

- [x] 6.1 为 AI 短期输出、OTP/临时协调、speech risk 技术事实、关键词候选/job、realtime/social/safety/account 技术命令实现领域 retention adapter，验证各 adapter 只删除已批准终态技术记录并保留用户结果与恢复中命令
- [x] 6.2 为举报、案件、限制、申诉、后台审计、PhoneIdentity/OAuthIdentity、房间历史、笔记、READY 关键词汇总和单词本增加不可删除 contract tests，验证任何自动或管理员治理命令均跳过
- [x] 6.3 将本地临时音频、完整转写和短窗口释放结果接入 DeletionEvidence，验证成功、失败、timeout、取消和 shutdown 路径都只保存目的、策略、时间与结果而无内容
- [x] 6.4 扩展 STT/provider adapter 的删除或不留存声明及可选确认结果，验证失败/不确定会产生治理 incident，超过七天会使相关 readiness 不合格但不阻塞真人语音
- [x] 6.5 实现 orphan 检测、引用检查和批次事务，使用故意制造的活动引用与约束失败验证不误删、整批回滚并生成单一去重治理异常
- [x] 6.6 在真实 PostgreSQL/Redis 上运行跨领域清理 runtime，验证 dry-run 数量、实际批次、重启恢复、fencing、Redis TTL/orphan 收敛和所有 RETAIN 类别保持不变

## 7. 备份、隔离恢复与完整性检查

- [x] 7.1 编写受控 PostgreSQL backup 脚本和配置校验，验证缺少环境标识、加密/保留/RPO/RTO 声明或安全凭据边界时拒绝运行，日志和证据不包含连接串或密钥
- [x] 7.2 编写 restore 脚本的生产目标防护和外部 provider disabled/fake 门禁，验证指向活动数据库、无法证明隔离或可能发送真实通知时在写入前失败
- [x] 7.3 实现恢复后只读不变量检查器，覆盖 migration、身份占用、房间/成员、预约、安全、角色/审计、私有内容、持久命令和治理引用，并用损坏 fixture 验证每类失败可识别
- [x] 7.4 实现 RecoveryDrill 最小结果记录与管理员启动/查询、审计员只读 API，验证保存实际 RPO/RTO 观察值和检查结果，不保存备份位置、连接串或恢复数据
- [x] 7.5 在本地 Docker PostgreSQL 完成真实备份、隔离库恢复、不变量检查和销毁 smoke，记录工具/schema 版本、耗时和本地证据标签，验证不会把结果标记为生产证明

## 8. API、OpenAPI、可观测性与维护

- [x] 8.1 为指标、明细、incident、策略、dry-run、hold、运行和恢复 API 增加 DTO、稳定错误、时间/游标/枚举校验与默认上限，运行 HTTP E2E 验证直接请求无法绕过 RBAC、抑制或确认边界
- [x] 8.2 扩展 BackofficeAuditAction、target/result 白名单和审计 repository，验证新增敏感读取/命令全部可追踪且不引入 update/delete/export 审计路由
- [x] 8.3 扩展 readiness/health 输出为不含凭据的组件状态与数据政策状态，验证依赖失败、陈旧指标、删除不确定和 sink 降级的可观测语义不错误阻塞核心语音业务
- [x] 8.4 更新模块公开入口和 dependency-cruiser 规则，验证 operations/governance 只通过公开端口读取各领域且不存在跨模块 Prisma import 或循环依赖
- [x] 8.5 重新生成 `openapi/openapi.yaml` 并运行 drift 检查，验证所有后台运营/治理合同的权限说明、分页、时间、枚举、确认字段和敏感字段与 runtime 一致

## 9. 验证与验收

- [x] 9.1 完成窗口/口径、五分钟去重、七日留存、分享归因、小样本抑制、incident 指纹、policy/hold、dry-run、fencing、幂等和脱敏 unit tests，并验证目标测试全部通过
- [x] 9.2 在真实 PostgreSQL 与 Redis 上完成历史迁移、快照并发/重算、incident/outbox 恢复、清理事务/重启和本地 backup/restore integration/runtime tests，并记录数据库、Redis 和 PostgreSQL 工具版本
- [x] 9.3 完成运营分析员匿名指标、管理员明细/incident/治理、审计员只读、角色撤销、确认与审计原子性的 HTTP E2E，验证普通用户和错误角色不能通过直接 API 获取或修改数据
- [x] 9.4 运行 format、Prisma validate/generate、OpenAPI drift、依赖边界、build、完整 unit/integration/e2e/runtime、`git diff --check` 和 OpenSpec strict validation，并在一次最终 affected-scope 验证中记录命令、数量与结果
- [x] 9.5 编写 `docs/acceptance/implement-operations-data-governance-backend.md`，分别记录本地实现、指标口径/隐私、清理保护、迁移/回滚、本地恢复、外部 sink/provider/目标环境证据和所有 BLOCKED 项
- [ ] 9.6 在目标部署环境验证真实告警 sink 投递/恢复、provider 删除或不留存证明、定时指标/清理运行及加密备份到隔离恢复的实际 RPO/RTO；缺少凭据、批准窗口、隐私/保留政策或目标环境时记录 BLOCKED、保持本任务未完成且不归档 change
