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
