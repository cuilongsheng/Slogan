## Context

见 proposal.md。现有 RoomListScreen 卡片导航详情，再经过 rules/device，VoiceRoomSession 才调用 membership 和 credentials。LiveKit 入房默认关闭麦克风，因此提前录音检查不是连接必需条件。

Figma Desktop Bridge 已实时探测成功，文件 Slogan / 56nIowZmvBhb0QJvOlDQdU，02 UI，列表 115:1197，语音房 115:1425，390×844。保留原稿卡片与语音房视觉；取消中间页面是用户明确授权的流程差异，不修改原稿。已有房间卡片视觉差异不纳入本次全局 1:1 PASS 声明。

## Goals / Non-Goals

目标：普通房卡一次点击进入、密码完成即加入、失败可恢复。非目标：预约语义、密码校验、用户资格、供应商、数据库、Google 和 iOS。

## Decisions

- 在现有 JoinProvider 增加直接入房意图，使用唯一生成 API；不新增服务端端点，不在列表另建连接实例。现有 rulesAccepted=true 表示入房操作兼容，不伪称阅读行为。
- 列表同步建立草稿并导航 session；密码房只导航必要的密码页，输入提交后导航 session。详情的加入操作同样直接进入。
- SessionState 失败界面增加返回列表入口；缺少密码返回密码输入；处理授权缺失使用现有 RoomConsentPanel，成功后重试，不自动提交授权。仍由后台决定加入是否允许。
- 默认静音连接无需预录音；保持实际开麦的权限请求和错误处理。
- 与待上线的后台恢复补丁保存在干净的现有交付 worktree，提交分离；一个 PR 可同时审核并触发既有流水线。

## Risks / Trade-offs

- [取消每次规则勾选改变现有规范] → 用户明确授权，更新对应 delta，房内入口保留。
- [加入时服务器状态改变] → 不信任卡片快照，现有服务端校验和错误结果保留。
- [双击或草稿错房] → 导航锁、房间标识和会话级在途去重；测试真实组件交互。
- [隐私处理需要明确同意] → 只为缺少的用途显示既有授权组件，不沿用 rulesAccepted 替代用途授权。

## Migration Plan

无 schema 或 OpenAPI 变更。PR 预览、main 生产和 APK 使用既有自动交付；合并后验证实际提交和固定下载。回滚只回退手机导航代码，不撤销业务成员状态。静态检查、完整 mobile suite、Pages 构建、浏览器组件流程分别记证据；系统权限和真机由用户验证，不能以 Web 代替 Android。
