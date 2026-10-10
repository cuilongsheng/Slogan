## Context

Currently there is only one copy of `PRD_V1.md` with mixed properties, and `openspec/specs/` is empty. OpenSpec has been initialized with the Codex core profile, but there are no active main specs yet. This work is document and governance migration and does not involve business implementation.

## Goals / Non-Goals

**Goals:**

- Establish a baseline migration that is auditable, traceable, and does not elevate pending issues.
- Enable candidate delta specs to pass OpenSpec verification and be safely synced to main specs after approval.
- Clarify the source-of-truth status switching before and after Review.

**Non-Goals:**

- No modifications to business code, database, API or Figma.
- `0.0.2+` roadmap is not implemented in this migration.
- Does not answer pending product questions for users.
- Do not freeze PRD, sync specs or archive changes until user approval.

## Decisions

### Decision: Use independent changes to host initial baseline migrations

Candidate requirements are located at `openspec/changes/baseline-migration/specs/` instead of writing directly to `openspec/specs/`. In this way, there will not be two competing sources of current requirements before Review.

The alternative is to directly create the main specs and then rely on the documentation to declare it as a draft; this solution can easily be mistaken by Codex or developers as having taken effect, so it is not adopted.

### Decision: The current candidate specification only covers 0.0.1

`0.0.1` is the first operational technical verification version explicitly described by the PRD. Even if `0.0.2+` already has a direction, it will remain in the roadmap and will be introduced through independent changes in the future according to the real development batch.

The alternative is to write the entire V1 into current specs at once; this would mix the current implementation scope with future plans and re-create the PRD problem, so it is not adopted.

### Decision: The classification list is the basis for migration review

Use `requirements-inventory.md` to log confirmations, roadmap, and historical context, and `unresolved-decisions.md` to log all pending items. candidate specs only reference confirmed items.

### Decision: Review is a hard threshold for source-of-truth switching

sync, strict validation, PRD freeze, AGENTS authority switch and archive are executed in sequence only after explicit user approval. Production deployments do not fall under this archive threshold.

## Risks / Trade-offs

- [Risk] The same capability in PRD appears in both full V1 and subsequent versions, and may be migrated repeatedly. → Using inventory ID and version column control, only one current classification is retained for each item.
- [Risk] Currently only migrating `0.0.1` may miss long-term product direction. → roadmap and unresolved files keep the input intact and do not delete the original PRD.
- [Risk] The specification words for candidate specs look like they are already valid requirements. → Clarify its draft status in AGENTS, proposal, inventory and review checklist.
- [Risk] OpenSpec archive will synchronize specs by default. → Do not call archive before review; after approval, check the sync result first and then archive.

## Migration Plan

1. Complete inventory, unresolved decisions, candidate specs and review checklist.
2. Run change validation to verify only the structure and consistency of candidate artifacts.
3. Leave it to the user for review without modifying the PRD status and main specs.
4. After user approval, perform specs sync and strict validation.
5. Add frozen historical baseline tag on top of PRD and update AGENTS authoritative rules.
6. archive baseline migration; deployment state remains independent.

If the Review fails, only the change draft will be modified; there is no business code or main specs rollback issue.
