## Context

当前移动端已交付带资格 gate 的列表、详情、密码、规则和设备检查页；设备页尚不提交 membership。`openapi/openapi.yaml` 已定义加入、短期实时凭证、成员列表、离开和结束接口。Figma Desktop Bridge 的语音房 V2 `115:1425`、重连 `114:2511`、结束 `114:2512` 是视觉依据。后端 LiveKit 配置在本地环境存在，但尚无本批双设备音频证据。

## Goals / Non-Goals

**Goals:**

- 客户端只用当前 OpenAPI 生成类型调用现有服务，能从已确认的入房准备建立、恢复和终止真实会话。
- Web 和 iOS/Android 共用业务状态与界面，实时媒体用各平台适配器；入房默认静音。
- 以真实成员与连接事件驱动席位、房主、麦克风、说话和重连显示。

**Non-Goals:**

- 不在移动端实现房间创建、邀请、踢人、移交选择、续时、翻译、AI 辅助、聊天或语音处理；对应 V2 控件不得冒充可用功能。
- 不新增或重写后端房间模型、数据库迁移或第二份 API 合同。

## Decisions

1. **API 先提交 membership，再取得实时凭证，再连接媒体。** 复用现有 NestJS 代码生成的唯一 OpenAPI 合同。只有用户按“进入语音房”才产生 membership；刷新时先读详情的 `currentMembership`，若已有效则直接取新凭证。相对在设备检查时预先占位，这能避免用户还未入房就占用容量。
2. **平台隔离媒体实现。** Web 采用 `livekit-client`；原生端采用 LiveKit React Native SDK、WebRTC 原生依赖与 Expo config plugin，构建 development build。`media.web.ts` 与原生默认入口 `media.ts` 分开加载，防止原生模块污染 Web bundle。LiveKit 官方 Expo quickstart 明确要求 development build，Expo Go 不可运行原生 SDK。
3. **凭证和密码只存短期内存。** 组件与房间会话状态持有凭证；离开、结束或登出立即释放。UI 和错误日志只用稳定错误码，不打印凭证、密码、完整 provider 错误对象。会话刷新重新向服务端取短期凭证。
4. **成员业务事实与媒体信号分源合并。** `GET members` 提供昵称、CEFR、顺序、房主和 membership 生命周期；LiveKit participant identity / track 事件提供在线与说话状态。连接、成员变动和重新进入前重拉 API；定期低频刷新防止漏事件。原稿中的照片头像在 API 未提供时显示昵称首字母。
5. **失败后的占位由明确操作收敛。** 加入成功而取凭证或连接失败时保留重试和“退出房间”；退出调用 `POST leave` 的 `expectedCredentialVersion`，即使 provider 状态为 `PENDING`/`UNAVAILABLE`，只要业务已提交 LEFT/ENDED 就断开本地连接。退出请求本身失败时显示未确认状态并允许重试，不能假称已释放席位。
6. **页面恢复与终态。** 房间路由重建时从服务端重读，若仍 ACTIVE 则取新凭证；服务端返回 ended/removed/restricted 时断开媒体并转结束或错误页。SDK 自动重连时显示 Figma 重连态和退出入口，不能在凭证撤销后无限重连。

## Risks / Trade-offs

- [Expo 与 LiveKit 原生版本兼容] → 固定兼容版本、验证 iOS/Android 原生配置和构建；Web 测试通过不能替代 development build。
- [用户加入成功但 provider 不可用，席位仍被占用] → 显示服务端 ACTIVE 事实与重试/退出；明确调用 leave 并记录未确认退出状态，避免静默遗留。
- [网络重连与服务端移除、房主移交同时发生] → 每次重连重读成员及详情，以服务端状态优先；本地旧说话/角色状态不作为授权依据。
- [Figma 头像和某些房内入口没有合同] → 只展示合同提供的信息，并在验收报告中标明缺口；禁用未交付入口。
- [Cloud 设备与双人音频缺证据] → 将本地构建/模拟连接和两台真实设备的听说验收分开记录，未执行者标 `BLOCKED`。

## Migration Plan

1. 将原设备页完成后按钮接到新路由，保留现有资格 gate；旧浏览器刷新从服务端 membership 恢复，不依赖迁移本地草稿。
2. 安装并固定 Web/原生 SDK 及 Expo plugins，完成 Web/iOS/Android 构建验证；无需数据库迁移、无需修改 OpenAPI。
3. 若上线后原生连接出现阻断，可回退移动端版本到入房前页面；已创建的 membership 仍由后端现有 leave/到期流程收敛，不回滚数据库或服务端房间状态。回退前确认在线用户退出与 provider 断开。
4. 验收时用两名真实合格账号和两个设备检查静音、双向音频、断线、退出及房主结束；在此之前只标记本地实现与构建完成。
