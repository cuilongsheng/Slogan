# implement-mobile-auth-profile 验收记录

## 范围与确认

- 日期：2026-09-25。目标：Figma Slogan 文件 `56nIowZmvBhb0QJvOlDQdU` 的 390×844 V2 登录 `118:2970`、基本资料 `118:3095`、学习偏好 `118:3140`、年龄限制 `118:3214`、微信扫码 `118:3238`。
- 用户确认：本批只做 Google/微信与首次资料；邮箱另做。先交付可接真实 Google 的前端和资料页面，头像上传及微信扫码标为 `BLOCKED`；CEFR 按 UI 三个区间并同步调整后端。
- 受影响路由：`/sign-in`、`/profile/basic`、`/profile/preferences`、`/age-restricted`、`/ready`。`/ready` 只显示本批完成状态，房间业务不在本 change 范围。

## 设计与 API 对照

| 项目       | 证据与结论                                                                                                                                                                                                                                                                               |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Figma      | 本轮通过 Figma Desktop Bridge 重新读取并截取原始 `118:2970`。登录 hero 在 390×844 frame 内为 x=16、y=245、358×132；主按钮 x=24、y=641、342×52；微信选项 y=750。390×844 浏览器预览的共同元素已对到这些位置。主色 `#6247E8`。资料/年龄页沿用此前 Bridge 读取的属性。                       |
| 授权       | 原生 Google Sign-In SDK 提供一次性 server authorization code；移动端调用 `/v1/auth/oauth/google/exchange`。API 白名单中的 `slogan://oauth/google/native` 是原生代码模式标记，服务端向 Google 换码时传空 redirect URI。Google Web client secret 仅在服务端；ID token 用 Google 公钥验证。 |
| 会话与资料 | `POST /v1/auth/refresh`、`POST /v1/auth/logout`、`GET /v1/me`、`PUT /v1/me/profile` 通过生成的 `@slogan/api-client` 类型调用。Token 存在 SecureStore；服务端 `onboardingState` 决定入口。                                                                                                |
| CEFR       | Profile/API/Prisma 增加 `A1_A2`、`B1_B2`、`C1_C2`；旧六值保留。房间创建仍只接受单级。枚举迁移为追加式；回滚应保留枚举值和既有区间数据。                                                                                                                                                  |
| 缺口       | API 没有头像上传、微信二维码创建/轮询。Google 返回有效头像 URL 时可预填资料；没有头像时资料不能完成，页面显示阻塞说明。微信入口禁用，无静态假二维码或假成功态。                                                                                                                          |

## 本地验证

