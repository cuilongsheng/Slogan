# Android 自动交付验收

2026-10-08。本地通过，云端交付未完成。真机验证由用户执行。

## 已验证

- Node 24.21.0 / pnpm 12.3.4；mobile typecheck/lint、发布脚本及新增 API 文件 lint、API build、Prettier 与 git diff check 通过。
- Pages proxy 与生产发布门槛 16 个测试通过；新增实际 Nest HTTP 发布提交响应头 e2e 3 个测试通过；OpenSpec 严格校验及 actionlint 1.7.12 通过。
- Temurin 21.0.12.1、SDK/build-tools 36、NDK 27.1.12297006、Gradle 9.3.1 的实际 arm64 assembleRelease 成功，990 个原生任务，2m45s。
- 校验 APK 的稳定签名、package、非 debuggable、adjustResize、版本名称/版本号、内置提交/API、bundle API 地址和 15 份普通/圆形/自适应启动图标资源。错误提交号、错误版本号均拒绝校验，保留原有验证产物。
- 产物元数据见 [local-android.json](local-android.json)。该包是本地证据，未发布为 latest，不能证明旧生产 API 支持新房间合同。

## 构建问题及修正

云端 Gradle setup 原先在 Expo prebuild 之前运行，缓存找不到尚未生成的原生 Gradle 文件；改为 prebuild 后执行。托管 runner 的 sdkmanager 不在 PATH；显式使用固定版本的 Android SDK setup action。APK 资源压缩会改写资源路径，校验器从 aapt2 资源表解析实际路径；键盘模式按数值位检查，不依赖十六进制补零格式。

本机原有 ANDROID_HOME/ANDROID_SDK_ROOT 指向不同目录，已仅在构建进程中对齐。JDK 25 的原生访问警告导致 CMake 配置失败，已使用与 CI 相同的 JDK 21 构建；没有改变系统默认 JDK 或其他 checkout。

## 未完成

实际 Actions 完整构建、PR 创建/main 合并、同提交生产 API 与两项 Pages、云端队列清理、真实 GitHub Release 和固定下载文件哈希仍需验证。Mac 锁屏阻止浏览器 PR 操作，GitHub 连接器未登录；代码分支已通过 SSH 推送，生产仍未切换。不能把预览检查或本地 APK 称为上线完成。

签名沿用现有受控 debug 安装证书，非商店签名。Google 保持关闭；iOS 不在本轮范围。设备键盘、两机音频隔离与完整原生视觉没有验证证据。
