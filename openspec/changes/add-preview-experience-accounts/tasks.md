## 1. 认证边界与实施前置

- [x] 1.1 完成本 Level 2 设计审核，逐条对照 active email change 的“用户名密码登录”“开关、配额与外部验收”、mobile email change 的注册/恢复要求及主规格 RBAC，记录只限预置来源/试用环境的例外和后续同步顺序；验证为审核记录明确普通注册仍需邮件验证、没有无邮件自助注册/恢复或扩权。
- [ ] 1.2 在 UI 实施前用项目 `figma-to-frontend` 技能和唯一 Desktop Bridge 核对文件及 V2 `118:2970`/`118:3001`/`118:3063`/`118:3186`，确认邮件停用状态复用原页，记录 exact frame/route/390×844 证据与允许差异；验证为可打开的目标、状态批准记录和截图，Bridge 未连接则此项 BLOCKED，不用 cloud/REST/browser 替代。

## 2. 配置与凭据来源迁移

- [x] 2.1 分离 `EMAIL_AUTH_MAIL_ENABLED`，增加默认关闭的体验能力和显式环境标识，保留旧邮件配置推导兼容并拒绝非法组合；更新无秘密配置样例，验证配置单测覆盖旧模式、全关闭、无 SMTP 的生产安全试用、邮件依赖缺失、Redis/HMAC 缺失和环境缺失。
- [x] 2.2 添加 `EmailCredential` 来源、nullable verifiedAt 和环境/五槽位初始化记录的 additive migration，保留旧邮箱身份事实；验证隔离 PostgreSQL 升级前后既有 hash/version/session/verifiedAt/审计不变、来源与唯一约束有效，且写明旧二进制不可直接回滚的兼容边界。
- [x] 2.3 更新 credential/domain/repository 与正常注册确认写入，使受控记录和环境绑定在登录、session 签发、refresh/access 验证时 fail-closed；验证针对正确/错误密码、未知用户名、pending 注册、伪造来源/缺记录、跨环境、体验关闭、退役、禁用及注销的最小单元/集成检查。
- [x] 2.4 更新登录方式来源和空验证时间投影，禁止将初始化时间或占位邮箱当作真实验证事实；验证 HTTP 响应区分真实邮箱与体验来源、不泄露地址，正常手机/Google/邮箱身份原时间保留。

## 3. 邮件关闭与最小能力合同

- [x] 3.1 为注册、重发、确认、恢复请求/提交、邮箱绑定及其专用 OAuth/phone proof 增加邮件门控，关闭时统一 503 `EMAIL_AUTH_UNAVAILABLE`；验证逐接口 HTTP 直接请求（含有效旧 token）不消费、不改密码/绑定、不新增申请/投递、不调用外部 provider，正常密码/Google 与密码注销 proof 保留。
- [x] 3.2 将邮件 cleanup-only 与 claim/send 启停分开，新增幂等停用 drain/cancel/fencing 维护动作，保留临时数据期限及有效 ACCOUNT_DELETE proof；验证 worker/隔离 DB 测试覆盖 PENDING/RUNNING、响应迟到、过期申请、缺 SMTP/AES、重复维护和重开不发旧积压，provider send 调用为零且原审计保留。
- [x] 3.3 提供最小 `GET /v1/auth/capabilities` 返回有效密码/Google/邮件布尔值，不返回环境或五账号映射；验证合同/HTTP 测试匹配有效配置、无敏感字段且不能用客户端能力绕过服务器门控。
- [x] 3.4 按 NestJS code-first 生成唯一 OpenAPI 并更新 api-client/各消费者的来源与空时间类型，保持 browser origin/Cookie 机制；验证定向 contract 类型检查、生成后无手写第二接口，以及 `/v1/auth/web/password/exchange`、Google、refresh/logout 的来源拒绝和 HttpOnly Cookie 行为。

## 4. 五账号受控初始化与角色恢复

- [x] 4.1 在 auth 所有的 application/port 边界实现显式目标 dry-run、五槽位规范化/唯一性/秘密策略校验和事务初始化，使用 profiles 公开校验完整成年虚构资料并生成不可投递内部邮箱占位；验证隔离库五个不同 userId、五个不同密码散列、三个 ELIGIBLE、无 Room/membership/session/emailDelivery，非法输入与事务失败无半套数据。
- [x] 4.2 增加运维 CLI 和秘密输入，不复用测试 fixture、不加公网 seed API、不依赖默认数据库；实现只核对的幂等/并发重试和 RETIRED/DELETED/冲突拒绝；验证脚本参数/日志捕获无密码/hash/token/完整邮箱/连接秘密、dry-run 无写、并发最多五身份、重试不覆盖密码/资料或复活账号。
- [x] 4.3 实现持久角色阶段核对和运维指引，复用已有 bootstrap 或 existing-admin 真实会话、真实管理员登录及审计角色接口，稳定命令 UUID 授予独立安全员再撤销管理员安全角色；验证集成/HTTP 中断恢复、相同 UUID 重放不重复成功审计、最终单角色后不再 bootstrap、未批准的未知管理员/额外角色/后续撤权拒绝，输出明确部分完成阶段。
- [x] 4.4 验证最终最小 RBAC 矩阵：管理员仅 PLATFORM_ADMIN、安全员仅 SAFETY_OFFICER、移动三人无后台角色；验证 direct API 权限拒绝、管理员不能执行安全员专属处置、安全员不能管理角色/全量审计、角色撤销对旧 token 生效以及最后管理员保护。

