# Android 房间体验修正版构建

构建日期：2026-10-07。目标：OpenSpec `simplify-room-and-mobile-experience` 的 Android 受控安装验证。现有 `2026-10-07-android-preview.md` 不改写。

## 产物

- 路径：`/Users/cls/Downloads/Slogan-android-logo-2026-10-07.apk`
- 大小：85,035,026 bytes，约 81.1 MiB。
- SHA-256：`cf73ba3770e38512b500c30bbcdd2b4e3a742a0854abacf9b8d39587e35eac67`
- 包名：`com.slogan.mobile`。
- versionName / versionCode：`0.0.0` / `1`，沿用现有配置；不是商店新版本发布。
- ABI：`arm64-v8a`；minSdk 24 / targetSdk 36。
- 内置 API：`https://slogan-api-pi.vercel.app`，通过编译时公开配置注入并核对 bundle。
- release variant，沿用项目现有 debug signing key；apksigner verify 通过，v2 signature，1 signer。不是生产签名发布。
- Manifest 核对 `windowSoftInputMode=0x10`（adjustResize）；没有 debuggable=true。
- 字体资源共 6 个：4 个共享 Noto Sans SC 静态字重和现有 2 个 Expo 字体，没有重复保留旧路径的 Noto 资源。

本 APK 还包含 Slogan 项目 Logo 的启动器图标修正：普通与圆形图标、自适应前景及白色背景已接入 Expo 配置，并通过 Android-only prebuild 同步。

本 APK 包含最后一轮录音取消/重试竞态修复，以及从原稿导出的语音房图标、按住翻译与深色房主移交弹层、输入框和接任者无障碍标签。此前 `Slogan-android-experience-2026-10-07.apk` 和 `Slogan-android-experience-final-2026-10-07.apk` 是较早产物，后者尚未包含本轮 Logo 修正；最终验收请使用上方新的 `Slogan-android-logo-2026-10-07.apk`。

## 构建及本地证据

源：develop `716cc0bd0fd4e0010721f0e0ac3c77eec4522436` 加当前未提交工作区，没有新的 Git commit/PR/推送。Node 24.21.0、pnpm 12.3.4、Gradle 9.3.1、Android build-tools 36.0.0；`:app:assembleRelease --no-daemon --max-workers=2 -PreactNativeArchitectures=arm64-v8a` 通过。

mobile typecheck/lint、45 suites/131 Jest tests，以及 admin/API/合同/相关浏览器和本地队列构建结果见 [验收记录](../acceptance/simplify-room-and-mobile-experience/README.md)。单元测试、APK 签名及 adjustResize 设置不是实际麦克风或键盘验证。

## 安装与上线边界

用户明确自行执行真机测试；当前没有代理执行的安装或真机运行证据。需要 Android 7.0+ 的 arm64 设备；两台 Android 才能验证旁听者听不到私人录音及恢复正常房间音频。

当前在线 API 尚未发布本轮新增等级范围、文字消息及异步清理合同。本 APK 指向既有生产地址，四个线上数据库迁移已成功执行并核对，API/队列部署仍在进行；必须完成部署后，再进行完整在线验收。未部署新版后端时不能声称所有新功能可用。没有修改在线环境变量、供应商、密钥或 Google 登录。

本次未发布商店、未归档 OpenSpec。用户已授权线上发布与四个数据库迁移，迁移已完成；发布状态将在云端验证后更新。Figma 最终视觉及 Android 设备证据未完成，iOS 不在范围。发布/恢复/回滚顺序见 [Vercel 队列方案](../deployment/room-experience-vercel-queues.md)。

## Android Logo 修正证据

此前 Expo 配置没有 `android.icon` / `android.adaptiveIcon`，原生生成目录仍使用默认 Android 机器人。Logo 只用于页面，不会自动成为启动器图标。现以 `assets/brand/slogan-logo.png` 为源，生成普通图标和安全区前景；原始 Logo 不改写。

检查最终 APK 的 application icon / roundIcon 及 Android 8+ adaptive XML 引用，五档 DPI 共 15 个图标资源逐字节匹配本轮生成的资源；提取图标见 [APK 内实际图标](../acceptance/simplify-room-and-mobile-experience/android-launcher-from-apk.png)，完整核对见 [构建记录](../acceptance/simplify-room-and-mobile-experience/android-logo-build.json)。新旧 APK 签名证书一致，可覆盖安装；未在真机启动器上验证缓存/裁切。

图标配置是 Level 0 品牌资产接线修正；没有新增产品行为或修改 iOS。

图标规格依据：[Expo Android 图标配置](https://docs.expo.dev/versions/v57.0.0/config/app/)、[Android 自适应图标安全区](https://developer.android.com/develop/ui/compose/system/icon_design_adaptive)。
