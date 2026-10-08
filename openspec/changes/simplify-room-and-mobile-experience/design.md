## Context

动机及批准前的范围见 proposal。当前读到的源码基线为 develop `716cc0bd`，已有 APK 发布记录为独立未提交文档，不纳入本次提交范围。

### 已确认原因与合同审计

|反馈|当前证据|结论/处理|
|后台历史与折叠|RoomsPage.tsx 默认不带状态过滤；details 控制卡片详情；直接显示 room.id/room.kind|当前合同支持单一 status，但缺少 OPEN+SCHEDULED 合并分页边界；需服务器查询扩展，不能分页后本地过滤|
|我的没有退出|MeScreen.tsx 有五个入口，无 logout 调用；auth/context.tsx 已有真实 logout|合同可复用，接入真实退出并删去多余页面入口|
|键盘遮挡|RoomPage SafeAreaView overflow hidden，固定底部 footer；创建页面只有 ScrollView|不能只加 keyboardShouldPersistTaps；需要页面尺寸调整、焦点滚动及底部操作避让|
|等级是单级|Prisma CefrLevel 有三组组合枚举，但 rooms/domain/entities/room.ts 的 ROOM_CEFR_LEVELS 只有六个单级，DTO 与生成合同跟随该常量|PARTIAL；新增上下限字段及兼容映射，不能仅把 B1 字符串换成 B1–B2|
|消息入口错误|VoiceRoomScreen composerInput 是 TouchableOpacity，打开 initialMode=text 的 ExpressionAssistSheet；LiveKit token canPublishData=false|MISSING 普通房间文字消息能力，需独立真实合同和传输|
|录音繁琐|ExpressionAssistSheet loading-consent/start/recording/confirm/loading/result 等多阶段；usePrivateRecorder 30 秒自动停止；只传入 muteRoomMicrophone|已有 AI/STT 合同可复用；缺少按住自动提交和明确的解除静音编排|
|退出像重新加入|VoiceRoomSession.exit 先 await mute/disconnect，再 await leave；失败写 phase=failed；SessionState 把 leaving 显示成 connecting|需独立退出状态，先关闭本地音频，禁止离房时重连或重新入房|
|退出等待 LiveKit|HostControlsController.run await host.execute 后 await dispatchPending；失败对已提交结果抛 503|数据库已完成也被误报失败；将 leave 请求与 provider dispatch 解耦|

### Figma 证据与确认清单

全部读取/写入通过 Desktop Bridge 插件，文件 `56nIowZmvBhb0QJvOlDQdU / Slogan`，页 `102:2766 / 02 UI`。已检查原始文本和插件导出截图；未修改用户原始页面。

|用途|Frame|尺寸|状态/差异|
|即时创建|111:979|390×844|新版主题卡片、等级范围、直接内容；上下限直接选择补充状态 153:1485 已建立，原稿保留|
|预约创建|121:3613|390×844|日期时间及相同房间配置；原始完整 Frame 截图已归档|
|语音房|115:1425|390×844|底部普通输入+发送，私人翻译入口独立，消息区滚动；不得实现示例发言文字为实时转写|
|按住翻译|115:1627|390×844|按住开始说、松开生成英文，最长10秒|
|英文结果|115:1720|390×844|仅主要英文结果，无语气及多选表达堆叠|
|房主移交退出|111:906|390×844|只有房主需要接任选择器|
|后台房间|114:1602|1440×900|旧设计仍有已结束卡片和折叠，与本次明确反馈冲突；补充状态 153:1524 完整卡片已建立，保留旧图|
|我的|152:1467|390×844|用户明确授权本次补画；现有 Noto Sans SC、背景变量和三个 Button 实例，自动布局，无新增无关业务入口；最终截图检查通过|

个人页导航采用返回入口；若新手机导航结构改变，须按具体原始 Frame 调整。全部手机 UI 更新先列出具体 Frame/路由集合，避免把“都调整了”等同于猜测未读取的设计。后续出现缺少状态时只补目标状态，不重画用户已调整的页面。

## Goals / Non-Goals

**Goals:** 完成用户实际可见行为并保持服务器成员、权限、会话事实；短语音只在私有链路处理；生产退出响应不依赖 LiveKit 可用性。

**Non-Goals:** 改写个人 CEFR、强制按房间等级拒绝入房、自动播放英文、房间音频转写、删除业务历史、为每次操作增加用户确认、iOS。

