# Project Agent Guide

## Requirements Authority

- `openspec/specs/` is the current product requirements source of truth.
- `docs/init/PRD_V1.md` is a frozen historical baseline; do not maintain current requirements there or rewrite its historical body.
- Roadmap items, unresolved decisions, recommendations, and historical context become current requirements only through an approved OpenSpec change.
- The archived baseline migration preserves the classification and approval trail.

## Stable Ownership

- OpenSpec owns current product intent and requirement changes.
- Figma owns visual truth. It does not define missing business behavior.
- `openapi/openapi.yaml` is the sole API contract once an API exists. Architecture decides API-first versus NestJS code-first generation; never maintain two contracts.
- Tests and CI provide verification evidence. Product acceptance also requires applicable OpenSpec criteria, visual evidence, runtime evidence, and device evidence.
- Deployment owns release state. A verified and accepted OpenSpec change may be archived without production deployment.
- Codex executes approved work within the requested scope.

## Change Routing

- Level 0: typo, tiny UI correction, rename, or simple dependency update; implement and verify directly when no requirement behavior changes.
- Level 1: normal feature or observable behavior change; use OpenSpec propose, review, apply, verify, sync/archive.
- Level 2: architecture, authentication/session, security, LiveKit ownership transfer, or broad schema change; require explicit design, risk, migration, and rollback reasoning.
- An OpenSpec change lists only the project delivery stages it actually impacts. Do not mechanically add unused stages or `N/A` sections.

## Required Project Skill

When a task combines a Figma target, frontend implementation, and API integration, use `$voice-room-figma-to-frontend` from `.agents/skills/voice-room-figma-to-frontend/`.

Any Level 1 or Level 2 frontend change that creates or modifies UI structure, visual appearance, or user interaction states MUST use the `voice-room-figma-to-frontend` Skill when an approved Figma design exists or is required.

## Rules

Always read `rules/project.md` and `workflow/delivery-lifecycle.md`, then read only the target-specific rules:

- PC admin frontend: `rules/frontend.md`, `rules/admin.md`, `rules/testing.md`.
- Mobile frontend: `rules/frontend.md`, `rules/mobile.md`, `rules/testing.md`.
- NestJS backend or API contract: `rules/backend.md`, `rules/testing.md`.
- Cross-app architecture or shared packages: all affected rules plus `docs/architecture/project-structure.md`.

The full target directory structure and module responsibilities live in `docs/architecture/project-structure.md`; do not duplicate that tree in this file.

Do not modify business code while a request is only for planning, requirements migration, architecture, or review.