## 5. Web 入口及现有后台认证

- [ ] 5.1 用已确认原页状态和现有 feature/client/i18n 接入 capabilities，试用登录页隐藏注册/找回，能力未知时邮件 fail-closed，保留密码/Google；验证移动组件/路由测试覆盖两种语言、能力失败/恢复、普通邮箱模式回归及服务端 onboarding 导航。
- [ ] 5.2 为邮件注册/验证/找回/重置/绑定直接路由加入停用反馈和返回登录，清除旧链接 fragment 且不自动请求；更新来源/空验证时间消费者，验证页面测试无已发送/验证成功假状态、无邮件请求且未泄露链接凭据。
- [ ] 5.3 通过 Playwright 验证现有后台密码/Google 入口、五独立 browser contexts、HttpOnly 刷新、实时角色导航、普通移动/Google 账号 direct-route 无权限；验证角色差异与服务端响应一致，不新增后台认证方式或放宽权限，provider mock 明确仅为本地证据。
- [ ] 5.4 完成移动 Web 390×844 中英文停用状态截图与 Bridge 原稿对照，核验正常密码/Google 错误/成功路径不被破坏；验证为浏览器/设计截图及差异记录，Bridge 或真实 provider 缺失分别记 BLOCKED，不把组件测试当视觉/外部证明。

## 6. Runbook、清理与目标环境验收

- [x] 6.1 编写无秘密的试用 runbook，包含三种配置、目标/备份/dry-run、五身份数据与角色阶段、真实凭证交付步骤、邮件停用顺序/积压清理、正常三人建房和换人建新房；验证为命令/步骤在隔离环境可复现且不会运行全表 fixture cleanup，未指定真实目标时没有可误执行的默认连接。
- [x] 6.2 实现或复用一般只针对已登记身份的退役/撤会话/正常注销维护，并实现用户明确批准的仅本机开发库旧身份清理 CLI 例外（安全备份、严格目标限制、保留审计、生命周期复用），管理员清理先合法移交、撤角色，保持审计与唯一身份占用；验证隔离 HTTP/runtime 清理后 hash 销毁、access/refresh 不可用、RETIRE 后 seed 拒绝、一般路径未知用户不受影响、无承接管理员时明确拒绝；本机批准例外可清理旧开发最后管理员而公开 API 仍拒绝及合法移交后可清理。
- [x] 6.3 更新试用验收和相关发布准备的范围说明，只记录五账号预置加 Google，不以较宽的无邮件注册/恢复建议阻塞或扩展本 change；验证文档列出未指定 DB/HTTPS/秘密渠道、未完成真实 Google/LiveKit/Bridge 及真机/正式上线证据，原 SMTP 验收继续独立 BLOCKED。
- [ ] 6.4 在用户另行指定目标并授权真实环境操作后，按 runbook 备份、迁移、dry-run、初始化及合法角色分离，按其选定渠道交付凭据；验证脱敏环境记录、五账号认证/权限、真实 Google、公开 webhook、三独立网页客户端音频发布/订阅、一人建房两人加入及结束后换人建新房。本机五账号目标已指定并授权；远程/真实 provider/音频证据未完成部分保持 BLOCKED，禁止自行创建远程资源或部署。

## 7. 最终受影响范围验证与审核交付

- [ ] 7.1 所有代码实施任务完成后仅运行一次完整受影响检查：固定 Node/pnpm，API verify 与迁移/初始化/worker 定向 runtime 检查、受影响 admin/mobile lint/typecheck/tests/build、api-client 类型/合同、相关 Playwright；验证输出与验收场景可对应，失败先修最小范围再补一次完整验证，未执行和既有/环境阻塞分别记录，不重复全仓无关测试。
- [ ] 7.2 汇总适用 OpenSpec 场景、合同、测试、Bridge 视觉、三人 Web runtime、真实 Google/LiveKit 与清理回滚证据，提交审核；验证每项为实际 PASS 或用户明确接受的 BLOCKED/DEFERRED，CLI strict 不能代替实现、真实邮件、真机或正式部署证明，归档/sync 前解决限定例外与相关 active changes 的协调且不重写历史基线。