## Decisions

### 1. 采用现有 NestJS code-first 合同流程

修改拥有接口的 DTO/controller/domain 后通过现有 openapi:generate 更新唯一 openapi/openapi.yaml，并生成 packages/api-client。维护第二份手写前端类型会造成再次错接接口，因此不采用。

房间增加兼容的等级上下限字段；单级请求按 min=max 解释，既有组合 enum 可解码为范围。服务端验证 CEFR 顺序和矛盾的混合输入。个人资料 CefrLevel 不改。公开发现新增范围查询时按区间相交，旧精确单级筛选仍保持原语义；游标绑定实际筛选条件。持久化可采用两个新增可空字段及旧数据回填，不删除原 cefrLevel；兼容旧输出的代表值不作为新版范围展示来源。

后台 room 查询增加只取当前运营集合的显式查询边界，与 status/q/visibility/from 及游标绑定；客户端默认请求此集合，只提供全部当前、进行中、预约三个状态入口。预约信息不得通过拼接两页结果来伪造全局分页。类型翻译为即时/预约，UUID 可用于技术检索及审计，不出现在主卡片信息；没有真实可读编号合同就不虚构 R-2409。

### 2. 普通消息采用服务端鉴权的房间消息接口

拟增加发送 POST 与基于游标增量读取 GET /v1/rooms/{roomId}/messages，使用当前成员和账号资格检查、clientRequestId 幂等、服务器时间/序号、可见发送者昵称；客户端周期增量读取并在离房时取消。消息纯文本、不支持 HTML、限制长度和请求速率；默认长度上限1000 Unicode码点，与现有文字边界一致，属于实现默认值供审核。

复用 PostgreSQL 事实与现有 domain/repository 边界，新增最小 RoomTextMessage 模型和索引。只提供当前房间消息读取，房间关闭后拒绝读写；正文结束清理及兜底定期清理一并实现，不承诺聊天历史。具体短期保留配置在迁移/验收记录中明确，禁止正文进入日志。

不直接把 LiveKit canPublishData 改为 true：客户端直发难以在服务器验证消息权限/幂等/限流，旧 token 在撤销延迟期间也会发送。也不新增 Vercel 长连接 WebSocket 服务；现有 serverless API 下受控增量读取更容易可靠部署。消息延迟和请求成本通过仅活跃房间轮询、后台暂停及短增量响应控制。若审核要求长期历史或低延迟强实时传输，需要独立调整方案。

### 3. 按住录音是一次私有事务

入口仅进入已有 Figma 录音弹层；有效权限和用途同意后 onPressIn：确认房间静音→开始私人录音。onPressOut：停止录音→恢复可用房间麦克风→自动上传并显示生成中/主要英文结果。复用 consent/audio API，不修改主要英文结果合同；首次有效同意仍处理，当前用途提示保持可见，当次用户主动按住手势形成 noticeConfirmed，不再录后重复确认。

用录音代次及请求 UUID 防止快速按下/松开、异步 start 尚未结束、自动10秒截止和松开同时发生而重复上传。以 recorder.stop 返回的 clip 为提交事实，不等待 React clip state 更新。取消/离房/切后台处理资源释放；释放成功前不能重新发布房间麦克风。翻译等待不延长房间静音。恢复失败给出简洁反馈，不虚报已开麦；账号或房间权限失效不恢复。真实 Android 验证 Expo recorder 与 LiveKit AudioSession 的设备音频竞争，不能用单元测试代替。

### 4. 退出先完成业务，provider 在后台收敛

保留 HostControlsService 的事务、成员代次、并发锁、权限移交、endLocked 与 REVOKE_IDENTITY/DELETE_ROOM 持久命令。leave controller 在事务提交后返回业务结果及 PENDING 清理状态，不内联 dispatchPending，也不因 provider 不可用返回503。其他 remove/end/invite 行为不顺带改动。

普通成员无弹层直接退出；房主存在其他在线成员必须选择，房主独自一人不选择。服务端拒绝非法/已失效接任者，失败只留在简洁移交界面，不把成员送回加入流程。独立 leaving/leave-unconfirmed 状态处理网络失败；本地媒体立即静音、停止监听并断开，不等待 provider。不是在本地无依据伪造数据库退出；业务接口响应丢失以原 expectedCredentialVersion 幂等重试/确认。

