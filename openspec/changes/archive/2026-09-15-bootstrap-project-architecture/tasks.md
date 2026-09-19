## 1. Rule Routing

- [x] 1.1 Update `AGENTS.md` to route admin work to `rules/frontend.md` + `rules/admin.md`, mobile work to `rules/frontend.md` + `rules/mobile.md`, and API work to `rules/backend.md`; verify every referenced rule file exists.

## 2. Frontend Boundaries

- [x] 2.1 Refine `rules/frontend.md` with shared feature-first ownership, API/type/style/util/component boundaries, public feature entrypoints, and one-way dependency rules; verify it contains no platform-specific directory duplication.
- [x] 2.2 Create `rules/admin.md` for route-level views, layouts, data-heavy interaction states, Playwright coverage, and PC-only UI ownership; verify it does not claim React Native conventions.
- [x] 2.3 Create `rules/mobile.md` for Expo Router, device services, permissions, realtime audio, localization, and real-device evidence; verify it does not rely on Playwright as native-device proof.

## 3. Backend Boundaries

- [x] 3.1 Expand `rules/backend.md` with modular-monolith ownership and presentation → application → domain plus infrastructure → domain-port dependency rules; verify controllers are forbidden from directly using Prisma, Redis, or LiveKit.
- [x] 3.2 Define common/infrastructure/shared-code admission rules and the no-empty-layer rule; verify simple modules can remain flat while complex modules have a documented upgrade path.

## 4. Architecture Reference

- [x] 4.1 Create `docs/architecture/project-structure.md` with target monorepo, admin, mobile, backend, feature, and NestJS module trees; verify every folder has one stated responsibility.
- [x] 4.2 Document cross-app sharing rules for `packages/api-client` and `packages/shared`, including forbidden framework-specific dependencies; verify UI code is not shared between web and React Native.
- [x] 4.3 Document naming, import, test-placement, and directory-creation examples; verify examples follow the mandatory rules without introducing unapproved product modules.

## 5. Consistency Verification

- [x] 5.1 Cross-check `AGENTS.md`, all rule files, `workflow/delivery-lifecycle.md`, and the architecture reference for conflicting ownership or source-of-truth statements; verify searches find no contradictory API, Figma, acceptance, or deployment authority.

## 6. Directory Skeleton

- [x] 6.1 Create the documented `apps/admin`, `apps/mobile`, and `apps/api` directory skeleton with `.gitkeep` placeholders; verify every documented application directory exists and contains no business implementation.
- [x] 6.2 Create `packages/api-client`, `packages/shared`, and root test skeletons with `.gitkeep` placeholders; verify no unapproved shared UI or generated API contract exists.
- [x] 6.3 Verify the change created no package manifests, API contracts, product specs, or business-code files, then run `openspec validate bootstrap-project-architecture --strict` successfully.
