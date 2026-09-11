---
name: voice-room-figma-to-frontend
description: Implement a voice-room frontend route from a confirmed Figma target and the project's sole OpenAPI contract, preserving existing architecture and producing visual, runtime, and test evidence. Use when a task combines Figma-to-frontend work with API integration; do not use for Figma-only edits or backend-only changes.
---

# Voice Room Figma To Frontend

Deliver a working frontend screen, not a static visual imitation.

## Authority

Read `AGENTS.md` first because baseline migration may change the active requirements source.

- Active OpenSpec requirements own product behavior and acceptance criteria.
- Figma owns visual structure, tokens, assets, and represented states.
- `openapi/openapi.yaml` owns API request/response contracts.
- The repository owns routing, modules, state, components, localization, and error-handling conventions.
- Tests/CI, visual comparison, runtime checks, and device checks provide acceptance evidence.

Never let Figma invent missing business behavior. Never infer an API from a mockup. Never replace a confirmed visual with repository convenience without reporting the difference.

## Preconditions

Before implementation, identify:

```text
OpenSpec capability/change:
Figma file / page / frame / node:
Route:
Roles:
Primary behavior:
OpenAPI operations:
Target viewport/device:
```

Stop and request clarification when the exact Figma frame or consequential product behavior is ambiguous. If the API contract is absent or incomplete, classify the affected integration as `MISSING` or `PARTIAL`; do not create a fake production API.

## Workflow

1. Read the relevant active requirements/change, `rules/frontend.md`, `rules/testing.md`, and affected OpenAPI operations.
2. Inspect the existing frontend router, feature boundary, shared components, tokens, state, localization, API client, permissions, and nearby tests.
3. Confirm the exact Figma target and collect sufficient design evidence. Read [references/figma-evidence.md](references/figma-evidence.md).
4. For an explicit 1:1/high-fidelity request, or when extracted evidence is uncertain, run the independent reconstruction gate in [references/reconstruction-gate.md](references/reconstruction-gate.md).
5. Audit every screen capability against OpenAPI using [references/openapi-integration.md](references/openapi-integration.md).
6. Implement only the approved behavior in the existing frontend architecture. Reuse project primitives before adding new abstractions.
7. Run static checks, relevant tests, Playwright flows, browser/device checks, and Figma-to-runtime comparison as applicable. Read [references/implementation-validation.md](references/implementation-validation.md).
8. Return the evidence and remaining gaps using [references/delivery-report.md](references/delivery-report.md).

## Hard Rules

- The original selected Figma frame is immutable unless the user explicitly asks to edit the design.
- Do not clone the original frame as proof of design understanding.
- Use exact available assets; do not add decorative icons, images, colors, or spacing absent from the target.
- Keep API types and calls derived from the sole OpenAPI contract; do not duplicate DTO definitions inside screens.
- Do not hide missing API behavior behind static success data unless an established mock mode was explicitly requested.
- Validate against the original Figma frame, not a reconstruction artifact.
- Do not mark an unexecuted check as PASS.

## Completion

The task is complete only when all applicable items are evidenced:

- exact target, route, role, and behavior confirmed;
- visual evidence and assets resolved;
- API operations classified and integrated without contract drift;
- behavior works in the existing application architecture;
- lint/typecheck/build and relevant tests pass or unrelated failures are isolated;
- Playwright/runtime/device evidence covers affected flows;
- browser or device rendering is compared with original Figma;
- missing contracts, product gaps, intentional deltas, and blocked validation are reported.