网络不可用时本地音频可停止，但必须区分服务端退出未确认。恢复职责由后端承担，UI 不显示“重新加入”；下一次加入不能沿用待退出凭证。不得将 async void 或 Vercel 响应后的进程继续存活视为持久任务交付。已有 runner 的实际运行平台与恢复触发必须验证；若未部署可靠 worker/scheduler，发布 C 前补齐目标环境的可靠触发、命令扫描与重试证据。

### 4.1 Vercel 托管队列适配

按用户对 Vercel worker 的追问，现有 Vercel API 采用 Queues 独立私有消费者承接短任务；公开 Nest API 和消费函数分开构建。数据库仍拥有持久命令和恢复事实，不能只依赖响应后的进程存活。托管模式不启动进程内 Worker/定时器，消费者扫描后发布下一次扫描；异常由队列重试。其他环境保留 BullMQ 方案。

播种在公开 API 的请求上下文内执行，由平台 `waitUntil` 追踪队列发布，HTTP 不等待供应商清理。并发请求共用在途播种，成功后冷却五分钟；失败不缓存，下一请求重试，后续请求可重新启动中断的扫描链。启动阶段不发送恢复消息，避免依赖尚不存在的请求 OIDC 上下文。私有消费者和 PostgreSQL 持久事实保持不变。

beta、保留期、初次播种/扫描断链、重复投递、发布顺序及回滚边界见 `docs/deployment/room-experience-vercel-queues.md`。本地构建与失败测试已完成，云端调度证据仍是发布门槛；不要求用户另购常驻服务器，也不声称持续媒体订阅 worker 能直接迁入短任务队列。

### 5. 精简入口与键盘行为

MeScreen 接现有 useAuth().logout；保持撤销失败的诚实结果但本地会话清理完整。移除个人页多余入口，不删除其他功能合同或后端。键盘避让在共有页面壳处理布局尺寸，表单焦点滚动在各屏处理，语音房消息输入单独避免底部 composer 遮挡；检查 Android adjustResize 与 SafeArea/固定 footer 的叠加，不全局盲加 padding。

## Risks / Trade-offs

- [新消息缺少现有合同] → 必须先实现服务端权限、幂等、生成合同，再接消息 UI；不放假消息证明成功。
- [等级旧客户端/迁移漂移] → 增量迁移、回填、旧请求合同测试，禁止直接替换用户等级枚举。
- [房主无接任者字段的旧 APK] → 新行为属于兼容性变化；同步发布新版手机端并给稳定错误，记录版本门槛。
- [异步撤销期间旧 LiveKit 音频凭证] → 业务成员立即失效，短期凭证与既有身份撤销保持；故障恢复验证 provider 最终踢出，不能承诺零延迟撤销。
- [按住录音泄露或卡死静音] → start/stop 顺序与取消竞态测试、双设备听音及真机音频恢复；录音私有且不持久化。
- [精简 UI 隐藏必要用途控制] → 首次同意保留最小提示，已有撤回渠道维持实际可访问但不重新塞回“我的”的三项列表；由已有关联功能/账号控制入口承担，发布前验证路径。
- [无限滚动消息或轮询资源泄露] → 有界分页/内存窗口、取消订阅、退房与后台停止轮询、速率限制。

## Migration Plan

1. 审核本次 proposal/specs/design/tasks 与新增“我的”设计；补齐明确的视觉差异节点清单后逐批 apply。
2. A：先本地迁移与兼容合同，再后台及手机基础页面；相关测试/截图通过。C 可以在 A 后先于 B 交付。
3. B：消息模型/接口/清理→客户端真实双成员消息；按住翻译使用已有 provider 配置，真实 STT/AI 可用性单独确认，不擅自改密钥/供应商。
4. C：验证持续后台命令处理和失效旧凭证，再发布快速退出。先在隔离环境注入 LiveKit 超时并确认 API 成功、数据库失效、最终清理。
5. 完成全受影响范围 lint/typecheck/test/build、OpenAPI check、Playwright 管理流程、Android 真机键盘/消息/按住录音/退出对照。重新生成独立 APK 并记录 SHA、签名、API、版本和明确未验收项；本次不发布 iOS。
6. 回滚保留新增数据列；消息能力停用回滚前端入口；不得回退已提交成员 LEFT/房间关闭或删除未清理命令。等待命令排空后才回滚处理器，避免丢失撤销/删除任务。
