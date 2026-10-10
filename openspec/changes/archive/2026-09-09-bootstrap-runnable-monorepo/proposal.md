## Why

The project currently only has the target directory and project rules of the `pnpm` monorepo, without workspace manifest, dependency locking, TypeScript configuration or unified verification commands, so the three applications still cannot be installed, started, built or tested. Before developing business, it is necessary to establish a minimal but runnable and checkable engineering baseline so that subsequent OpenSpec changes can be delivered on the same set of boundaries and commands.

## What Changes

- Create the root `pnpm` workspace, include `apps/admin`, `apps/mobile`, `apps/api`, `packages/api-client` and `packages/shared`, and express local package relationships with unique lockfile and `workspace:` dependencies.
- Create a minimal React + TypeScript executable shell for the PC admin app, a minimal React Native + Expo Router executable shell for the mobile client, and a minimal NestJS modular monolith executable shell for the backend; do not implement login, room, review or other product functions.
- Establish root-level installation, development, lint, typecheck, test, build and verify commands, and retain the ability to execute them individually by workspace; no Nx or Turborepo are introduced at the current scale.
- Create shared TypeScript, ESLint, Prettier, environment variable examples and dependency boundary configurations, and automatically discover cross-application deep imports, illegal dependency directions and circular dependencies.
- Establish an engineering technology stack registration form and record the responsibilities, adoption timing and alternatives of each technology according to `adopt-now`, `adopt-on-trigger`, `deferred`, `rejected`; do not load unused database, queue, real-time or state management dependencies into bootstrap in advance.
- Synchronize the adopt-now technology boundaries identified in this change to the admin, mobile and backend stable rules; the complete dependency list and future technologies are still only retained in the technology stack registration table to avoid rule expansion.
- Establishing a layered test baseline: application-level quick testing with root Playwright Web E2E; mobile physical device behavior is not replaced by Playwright.
- Create `.gitignore`, single lockfile, private workspace package, version locking and product exclusion policies; do not introduce Git LFS or package release tools by default.
- Convergence of CI required checks to `pnpm verify` for provider-neutral. The CI provider and remote Git platform have not yet been decided, so this change does not create a specific platform workflow; after the platform is determined, an independent change will access the same verification entrance.
- `packages/api-client` only establishes package boundaries, does not generate clients, does not create a second set of DTOs, and does not determine API-first or NestJS code-first generated OpenAPI.

### Confirmed scope

- The project must be able to be installed from a clean environment and start the minimal shells of admin, mobile and api respectively.
- The root verification command must be able to uniformly perform format checking, dependency boundaries, lint, typecheck, testing and building.
- Each workspace must explicitly declare direct dependencies, and it is prohibited to rely on packages that are accidentally elevated from the root directory.
- Bootstrap only installs the technology required to complete the minimum running shell; the business infrastructure that has been selected but does not yet have real consumers must record trigger conditions and cannot be disguised through empty configuration or placeholder services.

### Non-goals

- Does not modify `PRD_V1.md`, baseline migration, product requirements, or Figma.
- Does not implement business API, database schema, Redis, LiveKit, OAuth, STT, AI, or deployment environment.
- `openapi/openapi.yaml` is not created or generated; the OpenAPI generation method is still determined by the first API Architecture change.
- No CI provider, deployment platform, or official release mechanism selected.

### Unresolved decisions

- CI provider and remote Git platform; this decision does not block the local runnable and CI-ready verification entry.
- The precise Node, pnpm and each framework versions are determined according to mutually supported stable version combinations at the beginning of apply, and written to the version file, manifest and lockfile. Undocumented native implicit versions cannot be used.

## Capabilities

### New Capabilities

<!-- None. This change only creates the engineering tool chain and minimum running shell, and does not change the observable behavior of the product. -->

### Modified Capabilities

<!-- None. skip_specs=true。 -->

## Impact

- Impacted delivery stages: Architecture、Test / Acceptance。
- The root workspace/tooling configuration, minimum startup code for three apps, two package manifests, test configurations and project descriptions containing technology adoption status will be added, and related stable project rules will be updated.
- Will replace `.gitkeep` in the related directory, but will not delete the confirmed directory boundary.
- Development dependencies will be introduced and locked; production business data migration will not be introduced, API contracts will not be changed, and deployment release state will not be generated.