| 检查                            | 结果                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 移动端 Jest                     | PASS：9 suites、22 tests，包括原生和 Web Google 授权码/取消、浏览器 Cookie 恢复、同账号资料建议预填、跨账号建议清理、token 刷新、资料区间选择和路由。                                                                                                                                                                                                        |
| 移动端类型、lint、iOS JS export | PASS。导出证明 JS bundle 可构建，不证明原生开发构建或 Google 授权。                                                                                                                                                                                                                                                                                          |
| Expo Go 本地预览服务            | PASS：`expo start --go --offline` 输出二维码；iOS manifest 与 JS bundle 均返回 HTTP 200。未在设备上打开页面。                                                                                                                                                                                                                                                |
| Mac 浏览器登录页预览            | PASS：`expo start --web --offline --port 8082`，`/sign-in` 返回 HTTP 200；[历史 Web 截图](assets/implement-mobile-auth-profile-web-390.png)为 2026-09-25 修正前版本。Google 主按钮可点击；微信入口禁用。Web 预览不证明原生登录或设备视觉。                                                                                                                   |
| 浏览器 Google 登录与刷新        | PASS：用户在 Chrome 完成真实 Google 登录并进入 `/ready`；刷新后仍显示 `Profile complete`；点击 `Sign out` 后返回 `/sign-in`，再刷新仍未登录。Web refresh token 由后端 `HttpOnly` 会话 Cookie 承载，前端不写入浏览器普通存储。首次资料页面的真实新账号提交未验证。非凭据的 Google 名称/头像建议在同一标签页刷新后按 userId 恢复，此项目前只有自动化测试证据。 |
| 本地 API 与浏览器跨域           | PASS：开发 PostgreSQL/Redis 已启动、20 个迁移已应用、API 已启动；浏览器来源的 Cookie 端点预检返回 204、正确的 `Access-Control-Allow-Origin` 和 `Access-Control-Allow-Credentials: true`。                                                                                                                                                                    |
| 后端相关单元测试                | PASS：API 单元 38 suites、219 tests；包含 Google OAuth 适配器的安全错误类别记录、签名拒绝、资料与房间等级约束。                                                                                                                                                                                                                                              |
| 认证与资料 HTTP E2E             | PASS：`identity-profile.e2e` 10 tests，覆盖浏览器 Cookie 登录、轮换、退出、来源拒绝及原有资料/成年边界；浏览器响应中没有 refresh token。                                                                                                                                                                                                                     |
| 资料 E2E                        | PASS：8 tests，包含 B1–B2 提交及旧 B1 兼容；隔离测试 PostgreSQL 已应用新增枚举迁移。                                                                                                                                                                                                                                                                         |
| API/客户端合同检查              | PASS：NestJS code-first OpenAPI 生成与直接 drift check、`api-client generate:check`、类型检查。                                                                                                                                                                                                                                                              |
| 项目静态检查                    | PASS：受影响 lint、类型检查、`deps:check`、OpenSpec strict、格式和 `git diff --check`。Web/iOS JS export 均通过。                                                                                                                                                                                                                                            |

## 尚未通过的产品证据

- `PARTIAL`：最初一次真实 Web 换码失败；当时 `apps/api/.env` 已更新，处理请求的却是更早启动的旧 API 进程。重启后新授权码成功完成登录、刷新恢复和退出。当前账号已完成资料，因此还没有真实新账号首次资料提交的浏览器证据。原生 iOS/Android 客户端配置和开发构建仍未完成；当前主机没有可用 iOS Simulator 或 Android 设备。需在开发构建上验证 Google 选择账号、取消、回跳、服务端换码、首次资料、重启恢复和登出。Expo Go 不含原生 Google 模块。
- `PARTIAL`：Figma Desktop Bridge 一度断开，恢复后已读取原始 frame 和截图；共同元素的主要坐标已按原稿复核。完整 1:1 不成立，因为本 change 按用户决定排除了用户名/密码，并把 Google 改为主按钮；独立重建 gate 与原生设备画面仍未完成。
- `BLOCKED`：头像上传和微信扫码缺后端合同。本次仅提供真实可用能力对应的页面状态。
- 有意差异：Figma V2 登录主入口包含用户名密码；用户决定邮箱/密码另做，所以本批登录页以 Google 为唯一可操作方式，并以 Google 替代原稿的主按钮；微信保持阻塞。浏览器预览使用原稿资产绘制状态栏并显示底部手势条；原生设备由系统绘制。基本资料设计中的所在地以 `city` 自由文本提交，没有把它伪装成 ISO 国籍代码。

## 2026-09-26 登录视觉修正

- 使用 Figma Desktop Bridge 重新读取并截图原始 V2 登录帧 `118:2970`；通过 Bridge 导出状态栏、微信和 Google 原始图标。未改动 Figma 文件。
- 390×844 Web 预览补齐状态栏与底部手势条；运行页中状态栏 x20/y14/350×24、Logo x139/y73/112×112、主按钮 x24/y641/342×52、分隔文案 y711、双列入口 x24 与 x201/y750/165×52，均对照原帧。微信和 Google 图标在原帧位置 x62 与 x240/y764/24×24。
- Google 主按钮与 V2 底部 Google 入口均调用真实 Google 登录；微信仍禁用并提供可访问性说明。修正后移动端 lint、typecheck、16 套 42 个测试、Web/iOS JS 导出及 OpenSpec strict 验证通过。
- **仍非整页 1:1**：原稿 y408–607 的用户名、密码、注册和找回密码属于此前约定另做的邮箱登录范围。当前只显示 Google 登录引导，因此该区域保持留白；不会把未实现的邮箱功能伪装成可用。等待产品范围决定后，才能对登录整页做最终视觉验收。

