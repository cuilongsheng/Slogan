## 1. 接入边界、兼容性与隐私基础

- [x] 1.1 固定本 change 的应用/服务入口、构建路径、启用目标和与活跃 operations/realtime change 的代码依赖，交付入口与证据矩阵；验证明确区分工作区、已发布 SHA、默认关闭能力与原 change 未完成的外部验收，且未改动其他 change 的完成状态。
- [x] 1.2 在隔离 transport 下验证候选 Sentry SDK/插件与 Node 24/NestJS 12 ESM、Vite 8、Expo 57/RN 0.86 的实际产物兼容性并锁定版本；交付兼容记录与可重复构建检查，验证 HTTP、独立 Vercel 消费者、Android 原生缓存清理钩子均有可行接入路径，tracing 关闭且未降级 ioredis/Prisma/业务框架。
- [x] 1.3 增加分环境/服务的监控开关、release/build、DSN、传输限时/速率和服务端心跳配置校验；用配置测试验证开发/测试默认关闭、关闭时无需上传凭证、显式启用缺失/非法配置安全失败且错误不回显配置值。
- [x] 1.4 实现按事件来源区分的固定错误分类、白名单净化与有界技术上下文；用嵌套 cause、URL、breadcrumb、SQL、私有内容 canary 和后台路径测试验证归一化出站事件无敏感值，受保护后台事件无 stack，不可净化事件安全丢弃而不写原值日志。

## 2. API、队列与 worker 错误边界

- [x] 2.1 在 API、独立消费者和实际启用 worker 入口接入早期初始化与有限发送/退出排空，归属于 observability 基础设施；用 bootstrap/入口 smoke 验证 ESM 加载顺序、service/release 标签、并发请求上下文隔离，以及超时不覆盖原业务结果。
- [x] 2.2 将选择性捕获接入现有 ApiExceptionFilter 和已吞异常的 provider/worker 边界，限制每次操作重复捕获；用 API/filter 测试验证预期 4xx 不上报、归一化 provider/DB 故障会上报、后台错误无 stack、既有响应 code/status/details 不漂移。
- [x] 2.3 限制请求标识格式与长度并在两端 transport 使用响应中的合法技术标识；用 HTTP/客户端测试验证合法值可关联 Pino 与故障事件，非法或敏感输入替换为生成值，跨并发请求和刷新重试不串上下文。
- [x] 2.4 新增最小 live/ready 合同和限时核心依赖探测，并重新生成唯一 OpenAPI 与 api-client；用 HTTP/contract 测试验证 200/503、no-store、池获取/查询超时受限、匿名响应无内部字段、后台详细 health 仍受 RBAC 保护。
- [x] 2.5 为 realtime 消费者和恢复扫描接入任务错误及独立完成心跳；用托管队列/runner 测试验证业务失败仍重投递、业务成功不因上报失败重投递、只在实际扫描与续接完成后发心跳，重复消息不改变既有幂等/成员资格语义。

## 3. 客户端与语音观测

- [x] 3.1 接入 Admin 的初始化、React 错误捕获和 API transport 诊断；用组件/浏览器验证非预期异常可捕获、预期拒绝不报警、监控关闭或断网时路由/认证/既有 fallback 行为不变，产品中没有新增测试按钮或反馈 UI。
- [ ] 3.2 接入 Mobile 原生/Web 的平台初始化和 Expo Router 包装，配置 native 缓存前/发送前清理；用 Web 与 Android release 的受控 canary 验证 JS/原生事件、重启补报与缓存均不含敏感值，关闭 Replay、不可控 dump 和任意附件。
- [x] 3.3 在现有 voice-room mediaCore 与平台 adapter 中记录有界连接阶段、耗时及归一化失败；用 media/session 测试验证 connect/reconnect/track failure 有技术上下文，主动离房/移除/正常结束不误报，订阅清理完整且不外传 token、participant identity 或 data message。
- [x] 3.4 在 Mobile API transport 接入最终故障和合法 requestId，处理取消、离线、重试与登出上下文清理；用客户端/session 测试验证无原始请求/响应内容、请求重试不产生重复异常，账号切换不遗留上下文。

## 4. 独立监控调度与持久告警

- [x] 4.1 新增 ObservabilityMonitorState 模型及 additive migration，保存固定 monitorKey 的完成窗口、连续失败和租约/generation；在空 PostgreSQL 与现有 operations/room/command fixture 上验证迁移、唯一窗口和旧数据/API 兼容，交付保留新表的回滚说明。
- [x] 4.2 将依赖失败阈值与恢复判断改为跨执行的持久状态，并提供只读积压/超期探测公开入口；用 PostgreSQL 集成测试验证重启后第三次失败仍达到阈值、重复/并发窗口不多计、旧租约不能覆盖新结果、成功关闭旧 occurrence，provider 401/403/unknown 不误标业务就绪。
- [x] 4.3 拆出独立监控单次扫描与 outbox dispatch 启用条件，协调 legacy operations runner 的扫描 owner；用治理/监控开关组合测试验证监控开启且治理关闭时可探测/投递，但绝不调用 retention、政策调度、清理或新增治理写权限。
- [x] 4.4 增加 Vercel 独立 observability topic/私有消费者与常驻环境独立 monitor worker，复用单次扫描和持久租约；用调度测试与本地 Vercel 构建验证一次只启用一个 owner、无需用户请求续接、重复回调不生成无限扫描链、功能关闭停止续接。
- [x] 4.5 增加受控幂等 seed/reseed 命令、扫描续接状态和独立完成 heartbeat；用故障窗口测试验证发布成功但记录失败、消息重投递、进程退出、链停止/恢复均可收敛，heartbeat 不在扫描未完成时发送，秘密 URL/token 不写日志或客户端。
- [x] 4.6 为选定外部通知协议适配最小 sink，复用现有投递 lease/fencing、重试与恢复通知；用 sink/outbox 测试验证超时、拒绝、重复领取和重启恢复不丢持久投递，通知只有允许的固定技术字段且不递归告警。

