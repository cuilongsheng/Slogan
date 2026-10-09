# 直接入房验证

## 最新状态：2026-10-09 自动设备检查补充，尚未发布

用户最新要求覆盖此前“首次开麦才询问”的行为：现在连接入房后自动检查系统权限、临时麦克风音频轨道和播放状态；Android 检查已启动的 LiveKit AudioSession 可用输出，Web 使用实际播放许可状态。探测不会发布、录制或上传，完成/取消始终 stop，React Native 还调用 MediaStream.release；默认房间麦克风关闭。

拒绝权限、永久拒绝、无输入/输出或播放被阻止在房内给出简洁提示、重试和必要的系统设置/开启声音动作，不要求固定设备准备页面。输出 API 不能证明物理扬声器可听；实际听音仍由用户真机验证。检查未完成就退出、连接迟到及显式开麦与探测竞争都有代次/资源释放测试。进程级原生音频会话按 room 持有者串行获取/释放，防止旧房退出停止新房音频。

本地 mobile lint/typecheck、50 suites /162 tests、10 项 Expo Router Web 入口与授权回归、3 项真实组件视觉/交互验证通过；Pages 构建及 Android Hermes bundle 导出通过。原生 adapter 单元测试使用明确 SDK/设备替身，未接真机；没有将这些检查当成真实听音或完整 APK 安装验收。

`device-warning-runtime-fixture.png`：390×844 实际房内组件，设备/会话与消息使用明确测试 fixture，展示永久拒绝及重试；没有假装真实 Android 权限状态。原稿 115:1425 不修改，错误提示属于用户批准补充状态。

发布按用户明确要求暂停。此前提交 e89a786 已推送修正分支，但本轮未创建 PR、合并或更新生产 APK；本次自动检查和创建/后台/请求修正只保存在本地。生产状态不由本报告的本地 PASS 推断。

以下为此前各批次的历史验证记录，设备检查行为以本节为准。

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