## 结论

本地代码、合同、迁移和所列自动化检查已就绪；浏览器真实 Google 登录、刷新恢复和退出已通过。首次资料的新账号实测、原生设备视觉与登录、头像上传和微信扫码仍未完成；本 change 保持部分产品验收状态，不把浏览器结果或本地构建标作原生设备或上线证明。

## 2026-09-28 登录页更新

独立 `implement-mobile-email-password-auth` 已补用户名/密码、创建账号及找回密码，因此 2026-09-26 记录中的登录页留白不再是当前状态。使用 [390×844 中文浏览器预览截图](assets/mobile-login-390-visual.png) 重新对照批准的 V2 登录稿，并将 Logo、hero、输入、主按钮及双列登录入口整体下移 20px；主按钮和 Google 入口现在均可操作，Google 按钮自动化断言为 enabled。该截图与 Figma 的主体层级和关键位置接近；字体渲染、原生状态栏及设备安全区仍需原生设备逐项对照，不能宣称完整 1:1。

### 2026-09-28 再校正

按用户提供的 V2 截图重新量取画板内坐标后，发现上段“整体下移 20px”造成一致的纵向偏差，已将登录内容整体上移 20px。390×844 浏览器夹具现在检查 hero 顶边约 y245、主登录按钮 y641、Google 入口 y748，并断言 Google 入口可用；截图已更新。Web 位置校正不等于原生设备逐像素验收。

## 2026-09-29 iOS 27 模拟器验证进度

- Xcode 27.0 与 iOS 27.0 runtime 已安装；创建并启动 `Slogan-iPhone-13`，UDID `51CE422F-FCF0-418F-8CCB-EAB859F2345C`。生成 iOS 原生工程、安装 CocoaPods，并成功编译和安装 Slogan 开发包。
- 首次启动发现 iOS 27 SDK 要求 Scene 生命周期；将 Expo 更新至 `57.0.25`，安装 `expo-build-properties` 并启用 `ios.enableSceneSupport`。重新生成的 `Info.plist` 包含 `UIApplicationSceneManifest` 和 `EXExpoAppSceneDelegate`，重新编译 `BUILD SUCCEEDED`；原生程序已能启动并连接 Metro 加载 JS。
- **BLOCKED：登录页及后续原生验收。** 本机目前无 Apple 代码签名身份，构建的模拟器包没有 `application-identifier` 或 `keychain-access-groups` entitlement。全新安装时 `expo-secure-store` 读取 iOS Keychain 返回 `-34018`，AuthProvider 因而显示“暂时无法恢复登录状态”。未使用普通存储回退保存凭据，也未将该错误画面判作登录页通过。需要在 Xcode 配置 Team 后将 Team ID 写入本机忽略的 `apps/mobile/.env` 的 `EXPO_APPLE_TEAM_ID`，重新 prebuild/编译，再验证登录页和会话。
- **BLOCKED：原生 Google 登录。** 本机 `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` 仍未配置；需要 Google Cloud 中 bundle ID 为 `com.slogan.mobile` 的 iOS OAuth client ID，然后重新 prebuild 与编译。不得将 Web Google 登录结果当作原生通过。
- 本次检查：移动端 lint、typecheck、40 suites / 106 tests、iOS JS export、Expo 依赖版本检查均通过。原生编译通过不代表 Keychain、Google 授权或 1:1 视觉验收通过。
