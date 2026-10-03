# 真实服务商验收进度（2026-09-30）

本记录只描述本机本次实际执行的外部验证。历史 change 的本地测试结果不自动升级为真实服务验收。

## 2026-10-01 范围澄清

产品所有者明确：真人房间交流不展示实时字幕；个人遇到不会表达时，主动把母语内容交给私人辅助工具，取得英文说法后由本人开口。基础 LiveKit 双人语音和**文字输入的私人表达辅助**均不依赖 STT。本记录以下 STT 阻塞仅对应现存 OpenSpec 中的短语音输入、可选房间敏感语音处理及会后关键词，不阻塞上述两项当前验收。

当前 `ai-expression-assistance` OpenSpec 和手机端仍保留私人短语音输入；房间敏感语音处理和会后关键词另有独立规范。是否取消这些已批准的范围，应通过后续 OpenSpec 修订，不能由本验收记录直接改变产品要求。

## LiveKit Cloud

本机 `apps/api/.env` 已配置 `wss://*.livekit.cloud` 项目及 API 凭据。使用已安装的 `livekit-server-sdk` 和 `@livekit/rtc-node` 在 Cloud 创建一个随机命名的隔离房间，按应用现有的最小 grant 签发两名临时身份的 5 分钟 token；两名身份同时连接并由 Cloud `listParticipants` 返回 2 人。随后 Cloud `removeParticipant` 移除第一人，客户端断开且旧 token 重连被拒；Cloud `deleteRoom` 使第二人断开，按名称查询房间为空。清理后全项目 `listRooms` 返回 0。脚本只输出布尔结果，未输出密钥、token、身份或房间名。

此结果证明当前 Cloud 凭据、服务端管理操作、两名 RTC 身份连接与旧 token 撤销路径可用。它没有发布或收听真实麦克风音轨，没有经过 Slogan 的房间授权/API/数据库流程，也没有证明公网签名 Webhook。`implement-livekit-voice-session-backend` 的 6.1 因这些剩余条件仍未完成；相关 Cloud 验收文档中 2026-09-12 的“未配置凭据”仅是当时状态。

## 合格 STT 双人语音

当前 `STT_PROVIDER_CATEGORY`、`STT_BASE_URL`、`STT_API_KEY`、`STT_MODEL`、`STT_REGION`、`STT_DATA_USE`、`STT_DELETION_MODE`、`STT_STREAMING_MODE` 均未配置，`ROOM_SPEECH_DETECTION_ENABLED` 与 `POST_ROOM_KEYWORDS_ENABLED` 均为 `false`。无法启动需要真实 STT 的隐身检测、房主告警、会后关键词、撤回同意与降级双人测试。除配置连接参数，还需确认供应商区域、仅请求处理、不训练、留存与删除政策符合现有 OpenSpec；不能只把任意兼容接口视为“合格”。两个 change 的 9.5 继续未完成。

## iOS 原生

Xcode 27.0 与 iOS 27.0 Simulator 可用。`xcodebuild` 在 iPhone 18 Pro Simulator 目标以 `CODE_SIGNING_ALLOWED=NO` 完成原生 Debug 构建（`BUILD SUCCEEDED`）；生成的 `Slogan.app` 已安装到启动中的模拟器，`simctl launch` 返回进程 ID，截图显示 Expo development client 首页。模拟器弹出“在 Slogan 中打开？”确认框时，Mac 处于锁定状态，尚不能确认 JS 页面运行。

本机 `security find-identity -v -p codesigning` 返回 0 个有效签名身份，`EXPO_APPLE_TEAM_ID` 未配置，`devicectl` 只列出模拟设备。Apple Team 签名真机测试和双设备音频/断网验收尚无法执行。模拟器无签名构建不能替代真机证据。

## SMTP

`EMAIL_PASSWORD_AUTH_ENABLED` 未启用，真实 `EMAIL_SMTP_*`、验证/重置链接和邮件 HMAC/AES 密钥环尚未配置，也没有受控真实收件箱证据。没有发出真实邮件；`implement-email-password-auth-backend` 的 5.4 继续未完成。配置和运行顺序见 [邮箱运行说明](../email-password-auth-runbook.md)。
