## 1. 数据模型与迁移

- [x] 1.1 为 Room 增加默认关闭且创建后不可变的 sensitiveSpeechDetectionEnabled 字段，并通过含历史房间数据的 migration 测试验证旧行均为 false
- [x] 1.2 为 ROOM_SAFETY_DETECTION 同意目的、风险类别、严重度、投递状态、降级组件和事件状态增加 Prisma 枚举，并通过 Prisma validate/generate 验证 schema 可生成
- [x] 1.3 增加 RoomSpeechRiskEvent、RoomSpeechAlertDelivery 和 SafetyCapabilityIncident 模型及必要唯一约束、外键和 keyset 索引，并通过空库迁移与结构集成测试验证
- [x] 1.4 增加风险、提醒和降级事实的保留/清理仓库操作，验证清理测试只删除超过政策期限的数据且不触碰案件与审计事实
- [x] 1.5 编写迁移回滚说明和保留新增兼容列/表的应急步骤，验证文档包含停止 worker、释放流和禁止紧急删除证据的顺序

## 2. 房间合同与能力开关

- [x] 2.1 扩展即时房间和预约房间创建 DTO、领域实体与仓库映射，验证未提交开关时创建结果为 false、明确启用时持久化 true
- [x] 2.2 在即时列表、详情、分享解析、预约详情和 presenter 中返回敏感语音识别状态，验证关闭与启用房间的 API 响应
- [x] 2.3 增加允许创建启用房间的服务端能力开关和聚合 readiness 门禁，验证关闭或依赖不健康时拒绝 true、仍允许 false
- [x] 2.4 阻止任何更新路径在创建后修改该开关，验证直接 DTO 请求和仓库并发更新都不能改变持久值
- [x] 2.5 重新生成 openapi/openapi.yaml，验证房间请求默认兼容、响应必填字段和预约/即时合同与代码一致

## 3. 目的级同意与加入收敛

- [x] 3.1 将同意仓库和状态查询改为按 purpose 与 noticeVersion 隔离，验证 AI_EXPRESSION_AUDIO 与 ROOM_SAFETY_DETECTION 互不授权
- [x] 3.2 增加房间安全同意接受/撤回 API、UUID 幂等和稳定错误语义，验证相同重试返回原结果、变更载荷冲突
- [x] 3.3 在启用房间的加入和 realtime token 续期前校验当前同意，验证缺少、过期或撤回时不创建新 membership/issuance
- [x] 3.4 实现撤回事务内的 issuance 失效和 realtime command/outbox，验证活跃成员以 CONSENT_WITHDRAWN 断开且不产生举报、案件或限制
- [x] 3.5 为撤回与正在发送的音频窗口增加 consent generation 校验，验证 generation 改变后丢弃内存窗口并停止 provider stream
- [x] 3.6 更新同意与加入 OpenAPI，验证状态集合包含两个目的、房间安全命令路径及 ROOM_SPEECH_CONSENT_REQUIRED

## 4. 独立媒体 worker 与租约

- [x] 4.1 在 apps/api 增加独立 room-speech worker bootstrap、配置和启动脚本，验证 API 与 worker 可以分别启动且 API readiness 不依赖 worker
- [x] 4.2 定义房间媒体源、流式 STT session、风险规则、租约和提醒发布端口，验证依赖规则禁止领域层导入 LiveKit/provider 实现
- [x] 4.3 实现开放启用房间扫描和 Redis fencing 租约，验证并发 worker 只有一个有效持有者、旧 token 不能提交事件
- [x] 4.4 实现 LiveKit 服务参与者的加入、音轨订阅、离开和最小权限，验证其不创建 membership、不计容量且不能发布麦克风或执行房主管理
- [x] 4.5 实现房间结束、成员离开、撤回、租约失效和 shutdown 的取消/清理顺序，验证 provider stream、缓冲与媒体连接均释放
- [x] 4.6 增加 worker live/ready 健康检查和无依赖时 fail-closed 行为，验证 Redis、PostgreSQL、LiveKit 或 provider 不健康时不获取新租约

## 5. 流式 STT 与内存数据边界

