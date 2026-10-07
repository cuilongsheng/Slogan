# Delivery Report Template

```md
# Figma-to-Frontend Delivery

## Target
- OpenSpec capability/change:
- Figma file/page/frame/node:
- Route:
- Roles:
- Viewport/device:

## Design Evidence
- Structure and tokens:
- Components and assets:
- Original screenshot:
- Required states and frame-region/component/asset map:
- Authorized deviations, if any:

## API Readiness
- READY:
- PARTIAL:
- MISSING:
- BLOCKED:

## Implementation
- Routes/modules:
- Reused primitives:
- Behavior and states:
- API/realtime integration:

## Acceptance Evidence
- OpenSpec criteria:
- OpenAPI conformance:
- Lint/typecheck/tests/build:
- Playwright:
- Runtime/device:
- Final runtime screenshots, with route/build/platform/viewport/state:
- Comparable original/runtime pair and overlay or comparison artifact:
- Region-by-region findings and remaining unapproved differences:
- Separate visual/behavior/API/device results:

## Remaining Gaps
- Backend/API gaps:
- Product decisions:
- Explicitly authorized visual deltas:
- Blocked validation:

## Result
- Status:
- Follow-up:
```

Keep the report evidence-based. Do not call a visual-only page integrated, a local build deployed, or a missing API complete.

Do not report 1:1 PASS without original and final running-screen evidence. An unresolved unapproved visual difference requires FAIL or PARTIAL; missing capture requires BLOCKED. Artifact or skill validation is not proof that a frontend screen matches Figma.
