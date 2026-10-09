# Android 自动交付验收

2026-10-08。本地与实际云端自动交付通过；房间后台清理有独立未通过项。真机验证由用户执行。

## 已验证

- Node 24.21.0 / pnpm 12.3.4；mobile typecheck/lint、发布脚本及新增 API 文件 lint、API build、Prettier 与 git diff check 通过。
- Pages proxy 与生产发布门槛 16 个测试通过；新增实际 Nest HTTP 发布提交响应头 e2e 3 个测试通过；OpenSpec 严格校验及 actionlint 1.7.12 通过。
- Temurin 21.0.12.1、SDK/build-tools 36、NDK 27.1.12297006、Gradle 9.3.1 的实际 arm64 assembleRelease 成功，990 个原生任务，2m45s。
- 校验 APK 的稳定签名、package、非 debuggable、adjustResize、版本名称/版本号、内置提交/API、bundle API 地址和 15 份普通/圆形/自适应启动图标资源。错误提交号、错误版本号均拒绝校验，保留原有验证产物。
- 产物元数据见 [local-android.json](local-android.json)。该包是本地证据，未发布为 latest，不能证明旧生产 API 支持新房间合同。

## 构建问题及修正

云端 Gradle setup 原先在 Expo prebuild 之前运行，缓存找不到尚未生成的原生 Gradle 文件；改为 prebuild 后执行。托管 runner 的 sdkmanager 不在 PATH；显式使用固定版本的 Android SDK setup action。APK 资源压缩会改写资源路径，校验器从 aapt2 资源表解析实际路径；键盘模式按数值位检查，不依赖十六进制补零格式。

本机原有 ANDROID_HOME/ANDROID_SDK_ROOT 指向不同目录，已仅在构建进程中对齐。JDK 25 的原生访问警告导致 CMake 配置失败，已使用与 CI 相同的 JDK 21 构建；没有改变系统默认 JDK 或其他 checkout。

## 实际云端交付

[PR #9](https://github.com/cuilongsheng/Slogan/pull/9) 已合并为 `fc7bbf86cb28ee315c6e57e4d2a62a0dfc8e56d3`。PR Actions 实际构建、APK 校验与上传通过；[main Actions](https://github.com/cuilongsheng/Slogan/actions/runs/37715522066) 的 build/publish 均通过。API 响应头、两个生产 Pages 的 release.json 实际提交均匹配。GitHub Release 发布 `0.0.7` / code `1007`，固定下载 HEAD 返回 302，实际下载 85,035,110 bytes，SHA-256 与公开元数据一致；下载包的签名、adjustResize、内置提交/API 和 15 份图标再次核对通过。见 [云端证据](cloud-android.json)。

## 独立的业务发布限制

真实两账号文字消息、范围和快速退出通过，但六分钟停止房间 HTTP 请求后，持久清理命令仍为 PENDING / attempts=0。该失败不属于 APK 构建失败，也不能因自动发布通过而标为业务验收通过。请求内恢复播种补丁仍需 PR 与实际云端复核；当时 Mac 再次锁屏，无法读取已登录的 Vercel 日志或操作 GitHub。Vercel 项目变量列表未见 STT/AI 配置，按住翻译尚无真实供应商成功证据。

签名沿用现有受控 debug 安装证书，非商店签名。Google 保持关闭；iOS 不在本轮范围。设备键盘、两机音频隔离与完整原生视觉没有验证证据。