- [x] 5.1 扩展 STT provider 政策配置以声明流式能力、区域、用途、删除/不留存和最长七天保留，验证缺项或超限时 worker 拒绝 ready 且不暴露密钥
- [x] 5.2 实现可替换的流式 STT adapter 与短期匿名关联标识，验证 provider 请求不包含姓名、联系方式、房间密码、其他成员资料或 LiveKit 凭证
- [x] 5.3 实现每房间/成员/session 的窗口、缓冲、并发和静音上限，验证超限只丢弃待处理窗口并产生聚合降级，不反压真人语音
- [x] 5.4 审计所有音频/转写数据路径和类型，验证 PostgreSQL、Redis、BullMQ、对象存储、日志、span、异常和 fixture 输出均不能恢复内容
- [x] 5.5 为成功、失败、超时、取消和进程 shutdown 编写临时内容清理测试，验证每条路径结束后没有可读取或恢复的音频/完整转写

## 6. 风险规则、去重与最小事实

- [x] 6.1 实现不可变版本标识的风险规则集、受控类别和 LOW/MEDIUM/HIGH 严重度映射，验证固定 fixture 的分类与版本结果稳定
- [x] 6.2 实现规范化、不可逆摘要和不含文本的风险事件创建，验证数据库记录仅含房间、主体、类别、档位、规则版本、时间和聚合计数
- [x] 6.3 实现 Redis 去重窗口和令牌桶限频，验证同一房间/成员/类别的重复命中被聚合、不同主体或类别互不污染
- [x] 6.4 在 Redis 去重不可用时停止新风险判断并创建合并降级，验证不会绕过限频或自动触发处置
- [x] 6.5 增加禁止风险事件调用 host control、案件结论、restriction 或账号状态修改的单元与集成测试，验证 HIGH 信号也只产生最小事实和提醒

## 7. 当前房主提醒与接任隔离

- [x] 7.1 在风险事件事务中写入最小提醒 outbox，验证重试不重复风险事件且 delivery 不复制语音或转写内容
- [x] 7.2 实现每次发送前解析当前房主与 realtime identity 的 LiveKit 定向 data packet adapter，验证普通成员和前任房主不能收到提醒
- [x] 7.3 实现十分钟且不超过房间结束时间的有界退避、租约和过期收敛，验证离线重试、重复 runner 和永久失败的稳定结果
- [x] 7.4 增加当前房主 safety-alerts keyset 查询 API，验证接任后只有新房主可读取仍在保留期的最小提醒
- [x] 7.5 编写房主接任与提醒并发测试，验证旧目标投递失效、最新房主收到至多一次可识别提醒且没有广播

## 8. 降级、后台查询与案件证据

- [x] 8.1 实现按房间、组件和错误类别合并的 SafetyCapabilityIncident 打开/更新/恢复状态机，验证连续故障不洪泛、恢复时间可查询
- [x] 8.2 接入媒体订阅、流式 STT、规则、协调和提醒投递的归一化降级上报，验证事件不含异常原文、provider 响应或语音内容
- [x] 8.3 增加后台降级事件过滤和 keyset 查询 API，验证 SAFETY_OFFICER、PLATFORM_ADMIN、AUDITOR 可读，普通用户和单独 OPERATIONS_ANALYST 被拒绝
- [x] 8.4 扩展案件证据包组合相关时间窗口的风险与降级事实，验证区分无命中、能力降级和未启用，且不返回命中原文
- [x] 8.5 更新 OpenAPI 的房主提醒与后台降级合同，验证角色说明、过滤条件、游标、枚举和最小响应字段准确

## 9. 测试、运行证据与验收

- [x] 9.1 完成房间开关、同意门禁、撤回、租约、流式清理、规则、提醒、接任、降级和证据的 unit/integration/e2e 测试，并验证所有目标测试通过
- [x] 9.2 在真实 PostgreSQL 与 Redis 上运行 API 和独立 worker runtime 测试，验证 fencing、重启恢复、shutdown、清理及数据库/日志无内容
- [x] 9.3 运行 format、Prisma validate/generate、OpenAPI 生成 diff、依赖边界、完整 unit/integration/e2e/runtime 和 openspec validate --strict，并记录命令、数量与结果
- [x] 9.4 编写 docs/acceptance/implement-room-sensitive-speech-detection-backend.md，验证其中分别记录本地实现、真实环境证明、隐私检查、迁移/回滚和所有 BLOCKED 项
- [ ] 9.5 使用真实 LiveKit Cloud 与合格流式 STT provider 执行双人 smoke，验证隐藏 worker、真人语音不中断、只提醒当前房主、接任隔离、撤回停止和 provider 失败降级；缺少凭据时记录 BLOCKED 并保持本任务未完成
- [ ] 9.6 在受支持真机完成加入前同意、房主提醒、重连和接任验收，验证与 OpenAPI/内部 envelope 一致；客户端尚未接入时记录 BLOCKED 并保持本任务未完成
