# PRD V1 Baseline Migration Inventory

## Status

- Migration status: `DRAFT_FOR_USER_REVIEW`
- Input baseline: `PRD_V1.md`（当前仍未冻结）
- Candidate output: `openspec/changes/baseline-migration/specs/`
- Current requirements source of truth: **尚未切换**

本清单只做分类和追溯。用户明确批准之前，不得同步候选 specs，不得冻结原 PRD，也不得把候选内容描述为已经生效的 current requirements。

## Classification Rules

| Classification | 判断标准 | 是否允许进入候选 specs | 是否允许使用 MUST/SHALL |
| --- | --- | --- | --- |
| Confirmed requirement | 用户已明确决定，且属于当前 `0.0.1` 交付边界 | 是 | 是 |
| Future roadmap | 已规划但不属于 `0.0.1`，或属于 V2 以后方向 | 否 | 否 |
| Unresolved decision | 存在建议、冲突、缺少边界或仍需选择 | 否 | 否 |
| Historical context | 愿景、目标、研究、传播、指标或讨论背景 | 否 | 否 |

## Confirmed Requirements Migrated as Candidate Specs

| ID | Requirement summary | PRD source | Candidate capability |
| --- | --- | --- | --- |
| C-001 | 支持微信和 Google 第三方登录，首次认证创建账号 | 8 / P0 账号；16.1–16.2 | `identity-and-profile` |
| C-002 | 首次登录必须完成头像、名称、性别、国籍/城市、兴趣、CEFR、出生年月 | 8 / P0 账号；16.2 | `identity-and-profile` |
| C-003 | 资料未完成前不能进入房间业务 | 6.1；8 / P0 账号 | `identity-and-profile` |
| C-004 | 未满 18 岁不能创建、加入或接受房间邀请 | 8 / P0 账号；15.2；16.2 | `identity-and-profile` |
| C-005 | 中文设备默认中文，其他设备语言默认英文；首版只提供中英文 | 8 / P0 账号；16.2 | `localization-and-room-rules` |
| C-006 | 入房前展示敏感话题和行为规则，用户确认后才能继续 | 8 / P0 语音房；16.2 | `localization-and-room-rules` |
| C-007 | 入房后仍可重新查看规则，双语含义一致 | 8 / P0 语音房；16.2 | `localization-and-room-rules` |
| C-008 | 合格用户可以创建 2–6 人即时房，必须设置 CEFR 和主题 | 5.1；15.1；16.2 | `instant-room-discovery` |
| C-009 | 即时房创建后立即开放，默认时长 2 小时 | 5.1；15.10；16.2 | `instant-room-discovery` |
| C-010 | 支持公开房和 4 位数字密码房 | 8 / P0 房间；15.2；16.2 | `instant-room-discovery` |
| C-011 | 提供房间列表和详情，并展示当前版本加入判断需要的信息 | 8 / P0 房间；16.2 | `instant-room-discovery` |
| C-012 | 并发加入不得突破房间人数上限 | 15.11；16.2；16.4 | `instant-room-discovery` |
| C-013 | 至少两名成员能够发布和订阅实时麦克风音频 | 12；16.1–16.4 | `voice-session` |
| C-014 | 用户加入房间时默认静音，由用户主动切换 | 7；8 / P0 语音房；15.2；16.2 | `voice-session` |
| C-015 | 房间展示成员昵称、CEFR、麦克风状态和房主身份 | 8 / P0 语音房 | `voice-session` |
| C-016 | 网络异常提供重连、退出和错误反馈 | 8 / P0 语音房 | `voice-session` |
| C-017 | 房间结束后通知成员并拒绝普通加入或旧凭证重入 | 6.4；7；16.2 | `voice-session` |
| C-018 | `0.0.1` 不启用房间音频 STT，不录音、不保存完整转写、不公开回放 | 8 / P0 语音房；16.2 | `voice-session` |
| C-019 | 房主可查看并移除成员，被移除者不能主动重入 | 8 / P0 房主管理；15.11；16.2 | `host-controls` |
| C-020 | 只有房主重新邀请且所有资格检查通过，被移除成员才能重入 | 7；15.11；16.2 | `host-controls` |
| C-021 | 房主主动退出时可指定接任者，未指定则当前第二麦接任，无接任者则关闭 | 5.1；15.9；16.2 | `host-controls` |
| C-022 | 麦位按成功加入顺序展示，成员离开后依原顺序前移 | 15.9；16.2 | `host-controls` |
| C-023 | 房主断网保留 60 秒重连窗口，超时后移交或关闭 | 5.1；15.9；16.2 | `host-controls` |
| C-024 | 当前版本支持提交基础举报记录 | 8 / P0 安全；16.2 | `basic-safety-reporting` |
| C-025 | 举报、移除、邀请、移交、断线和结束必须留下审计事件 | 15.9；16.2；16.4 | `basic-safety-reporting` |
| C-026 | 房间和角色权限必须在服务端执行，不能只靠客户端 UI | 12；16.2 | `basic-safety-reporting` |
| C-027 | 实时语音凭证必须短期且限定到目标房间，旧凭证不能绕过移除或结束状态 | 11 / 实时语音；16.2 | `basic-safety-reporting` |

