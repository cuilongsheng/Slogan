# implement-mobile-voice-room-session 验收记录

## 设计依据

2026-09-26 通过 Figma Desktop Bridge `Slogan` 文件 `56nIowZmvBhb0QJvOlDQdU` 的 `02 UI` 页面直接导出当前原稿，均为 390×844：

- 语音房 V2 `115:1425`：[原稿](assets/implement-mobile-voice-room-session-voice-room-v2.png)。成员区域 y416/高218；底部操作区 y763/高81。
- 重连 `114:2511`：[原稿](assets/implement-mobile-voice-room-session-reconnecting-v1.png)。重连面板 x16/y251/358×345。
- 结束 `114:2512`：[原稿](assets/implement-mobile-voice-room-session-ended-v1.png)。房间摘要 x16/y462/358×140。
- 房主结束确认 `114:2514`：[原稿](assets/implement-mobile-voice-room-session-end-confirm-v1.png)。确认面板 y435。

## API 合同

唯一合同为 `openapi/openapi.yaml` 的生成类型。`POST /v1/rooms/{roomId}/memberships` 接收 `rulesAccepted` 与可选四位 `password`，返回 `currentMembership`、房间状态字段；错误包括 `ROOM_PASSWORD_REQUIRED/INVALID`、`ROOM_RULES_NOT_ACCEPTED`、`ROOM_FULL`、`ROOM_ENDED`、账号与安全限制。`POST /v1/rooms/{roomId}/realtime-credentials` 返回短期 `serverUrl`、`participantToken`、`participantIdentity`、`credentialVersion` 和角色。`GET /v1/rooms/{roomId}/members` 返回成员昵称、CEFR、顺序、角色、presence、participantIdentity，无照片头像。`POST /v1/rooms/{roomId}/leave` 需要 `expectedCredentialVersion`，结果包含业务 lifecycle 与 providerStatus；`POST /v1/rooms/{roomId}/end` 为房主结束接口。

## 验证状态

- 已按当前设计帧实现语音房主体、重连/失败、退出确认、房主结束确认与结束页。390×844 Web 最终运行截图：[语音房](assets/implement-mobile-voice-room-session-runtime-web-active.png)、[双用户](assets/implement-mobile-voice-room-session-runtime-web-two-users.png)、[结束页](assets/implement-mobile-voice-room-session-runtime-web-ended.png)。房间规则、发言卡、成员区及底部操作区的主坐标与原稿对齐；结束页的成功标记、摘要与返回按钮也按原稿重新定位。截图显示真实 API 数据；测试房间的英文主题、人数和占位头像因此不同于 Figma 的示例数据。
- 浏览器实测使用两名独立、已完成资料的本地测试账号与真实本地 API、LiveKit Cloud 会话。房主首次连接默认静音，刷新后恢复原有 membership；访客从详情页经过主动规则确认、模拟麦克风检查入房；双方看到成员变化。访客主动打开/关闭麦克风后，房主侧实时状态跟随变化；访客退出后成员被移除；房主确认结束后进入结束页。该轮浏览器脚本错误和 API 失败响应均为 `0`。测试账号及其 `9` 个临时房间已删除，辅助脚本和凭据文件已清理。
- 本地 `apps/api/.env` 的 `REALTIME_ENABLED` 已设为 `true`。联调中曾在开关为 `false` 时得到预期的 `503`；启用后另有一次刷新取凭证的暂时性 `503`，重试可恢复。页面为此保留重试和明确退出路径。后端对“操作已提交但 provider 清理不可用”的 `503` 会在 `details` 返回结果；前端只在 room ID、状态和版本形状匹配时承认已提交的离开/结束结果。
- Web 的麦克风使用 Chromium 模拟设备。以上证明了两客户端的信令、成员状态和音轨发布开关，不证明两台真实设备间的听感、原生音频会话、物理断网恢复或推送到 Cloud 的 Webhook 公网可达。原生 Expo Go 无法承载 LiveKit WebRTC；仍需在 iOS/Android 开发构建与两台真实设备上做音频和断线验收。[LiveKit Expo 官方说明](https://docs.livekit.io/home/quickstarts/expo)。
- 合同没有成员头像字段，因此成员位用姓名首字占位；表达辅助与聊天发送属于后续功能，页面明确呈现不可用状态。房间结束后直接刷新该旧 URL 时，房间详情 API 会拒绝已结束房间，结束页保留终态提示但无法再次取得摘要；正常房内结束流程保有摘要。

## 自动检查

- `pnpm --filter @slogan/mobile lint`、`typecheck`：通过。
- 移动端 Jest：`20` 套、`63` 项通过。
- `expo export --platform all`：Web、iOS、Android JS bundle 均导出成功；Expo Android prebuild 成功，原生项目由配置生成并列出 LiveKit plugin。这不是安装或真机证据。
- 2026-10-02 Android `:app:assembleDebug` 已通过，耗时 6 分 35 秒，生成 `apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk`（290 MB；SHA-256 `c409e0fc3841520121fbf106ebb23b7ce12c57068cdd50670b5c62bc51b59f87`）。本机 `local.properties` 指向已授权的 `~/Library/Android/sdk`，构建进程通过本机 HTTP 代理访问官方 Google Maven，完成 LiveKit / React Native 原生依赖编译。`adb devices` 仍无设备；原生安装、双机音频、断线及 iOS 构建未验证。
- `openspec validate implement-mobile-voice-room-session --strict` 与目标文件 Prettier 检查：通过。