## 5. 定位产物与发布构建

- [x] 5.1 在 Admin/Mobile Web 的实际 Pages 构建路径生成、匹配、上传并删除 source maps；用构建产物检查和受控上传测试验证 release/debug ID 正确、所有公开 map 与源码档案排除、上传凭证未进入 bundle、worker 或构建日志。
- [x] 5.2 为 Nest dist、Vercel 独立函数与 Android release 配置匹配的 maps/原生符号上传，明确不同编译器与 build 的定位清单；用产物 smoke 验证每个目标的文件与版本匹配，不将本地 dist 或 Expo export 当作其他目标的发布符号。
- [x] 5.3 增加启用监控的 release 上传失败门禁、私有构建凭证注入和逐服务关闭路径；用构建/配置检查验证缺少上传配置时拒绝受监控发布、监控关闭的本地构建仍可执行，客户端关闭需要重建且不能靠服务端开关控制旧安装包。

## 6. 本地集成证据与运行手册

- [x] 6.1 补充 Pages proxy 健康路径无缓存与 HTML fallback 拒绝验证；用既有 Pages 浏览器/workerd smoke 验证两个站点分别透传 ready 的状态/内容、保持认证 cookie/代理 allowlist 边界。
- [x] 6.2 编写观测 runbook、配置模板和受控故障 harness，列出错误分类、扫描周期/宽限、费用上限、外部接收人配置、seed/reseed、sink 降级与逐入口关闭/回滚；验证 harness 只在隔离验收入口运行，公开产品无 throw endpoint/测试按钮，示例不含真实 secret 或私人内容。
- [x] 6.3 完成一次最终 affected-scope 验证：format、依赖边界、lint/typecheck、API unit/integration/HTTP 与监控 runtime、Admin/Mobile 相关 tests/build、Pages browser/workerd、Vercel 产物与 OpenAPI drift、git diff check、OpenSpec strict validation；记录实际命令、版本、通过/失败及既有或环境阻塞，不把没有执行的 native/cloud 项计为 PASS。

## 7. 授权目标环境与真实验收

- [ ] 7.1 在远程配置/资源操作前确认目标环境、账号/项目、数据区域/保留、访问人员、预算、通知接收人和私有凭证来源，完成启用记录；验证目标与实际部署 SHA/消费者列表对应，未取得远程操作授权或所需输入时仅记录 BLOCKED，不购买服务或修改远端。
- [ ] 7.2 在授权隔离目标部署 additive 迁移、健康接口、独立消费者及外部探活/心跳，按顺序启用并播种；验证 API 与两个 Pages 同源 ready 可探测、私有消费者不公开、检查周期与宽限符合实际计划、自动治理仍为原设置。
- [ ] 7.3 使用实际 Admin/Mobile Web 与 API/消费者发布产物触发无内容故障，验证 Sentry 展示匹配版本的源码位置、预期错误过滤和接收人真实通知；保存去敏事件链接/截图和发布标识，验证公开 source maps 不可下载。
- [ ] 7.4 在 Android 真机 release 验证 JS/结构化原生崩溃及重启补报、离线缓存 canary、真实断网/重连/主动离房；记录设备、build、原生符号与观测结果，验证不以 Expo Go、debug 包、模拟器或 Web fixture 替代真机验收，iOS 若实际启用则完成同等证据。
- [ ] 7.5 在停止所有用户请求后验证独立扫描与 realtime recovery 持续运行，并受控停止扫描/制造积压/恢复 sink；验证外部通知真实送达、达到阈值的故障去重与恢复、完成 heartbeat 不伪报、受控 reseed 成功，且上报超时/额度拒绝不改变语音、已提交离房或业务队列重试。
- [ ] 7.6 执行逐服务关闭和独立监控调度回滚 smoke，交付 `docs/acceptance/add-production-observability.md` 与对应目标环境发布记录；验证关闭配置构建停止新增外传、原 realtime/incident/outbox 与业务事实保留，清楚区分本地/浏览器/设备/外部证据，未验证项保持未完成且不替其他 change 宣称验收。

## 8. 用户批准的采样追踪续作

- [x] 8.1 实现平台无关的 span/trace header 白名单与采样校验，覆盖两代 SDK 的出站结构，禁止 URL、query、SQL、身份与内容泄露。
- [x] 8.2 Admin / Mobile 原生 / Mobile Web 用 OpenAPI 模板生成手动 HTTP span，仅向配置 API origin /v1 传播技术 trace header；验证跨源/重定向隔离、错误/取消和重试结果不变。
- [x] 8.3 语音连接与重连的成功/失败阶段、本地连接质量变更形成有界 span，验证正常退出不报警、旧监听不写新会话、成功样本可聚合且不采集内容。
- [x] 8.4 补齐真实 Vercel 构建产物上传流程与 frame/debug ID 一致性，验证缺配置/失败拒绝发布、凭据不回显，保留直接 NestFactory 入口与唯一 filter。
- [x] 8.5 为用户选定的 Sentry 邮件通知准备并验证现有账号配置，提供上传 token 配置页面；按用户后续单独授权创建 org:ci token 并保存到仓库外 600 权限文件，设备缺失时精确记录待验收项，不升级付费计划。
- [x] 8.6 运行本轮 affected-scope 检查，记录代码、浏览器配置、云端与设备证据的边界；仅提交监控相关改动，不包含并行 UI/房间功能。
