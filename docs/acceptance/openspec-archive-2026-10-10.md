# 已完成 change 批量归档记录

2026-10-10。用户授权直接归档已完成的 change，同时保持应用测试、部署和 APK 更新暂停。本次在 `codex/in-app-partner-invitations` 集成工作树处理 OpenSpec 文档；没有修改业务代码、执行应用测试、提交、推送或部署。

## 已归档

以下 10 个 change 的 planning artifacts 均为 `done` 或声明的 `skipped`，任务全部勾选。结合已有实现和验收记录确认本批的交付边界，没有将记录设备/provider 限制的任务升级为真实环境验收通过。归档是原有交付范围的收尾，不表示后续需求或当前返修已完成。

| Change                                | 已完成任务 | 归档路径                                                                                    | 验收记录                                                 |
| ------------------------------------- | ---------- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| implement-mobile-app-foundation       | 5/5        | [archive](../../openspec/changes/archive/2026-10-10-implement-mobile-app-foundation/)       | [工程基础](implement-mobile-app-foundation.md)           |
| implement-admin-workspace             | 14/14      | [archive](../../openspec/changes/archive/2026-10-10-implement-admin-workspace/)             | [后台工作台](implement-admin-workspace.md)               |
| add-admin-room-filters                | 5/5        | [archive](../../openspec/changes/archive/2026-10-10-add-admin-room-filters/)                | [后台筛选](add-admin-room-filters.md)                    |
| implement-mobile-email-password-auth  | 8/8        | [archive](../../openspec/changes/archive/2026-10-10-implement-mobile-email-password-auth/)  | [密码认证前端](implement-mobile-email-password-auth.md)  |
| implement-mobile-room-history-notes   | 4/4        | [archive](../../openspec/changes/archive/2026-10-10-implement-mobile-room-history-notes/)   | [历史与私人笔记](implement-mobile-room-history-notes.md) |
| implement-mobile-post-room-learning   | 4/4        | [archive](../../openspec/changes/archive/2026-10-10-implement-mobile-post-room-learning/)   | [会后学习与词汇](implement-mobile-post-room-learning.md) |
| implement-mobile-safety-appeals       | 4/4        | [archive](../../openspec/changes/archive/2026-10-10-implement-mobile-safety-appeals/)       | [限制与申诉](implement-mobile-safety-appeals.md)         |
| implement-mobile-social               | 4/4        | [archive](../../openspec/changes/archive/2026-10-10-implement-mobile-social/)               | [既有社交基础](implement-mobile-social.md)               |
| implement-pages-same-origin-api-proxy | 6/6        | [archive](../../openspec/changes/archive/2026-10-10-implement-pages-same-origin-api-proxy/) | [同源代理](pages-same-origin-api-proxy.md)               |
| automate-android-release-delivery     | 8/8        | [archive](../../openspec/changes/archive/2026-10-10-automate-android-release-delivery/)     | [自动交付](automate-android-release-delivery/README.md)  |

## 主 spec 同步与完整性

- `implement-mobile-app-foundation` 声明跳过 delta spec，保持原样归档。
- 其余 9 个 change 同步 9 个新 capability、24 条新增 requirement；`friend-relationships` 修改 1 条 requirement，补入本人请求列表的公开昵称场景，保留该条原有三个状态转换场景与其他四条 requirement。
- 代理 delta 的 Render-only 文案已与既有 `scripts/pages-api-proxy.mjs` 和 [2026-10-07 发布修正](../releases/2026-10-07-vercel-pages.md) 对齐：保留单层 Render origin，补入已批准的固定 `slogan-api-pi.vercel.app`；没有放行任意 Vercel 项目或改变运行时配置。
- 主 spec 的 Purpose 已补齐说明，没有保留 delta 操作标题或 TBD 占位。文档严格校验最初发现四处 Purpose 太短，补齐后 `openspec validate --specs --strict --no-interactive` 为 **31 passed / 0 failed**。这是文档结构检查，不是本次应用测试。
- 移动前逐项复核所有 delta requirement 已同步；移动后逐文件 SHA-256 与移动前清单相同，包含 `.openspec.yaml`。归档路径没有碰撞。10 项归档后仍有 23 个 active change。

## 保留 active 的 change

以下四项虽然任务全勾选，但尚不适合归档；本次没有改动其任务状态：

| Change                                    | 保留原因                                                                                                                |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| implement-mobile-room-discovery-join      | 用户要求的最新列表布局、直接入房和设备提示仍在返修/验收队列；当前布局没有完成最终验收。                                 |
| implement-mobile-voice-room-session       | 语音房与重连页仍在返修；[重连记录](reconnecting-layout/README.md) 明确代码已改但未验证，不宣称 1:1 PASS。               |
| implement-mobile-room-safety-alerts       | [原验收记录](implement-mobile-room-safety-alerts.md) 明确真实 LiveKit/STT、设备验收缺失且暂不归档。                     |
| implement-mobile-room-processing-consents | [原验收记录](implement-mobile-room-processing-consents.md) 仍要求产品与隐私文案确认；当前建房 UI 也有待统一验证的调整。 |

另有 19 个 change 含未完成任务，继续保留。包括一对一消息/通话的新需求、直接入房收尾、房间与手机体验返修、真实 SMTP/短信/OAuth、LiveKit/STT、数据治理与产品验收等。没有通过清空任务、伪造验收或批量强制归档消除缺口。

## 交付边界

- 密码认证前端归档保留邮件送达、原生会话和外部 OAuth 的历史验收限制；生产 Google 仍关闭，邮件停用/体验账号由其 active change 管理。
- 社交基础归档不代表独立“找伙伴”页面或一对一聊天完成。最新在线空闲邀请与全局心跳调整的证据在 [邀请记录](in-app-partner-invitations/README.md)，一对一能力仍在 `add-partner-discovery-direct-conversations`。
- 自动 APK 交付归档只确认已经完成的构建和发布流水线，保留独立业务清理、真实翻译与设备验收限制；没有为当前本地改动构建或发布新 APK。
- 部署与归档独立；本次没有更新线上前后端、数据库、Redis、环境变量或外部 provider。
