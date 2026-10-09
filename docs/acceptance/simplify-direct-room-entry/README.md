# 直接入房验证

日期：2026-10-09。需求来自用户要求“点击房间，加入房间即可”，对应 OpenSpec `simplify-direct-room-entry`。发布状态须以 PR 与生产记录为准，本文件先记录本地结果。

列表卡片一次点击直接进入 session 并发起真实 membership API；双击不重复导航。详情页保留分享链接入口，其加入按钮同样直达 session。密码房只输入四位密码，提交后直达 session。保留后端资格、容量、密码、授权校验及失败重试；不再经过固定的详情、规则、设备三页。首次开麦才请求原生权限，入房默认静音；权限等待中退出后不得发布麦克风。

`rulesAccepted` 仍为现有 API 合同字段，直接加入意图发送 true；这不代表用户阅读过旧规则页，旧规则前置需求在该 change 中明确移除。语音处理目的授权独立保留：仅缺少当前目的授权时显示同意组件，用户明确接受后才能重试，不自动调用 ACCEPT。旧 rules/device URL 保留兼容，但不在新的列表加入路径上。

本地：mobile lint、typecheck、46 个测试套件 / 135 项测试通过；4 项 Playwright 流程通过；`build:pages:mobile` 通过；OpenSpec strict 通过。浏览器测试使用合同形状的 fixture，请求顺序与路由由实际组件运行。credentials 故意返回 503，验证已占房位后的失败恢复，不代表真实 LiveKit 连通或线上验收。

复现浏览器测试：`pnpm exec playwright test --config tests/direct-entry.playwright.config.ts`。测试自启端口 8083 的 Expo Web，并在结束后关闭它。

## Figma 与运行证据

通过已连接的 Figma Desktop Bridge 读取 Slogan 的 `02 UI`，Section `115:1196`，列表 Frame `115:1197`、房内 Frame `115:1425`。原稿截图 `list-original-figma.png` 原样保留。用户本轮批准交互路径变化，未要求重画列表。

| 证据 | 范围 / 结果 |
| --- | --- |
| `list-runtime-web-fixture.png` | 390×844 实际列表；点击卡片直达 session。数据与头像为测试 fixture。 |
| `join-error-runtime-web-fixture.png` | membership 成功、媒体失败时重试或退出，不跳回固定前置页。 |
| `consents-runtime-web-fixture.png` | 只在授权缺失时显示目的授权；深色页面标题可读，内容过长可滚动。 |
| 原稿对照 | 现有列表仍有头像、卡片高度等差异，不能将整个手机 UI 标为 1:1 PASS；本轮主要改变入房路径。 |

Android 权限、真机音频与两机隔离由用户测试。公开部署、后台清理独立云端验证与新 APK 下载需在发布后补充结果。


## 2026-10-09 真机反馈修正

之前只覆盖了列表和详情按钮，保留了可进入的旧规则/设备组件，详情深链与分享还会停在详情页；同时房内仍使用旧版大块发言者卡片。不能据之前的局部测试宣称完整用户路径或新版布局完成。用户截图所用 APK 版本没有提供，不能据截图认定用户安装错误。

本次删除旧 JoinScreens，实现所有详情/规则/设备/密码路由跳转到 session，保留邀请标识；分享的即时房间和邀请沿同一路径。session 对公开房不要求内存草稿，密码房先弹窗、有效输入后才请求加入，错误密码在同一弹窗修改。独立用途授权仍按原有明确授权处理，绝不伪造 ACCEPT；首次开麦才请求系统权限。

Bridge 再次确认 Slogan / 02 UI / 115:1425，390×844，原稿 `voice-original-figma.png`。移除旧 172 高发言卡片；规则始终显示；成员条在 y220–411，四列成员与居中空位；聊天区域占剩余高度、滚动展示消息；母语表达只显示右下圆按钮；输入、发送和麦克风三个并列控件。国旗底、角色标识、静音底和房主减号采用原稿尺寸与颜色；减号进入已有真实移出确认，不立即移出。真实生产头像由用户资料提供，原稿人物照片仅用于测试 fixture。

验证：mobile lint/typecheck、47 suites / 142 tests、10 项真实 Expo Router Web 入口/授权回归和 1 项房内组件交互测试通过；Pages build、Android 交付单元测试 4 项、OpenSpec strict 通过。覆盖四条旧 URL、分享、邀请保留、缺少和错误密码、文字发送、按住/松开翻译和房主接替退出。Playwright 配置必须串行运行，避免共享 test-results 目录被另一个配置清除。

运行对照 `voice-runtime-web-fixture.png` 使用同样 390×844、已加载 Noto Sans SC 400/500/700、房主状态、相同原稿照片、B1·B2 和剩余38分钟。系统文字为明确的视觉 HTTP fixture 数据，用于测量消息布局，不证明生产系统消息接口。`voice-comparison.html` 提供原图与最终运行图并列及透明叠图，未修改原始图像。

原稿/运行布局核对：头部88、规则76、成员191，旧发言卡片不存在；聊天与底栏分别独立，底栏输入236×56、发送44×44、麦克风44×44，母语按钮38×38。行为和 Web 布局分别验证，不宣称 Android 1:1 或双机音频已通过。当前本机没有 Android 模拟器或连接真机，原生权限/键盘/音频由用户按既定安排验证。

本次无 API 合同、数据库迁移、Redis 配置或供应商变更。生产发布和实际 APK 的提交、版本及 SHA-256 由本次 PR/Android workflow 和 release-artifacts 记录；打包器新增检查 APK 内 `voice-room-direct-entry-v2` 标记，避免只核对 app.config 而遗漏 JS 界面版本。
