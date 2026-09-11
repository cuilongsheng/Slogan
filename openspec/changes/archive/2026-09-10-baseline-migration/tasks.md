## 1. Draft Baseline Migration

- [x] 1.1 Classify `PRD_V1.md` into confirmed requirements, future roadmap, unresolved decisions, and historical context; verify every inventory row cites a PRD section.
- [x] 1.2 Draft the six `0.0.1` capability delta specs; verify no roadmap or unresolved item is expressed as MUST/SHALL.
- [x] 1.3 Create the migration design and review checklist; verify both state that Review precedes sync, freeze, authority switch, and archive.

## 2. User Review Gate

- [x] 2.1 Present `requirements-inventory.md`, `unresolved-decisions.md`, and all candidate specs for user Review; verify every requested correction is reflected in the change artifacts.
- [x] 2.2 Obtain an explicit user instruction approving the baseline migration; do not infer approval from silence or a request to inspect files.

## 3. Apply Approved Baseline

- [x] 3.1 Sync approved candidate specs into `openspec/specs/` and verify `openspec validate --specs --strict` passes.
- [x] 3.2 Add a frozen historical baseline notice to `PRD_V1.md` without rewriting its body, and verify the notice links to the approved OpenSpec specs.
- [x] 3.3 Update `AGENTS.md` and OpenSpec context so `openspec/specs/` is the current requirements source of truth; verify no transitional authority statement remains.
- [x] 3.4 Archive `baseline-migration` after acceptance and verify deployment state remains independently tracked.
