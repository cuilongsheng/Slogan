## Context

当前只有一份混合性质的 `PRD_V1.md`，`openspec/specs/` 为空。OpenSpec 已使用 Codex core profile 初始化，但还没有任何已生效的 main specs。本次工作是文档和治理迁移，不涉及业务实现。

## Goals / Non-Goals

**Goals:**

- 建立可审查、可追溯、不会提升未决事项的 baseline migration。
- 让候选 delta specs 能通过 OpenSpec 校验，并在批准后安全同步为 main specs。
- 明确 Review 前后的 source-of-truth 状态切换。

**Non-Goals:**

- 不修改业务代码、数据库、API 或 Figma。
- 不在本次迁移中实现 `0.0.2+` roadmap。
- 不替用户回答未决产品问题。
- 不在用户批准前冻结 PRD、同步 specs 或 archive change。

## Decisions

### Decision: 使用独立 change 承载初始基线迁移

候选 requirements 位于 `openspec/changes/baseline-migration/specs/`，而不是直接写入 `openspec/specs/`。这样 Review 前不会形成两个互相竞争的 current requirements 来源。

备选方案是直接创建 main specs，再依赖文档声明其为草稿；该方案容易被 Codex 或开发者误认为已经生效，因此不采用。

### Decision: 当前候选规范只覆盖 0.0.1

`0.0.1` 是 PRD 明确描述的第一个可运行技术验证版本。`0.0.2+` 即使已有方向，也保留在 roadmap，后续按真实开发批次通过独立 change 引入。

备选方案是把完整 V1 一次性写成 current specs；这会让当前实现范围和未来计划混合，重新产生 PRD 的问题，因此不采用。

### Decision: 分类清单是迁移审查依据

使用 `requirements-inventory.md` 记录确认项、roadmap 和历史上下文，使用 `unresolved-decisions.md` 记录所有未决项。candidate specs 只引用确认项。

### Decision: Review 是 source-of-truth 切换的硬门槛

只有用户明确批准后，才依次执行 sync、strict validation、PRD freeze、AGENTS authority switch 和 archive。生产部署不属于该 archive 门槛。

## Risks / Trade-offs

- [Risk] PRD 中同一能力同时出现在完整 V1 与后续版本，可能被重复迁移。→ 使用 inventory ID 和版本列控制，每项只保留一个当前分类。
- [Risk] 当前只迁移 `0.0.1` 可能遗漏长期产品方向。→ roadmap 和 unresolved 文件完整保留输入，不删除原 PRD。
- [Risk] 候选 specs 的规范词看起来像已生效要求。→ 在 AGENTS、proposal、inventory 和 review checklist 中明确其 draft 状态。
- [Risk] OpenSpec archive 默认会同步 specs。→ Review 前不调用 archive；批准后先检查 sync 结果再 archive。

## Migration Plan

1. 完成 inventory、unresolved decisions、candidate specs 和 review checklist。
2. 运行 change validation，仅验证候选 artifact 的结构和一致性。
3. 交给用户 Review，不修改 PRD 状态和 main specs。
4. 用户批准后，执行 specs sync 和 strict validation。
5. 在 PRD 顶部添加 frozen historical baseline 标记，并更新 AGENTS 权威规则。
6. archive baseline migration；deployment state 保持独立。

若 Review 未通过，只修改 change 草稿；不存在业务代码或 main specs 回滚问题。