## Future Roadmap — Not Migrated to Current Specs

以下条目即使方向已经明确，也不属于 `0.0.1` current requirements；后续应分别建立 OpenSpec change，而不是在本次迁移中写成 MUST。

| ID | Roadmap item | PRD source | Intended batch |
| --- | --- | --- | --- |
| F-001 | 预约创建、开始/结束时间、取消、提醒和爽约限制 | 5.4；8 / P0 预约；16.3 | `0.0.2` |
| F-002 | 房间结束前 10 分钟提醒和房间延长 | 7；15.10；16.3 | `0.0.2` |
| F-003 | 房间与预约历史 | 16.3 | `0.0.2` |
| F-004 | 安全员处理页、3/12/24 小时限制、申诉和永久禁用 | 8 / 安全与后台；15.5；16.3 | `0.0.2` |
| F-005 | 用户主动记录的简单会后笔记 | 16.3 | `0.0.2` |
| F-006 | 母语文字/短语音 AI 表达辅助 | 8 / AI；15.4；16.3 | `0.0.3` |
| F-007 | 房间级临时 STT、敏感词提醒和用户同意 | 9.4；15.12；16.3 | `0.0.3` |
| F-008 | 会后自动关键词汇总和个人单词本 | 8 / 会后沉淀；15.6；16.3 | `0.0.3` |
| F-009 | 好友、空闲人员、双方同意和好友邀请列表 | 8 / P1 邀请；15.16；16.3 | `0.0.3` |
| F-010 | 自主注册、国际手机号验证码和 OAuth 账号合并 | 8 / P0 账号；16.3 | `0.0.3` |
| F-011 | STT 供应商适配、额度、删除和跨境处理说明 | 9.4；11；16.3 | `0.0.3` |
| F-012 | 完整管理员/安全员看板、指标、异常告警和清理策略 | 8 / P1 后台；16.3 | `0.1.0` |
| F-013 | 固定小组、社区主持人、语言交换、1v1、付费和职业化功能 | 2.2；14 / Phase 3；`PLAN_V2.md` | V2+ |

## Historical Context — Preserved, Not Converted to Requirements

| ID | Context | PRD source | Preservation |
| --- | --- | --- | --- |
| H-001 | 做产品、练英文、认识海外工程师和求职的项目愿景 | 文档状态；1；10 | 保留在 `PRD_V1.md` |
| H-002 | 用户问题、产品原则和聊天系统定义 | 1–4 | 作为理解背景，不直接生成规范词 |
| H-003 | 海外社区验证、英文介绍和求职传播方式 | 13；`dev.md` | 保留为产品研究与分发背景 |
| H-004 | 激活、体验、留存、分发和安全指标 | 10 | 作为后续 analytics change 输入 |
| H-005 | 早期 Phase 0–3 计划叙述 | 14 | 由版本 roadmap 取代其执行含义 |
| H-006 | 明确排除的视频、直播、泛社交、课程市场等 V1 非目标 | 2.2 | 保留为范围背景；需要长期约束时另建 change |

## Conflicts and Conservative Handling

- PRD 的完整 V1 验收标准包含预约、STT、AI 和会后沉淀，但 `16.1–16.4` 明确 `0.0.1` 是首个技术验证版本；本次候选 specs 采用更窄的 `0.0.1` 边界。
- PRD 多处将未来能力写为 P0 或 MUST 语气；版本排期优先决定本次迁移是否进入 current specs，未进入的内容保留为 roadmap。
- Section 17 中带“建议”的句子全部保留为 unresolved，不因建议看起来合理而写入候选 specs。
- 技术栈、Redis/Lua、LiveKit Server API 等实现约束不直接转写为产品行为；仅将外部可验证的并发容量、权限和凭证边界写入 specs，具体实现留给 Architecture/design。
