# Baseline Migration Review Checklist

## Review Outcome

- [x] `requirements-inventory.md` 的四类分类得到用户确认。
- [x] 每条 candidate requirement 均可追溯到 `PRD_V1.md` 的明确决定。
- [x] Future roadmap 没有进入 candidate specs。
- [x] Unresolved decisions 没有使用 MUST/SHALL，也没有进入 candidate specs。
- [x] Historical context 没有被误写成产品行为。
- [x] 六个 candidate capabilities 的边界和命名得到用户确认。
- [x] `0.0.1` candidate scenarios 足以表达当前首个闭环。
- [x] 用户明确给出“批准 baseline migration”指令。

## Actions Allowed Only After Approval

- [x] 使用 `openspec-sync-specs` 将候选 delta specs 合并到 `openspec/specs/`。
- [x] 运行 strict validation 并修复格式问题。
- [x] 在 `PRD_V1.md` 顶部标记 frozen historical baseline，保留原正文。
- [x] 更新 `AGENTS.md`，将 `openspec/specs/` 切换为 current requirements source of truth。
- [x] archive `baseline-migration` change。

Review 未完成时，以上动作均不得执行。
