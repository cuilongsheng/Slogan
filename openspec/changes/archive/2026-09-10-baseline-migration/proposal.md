## Why

`PRD_V1.md` 同时包含已确认规则、版本路线、建议、未决事项和项目背景，无法安全地直接作为持续维护入口。本次迁移建立可审查的需求基线，使后续变更通过 OpenSpec 管理，同时保留原始 PRD 的历史可追溯性。

## What Changes

- 对 `PRD_V1.md` 内容建立逐项分类清单，区分 confirmed requirements、future roadmap、unresolved decisions 和 historical context。
- 只将已明确确认且属于 `0.0.1` 当前交付范围的行为写入候选 delta specs。
- 将建议、冲突和缺少边界的事项保留为 unresolved，不使用 MUST/SHALL 表述。
- 将 `0.0.2`、`0.0.3`、`0.1.0` 及 V2 方向保留为 roadmap，不提前成为 current requirements。
- 在用户 Review 前，不同步候选 specs、不冻结 `PRD_V1.md`、不切换 source of truth。
- 用户批准后再单独执行 sync、冻结标记和 baseline migration archive。

## Capabilities

### New Capabilities

- `identity-and-profile`: 登录、首次资料、年龄边界与访问前置条件。
- `localization-and-room-rules`: 中英文选择及入房前行为规则确认。
- `instant-room-discovery`: 即时房间的创建、发现、容量和加入资格。
- `voice-session`: LiveKit 语音会话、默认静音、重连和结束行为。
- `host-controls`: 房主移除、邀请、主动移交及断线超时移交。
- `basic-safety-reporting`: 基础举报、审计事件和服务端安全边界。

### Modified Capabilities

<!-- 当前 main specs 为空，本次迁移不修改既有 capability。 -->

## Impact

- 需求治理：建立第一批候选 OpenSpec requirements，但 Review 前不写入 `openspec/specs/`。
- 文档治理：定义 PRD 冻结、权威来源切换和历史追溯规则。
- 交付流程：建立项目级六阶段 lifecycle、OpenAPI/Figma/verification 的权责边界。
- Agent 工作方式：初始化官方 OpenSpec Codex Skills，并增加唯一的项目 Skill `voice-room-figma-to-frontend`。
- 业务代码、数据库、API 和 UI：本次不修改。
