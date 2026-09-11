# Project Delivery Lifecycle

The six stages describe project delivery, not a mandatory checklist for every OpenSpec change. Each change lists only the stages it actually affects.

## 01 Architecture

Use when a change establishes or alters system boundaries, data ownership, authentication, security, realtime behavior, API strategy, or deployment topology.

Outputs may include an OpenSpec `design.md`, an ADR, risk analysis, migration/rollback notes, and the decision between API-first and NestJS code-first generated OpenAPI.

Exit evidence: the affected boundaries and irreversible decisions are explicit enough to implement safely.

## 02 Prototype / Figma

Use when a change introduces or modifies visual behavior. Figma is the visual source of truth; OpenSpec remains the behavior source.

Outputs may include exact file/page/frame/node references, relevant states, assets, responsive behavior, and screenshots.

Exit evidence: the target and visual states are identifiable without guessing.

## 03 Backend / API

Use when server behavior, persistence, realtime orchestration, permissions, external services, or HTTP contracts change.

`openapi/openapi.yaml` is the sole published API contract. Architecture decides how it is produced; contract conformance must be verifiable either way.

Exit evidence: affected behavior works, server-side authorization is enforced, and the OpenAPI contract matches runtime behavior.

## 04 Frontend

Use when mobile or admin behavior changes. Follow existing application architecture and generated API clients rather than duplicating contracts or types.

For Figma + API page implementation, use `$voice-room-figma-to-frontend`.

Exit evidence: the requested behavior works in the target route/device context and applicable Figma differences are resolved or documented.

## 05 Test / Acceptance

Tests and CI provide verification evidence; they do not alone decide product acceptance.

Applicable acceptance evidence is composed from:

- OpenSpec acceptance scenarios;
- OpenAPI conformance for API changes;
- automated tests and CI;
- visual comparison for UI changes;
- runtime and real-device evidence where behavior depends on environment, permissions, audio, networking, or platform APIs.

Exit evidence: every applicable criterion is PASS, or a remaining limitation is explicitly accepted by the user.

## 06 Deployment

Use for release preparation, environment configuration, migrations, rollout, smoke checks, rollback, and release records. One deployment may contain several archived changes.

Deployment is independent of OpenSpec archive. A change can be accepted and archived while its release status is `not deployed`.

Exit evidence: the target environment and release state are recorded under `docs/releases/`.

## Change-Level Routing

An affected-stage declaration should be short:

```md
## Impacted delivery stages

- Backend / API
- Frontend
- Test / Acceptance
```

Do not list unaffected stages and do not create mechanical `N/A` sections.

