## Why

The current rules only describe the technology stack and a few general constraints, and do not define the respective directory responsibilities, module boundaries and dependency directions of PC, mobile terminal and backend. Filling in these stable boundaries before development can prevent directories such as `components`, `hooks`, `utils`, and NestJS services from gradually becoming unbounded code accumulation areas.

## What Changes

- Establish the target structures for the `pnpm` monorepo: `apps/mobile`, `apps/admin`, `apps/api`, and `packages/*` created with true sharing requirements.
- Retain `rules/frontend.md` as a common rule for both ends, and add `rules/mobile.md` and `rules/admin.md`.
- Extends `rules/backend.md`, uses NestJS modular monolith, and defines the dependency directions of presentation, application, domain, and infrastructure.
- Added `docs/architecture/project-structure.md`, which stores complete directory examples, directory responsibilities and module templates.
- Update the rule routing of `AGENTS.md` so that Codex reads the corresponding rules according to the change target.
- Clearly do not share PC/mobile UI, do not create a global `interfaces` garbage directory, and do not generate placeholder business code in the directory skeleton.
- Create a complete directory skeleton of `apps/mobile`, `apps/admin`, `apps/api`, `packages/api-client`, `packages/shared` and the subdirectories listed in the document; empty directories are retained with `.gitkeep` and no business implementation is generated.
- Keep the existing responsibilities of API contract, Figma, OpenSpec, verification and deployment unchanged.

## Capabilities

### New Capabilities

<!-- None. This change only establishes the engineering structure and rules and does not change the observable behavior of the product. -->

### Modified Capabilities

<!-- None. skip_specs=true。 -->

## Impact

- Impacted delivery stages: Architecture。
- `AGENTS.md`, `rules/*.md` and `docs/architecture/*.md` will be modified.
- Do not modify `PRD_V1.md`, baseline migration candidate specs, `openspec/specs/`, or business code.
- Create `apps/`, `packages/` directory skeletons, but do not create package manifest, runtime code, API contract or business implementation.
