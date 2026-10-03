## Context

见 [proposal.md](proposal.md)。当前 Expo Router 只有工程页，`packages/api-client` 已从唯一 OpenAPI 生成类型。后端已有授权码兑换、刷新、登出和资料接口。设计目标为 Figma 文件 `56nIowZmvBhb0QJvOlDQdU` 的 V2 frame：登录 `118:2970`、基本资料 `118:3095`、学习偏好 `118:3140`、年龄限制 `118:3214`、微信扫码 `118:3238`，均为 390×844。现有登录 frame 中心是用户名密码，但本批范围经用户确认只做 OAuth。

## Goals / Non-Goals

**Goals:** Google 原生 SDK 的一次性 server authorization code 到既有兑换接口；Mac 浏览器预览使用 Google Web code popup 接入同一兑换接口；受保护的原生会话恢复/刷新与资料入口；三个 CEFR 区间在前端、API、持久层一致；明确被阻塞的头像上传和微信扫码。

**Non-Goals:** 不仿造二维码、不创建假的远端头像 URL、不实现密码/邮箱流程、不把本地构建称为真实 provider 或真机验收。

## Decisions

1. Google 不再用通用 `slogan://` 作为 Google 授权回跳，因为 Google 已停止支持任意自定义 URI scheme。使用原生 Google Sign-In SDK 取得一次性 server authorization code；客户端公开的 Web/iOS client ID 从 `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` 和 `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` 读取，iOS URL scheme 由 iOS client ID 生成。后端仅接受白名单中的 `slogan://oauth/google/native` 作为本 API 的原生代码模式标记，在与 Google 换 token 时传空 redirect URI；secret 只留后端。该模式由 SDK 管理授权回跳，不向客户端暴露 provider secret。后端用 Google 公钥验证 ID token 签名、受众、签发者和过期时间。没有配置时页面提示不可用；Expo Go 不含原生模块，设备验收需要开发构建及真实 Google 配置。
2. 微信扫码暂不暴露可点击的假二维码。入口展示暂不可用状态，待真实扫码创建/状态轮询合同补齐后再接入 frame。后端现有 `wechat/exchange` 只消费外部授权码，不提供二维码生命周期。
3. 安全存储只保存后端 token pair；access token 在过期前刷新，同一进程单飞刷新，轮换后的 refresh token 先写入安全存储再用于后续请求。401 或无效刷新清理会话；网络错误保留 token 并允许重试。登出先调用后端，最后清理本地；失败时仍清理本地并提示服务端撤销未确认。
4. 路由依据服务端 `/v1/me` 的 onboardingState 进入登录、资料、年龄限制或已符合资格的占位入口。资料未完成时不能进入未来房间路由；年龄限制只由服务端状态作最终判断。
5. CEFR 在 profile 合同新增 `A1_A2`、`B1_B2`、`C1_C2` 三个值，UI 显示 en dash 区间。原六个值仍可读取/写入以保护旧客户端。Prisma `CefrLevel` 枚举仅追加值，不重写历史资料；房间 DTO/策略继续只允许单级值，避免本 change 改变房间筛选语义。当前 API 采用 NestJS code-first，重新生成 `openapi/openapi.yaml`，再生成客户端类型，不维护手写第二合同。
6. Figma 头像添加交互需要上传接口，当前没有。Google suggestedProfile 的有效 HTTP(S) 头像可用于预填；缺头像时保持资料未完成并说明暂时无法继续，不提交占位 URL。用户允许头像上传在本 change 保持阻塞。`city` 对应基本资料中的所在地文本，避免把自由文本当作 ISO 国籍代码；记录视觉文案差异。兴趣 UI 的六个可选项映射为稳定小写代码。
7. 用户可见文本集中在移动端中英文资源；设备语言为中文时默认中文，其余默认英文。采用轻量本地字典，不复制 API DTO。页面组件只负责表单交互；网络和会话在 feature/service 层。
8. 开发用浏览器预览使用 390×844 画布，Google Identity Services 的 popup code model 取得一次性授权码，客户端只持有公开 Web client ID，向 `/v1/auth/web/google/exchange` 提交授权码和浏览器 origin。后端白名单和 Google 换码均使用同一 origin，后端继续保管 client secret 并验签 ID token。浏览器 OAuth 成功时后端设置仅限认证路径的 `HttpOnly`、`SameSite=Lax` refresh Cookie；生产 HTTPS 使用 `Secure`。Web access token 只存内存，刷新页面调用专用浏览器刷新接口恢复会话，退出接口清理 Cookie 并撤销服务端会话；原生 SecureStore 流程不变。浏览器 Cookie 端点校验来源并使用凭据化 CORS，不把 refresh token 写入浏览器普通存储。同一标签页的 `sessionStorage` 只保存按平台 userId 绑定的 Google 名称/头像建议，以便首次资料页刷新后继续预填；账号不符、会话无效或退出时删除，不保存 token。按钮始终可点击，缺少配置时按下展示明确错误，不伪造登录成功。此预览不是独立 Web 产品，也不代替原生设备验证。

## Risks / Trade-offs

- [真实 Google Web/iOS/Android 配置或原生开发构建未就绪] → 保持配置错误态；验收标记 `BLOCKED`，不注入模拟 token。
- [头像上传合同缺失] → Google 头像预填可完成部分用户的资料，其余用户保持 `PROFILE_REQUIRED`；不会将本批标为全部完成。
- [微信设计只有静态 QR] → 不把静态图作为真实扫码；前端入口标记阻塞，明确后续需要二维码创建、过期与轮询合同。
- [新增枚举值影响旧版本] → 后端只追加，旧六值继续接受；发布顺序先迁移/后端/合同，再移动端。回退移动端或服务端版本时保留枚举扩展及既有区间数据；若必须收缩数据，需先按明确映射迁移，不能直接删除 PostgreSQL enum 值。
- [会话刷新失败或并发请求] → 单飞刷新及错误分流，测试轮换、失效、网络重试和登出。
- [Web 弹窗被阻止、Google origin/后端白名单不一致或本机缺 OAuth 凭据] → 展示取消/失败/配置错误；不建立本地会话。预览实现可单独回退，不涉及数据库迁移或原生登录协议。
- [浏览器 Cookie 被跨站请求滥用或退出后残留] → 仅允许配置的 Google Web origin 使用 Cookie 端点，Cookie 限制 `HttpOnly`、`SameSite=Lax`、认证路径，浏览器退出先清 Cookie 并撤销服务端会话；回退时关闭浏览器 Cookie 路径并清除同名 Cookie，不改变原生 token 协议或数据库。

## Migration Plan

先应用仅追加的 PostgreSQL 枚举迁移，再发布接受新旧值的后端与 code-first OpenAPI，最后发布生成客户端和移动端。旧资料无需重写。回滚客户端或后端时保留新枚举及资料；旧后端可能拒绝新值，因此回滚后端前须停止新客户端写入或维持兼容处理。
