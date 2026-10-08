---
name: figma-to-frontend
description: Implement or correct Slogan admin and mobile screens from confirmed Figma designs, with direct original-to-runtime visual comparison, working interactions, and integration against the sole OpenAPI contract when applicable. Use for Figma frontend implementation and visual restoration, including UI-only changes; not for Figma-only design editing or backend-only work.
---

# Figma To Frontend

Deliver the actual admin or mobile screen matching the confirmed Figma target, with working product behavior. Default to 1:1 restoration at the target viewport; relax it only for differences the user explicitly authorizes.

Use this project skill from `.agents/skills/figma-to-frontend/` in Slogan. A same-named personal skill is not a substitute for these project requirements.

## Authority

Read `AGENTS.md` first because baseline migration may change the active requirements source.

- Active OpenSpec requirements own product behavior and acceptance criteria.
- Figma owns visual structure, tokens, assets, and represented states.
- `openapi/openapi.yaml` owns API request/response contracts.
- The repository owns routing, modules, state, components, localization, and error-handling conventions.
- Tests/CI, visual comparison, runtime checks, and device checks provide acceptance evidence.
- Figma file access uses only the connected Desktop Bridge. If unavailable, stop dependent visual work and report the connection issue; never fall back to cloud, REST, or browser file access.

Never let Figma invent missing business behavior. Never infer an API from a mockup. Never replace a confirmed visual with repository convenience without reporting the difference.

## Preconditions

Before implementation, identify:

```text
OpenSpec capability/change:
Figma file / page / frame / node:
Route:
Roles:
Primary behavior:
OpenAPI operations, or none for a UI-only task:
Target viewport/device:
Required visible states:
Explicitly authorized differences, if any:
```

Inspect the connected file and existing requirements before asking for a target the tools can identify. Ask only when competing targets or consequential behavior remain ambiguous. Missing API behavior blocks that integration, not independent authorized visual work; classify it as `MISSING` or `PARTIAL`, without inventing a successful API.

## Workflow

1. Read the relevant active requirements/change, `rules/frontend.md`, `rules/testing.md`, and affected OpenAPI operations.
2. Inspect the existing frontend router, feature boundary, shared components, tokens, state, localization, API client, permissions, and nearby tests.
3. Confirm the exact Figma target and collect sufficient design evidence. Read [references/figma-evidence.md](references/figma-evidence.md).
4. Establish the original screenshot, layout measurements, asset mapping, and matched runtime capture conditions using [references/visual-fidelity.md](references/visual-fidelity.md). This is required for every claimed visual restoration; rebuilding the frame in Figma does not satisfy it.
5. Audit every screen capability against OpenAPI using [references/openapi-integration.md](references/openapi-integration.md).
6. Implement only the approved behavior in the existing frontend architecture. Reuse a primitive only when its geometry and states can match the design; existing component defaults do not justify a mismatch. Follow the project's OpenSpec routing without adding a second approval gate already satisfied by the current session.
7. Run static checks, relevant tests, Playwright flows, browser/device checks, and Figma-to-runtime comparison as applicable. Read [references/implementation-validation.md](references/implementation-validation.md).
8. Return the evidence and remaining gaps using [references/delivery-report.md](references/delivery-report.md).

## Hard Rules

- The original selected Figma frame is immutable unless the user explicitly asks to edit the design.
- Do not clone the original frame as proof of design understanding.
- Use exact available assets; do not add decorative icons, images, colors, or spacing absent from the target.
- Do not replace designed photos/icons with initials, emoji, generic icons, or CSS approximations. Missing assets are an explicit unresolved visual gap.
- Do not change directly visible content into accordions, add extra menus/controls, or remove designed states for implementation convenience.
- Every represented input, send action, recording gesture, navigation, and exit must invoke its actual intended behavior. Matching appearance with the wrong operation fails acceptance.
- Keep API types and calls derived from the sole OpenAPI contract; do not duplicate DTO definitions inside screens.
- Do not hide missing API behavior behind static success data unless an established mock mode was explicitly requested.
- Validate against the original Figma frame, not a reconstruction artifact.
- Do not mark an unexecuted check as PASS.
- No screenshot of the running target means visual validation is BLOCKED, even if lint, tests, build, or a Figma reconstruction passed.
- Fix measurable or visible source-backed mismatches and recapture affected states before delivery. Listing a known, unapproved visual delta does not convert it to PASS.

## Completion

The task is complete only when all applicable items are evidenced:

- exact target, route, role, and behavior confirmed;
- visual evidence and assets resolved;
- API operations classified and integrated without contract drift;
- behavior works in the existing application architecture;
- lint/typecheck/build and relevant tests pass or unrelated failures are isolated;
- Playwright/runtime/device evidence covers affected flows;
- original Figma and actual runtime screenshots are compared at matching viewport, content, state, theme, and platform conditions, with linked evidence and region-by-region results;
- no unresolved unapproved visual mismatch remains; OS chrome or font rasterization differences are narrowly identified and cannot excuse app layout, type, or asset differences;
- missing contracts, product gaps, approved deltas, and blocked validation are reported separately.

Do not promise that this instruction file alone guarantees pixel identity. A `1:1 PASS` claim requires the actual screen evidence above; otherwise report the precise PARTIAL, FAIL, or BLOCKED state.
