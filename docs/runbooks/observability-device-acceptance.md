# Android 真机验收交接

2026-10-15：用户负责真机验证；不能把此交接视为已经通过验收。

使用带监控配置、匹配 Git commit/release/build 且已上传 JS maps 的 Android **release 安装包**。Expo Go、debug 包、Web 或 JVM fixture 不替代此步骤。iOS 原生监控继续关闭。

1. 记录 APK commit、versionName/versionCode、设备型号、Android 版本、网络及 Sentry project/environment。确认进入 slogan-mobile，错误能对应到同一 release/dist。
2. 用仅用于验收的入口分别触发 JS 异常与结构化 Java/Kotlin 崩溃；不向正式页面增加调试按钮、不发送私人内容。核对 Sentry 源文件/行号、固定错误分类及邮件。JS/原生崩溃分别留证，不能互相代替。
3. 断网后触发受控 canary，查看应用私有缓存不含 canary 内容/身份/凭据；恢复网络、重启后核对补报与去重。不要将原始私有缓存上传仓库。
4. 进入真实语音房，验证断网/重连与恢复后成员资格；主动离房、被移除、正常结束不产生错误告警，音频和麦克风行为保持。核对 trace 仅有技术阶段/耗时，不含房间/参与者身份或 token。
5. 关闭监控配置并重新构建/安装，确认停止新增外传。旧安装包需单独处理，不能靠服务端开关宣称全部关闭。

提供去敏截图、事件链接、构建与设备信息以及每步 PASS/FAIL；未执行项保持未完成。原始音频、转写、登录 token、DSN/上传 token 不放进验收附件或聊天。
