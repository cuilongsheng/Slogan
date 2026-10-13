# Invitation, report and page feedback acceptance

## Approved scope

The owner requested receiver invitation feedback, persistent sent state, personal complaint records and processing progress. Subsequent directions retain the Me heading and the avatar/name/language block beneath it, left-align compact action rows, anchor logout above navigation, move the Discover toolbar below the centered heading and standardize standalone large actions to 342×46 at 390pt. Compact row and paired controls retain their distinct geometry. Narrow page actions shrink; constrained cards and dialogs fit their available content width. Standard full page actions use 24pt outer margins.

## Source and visual evidence

Figma Desktop Bridge file `56nIowZmvBhb0QJvOlDQdU`, page `102:2766` was probed and read live. Original references are preserved: Discover `115:1197`, Partners `186:2348`, Messages `186:2369`, Me `152:1467`, invitation picker `111:882`, member report `190:2529`, login `118:2970`. Direct exports are in `figma/`. Noto Sans SC, purple, canvas, light rows and dark panels follow the established source.

Editable new semantic states are in section `212:3192`: incoming invitation `212:3205`, personal history `212:3217`, receipt `212:3240`. These are new design states, not replacements for original references and not proof that every existing screen was restored 1:1. Original-to-runtime comparison uses `figma/` and `runtime/` at 390×844. Owner deltas intentionally replace original title sizes and button geometry; Me combines the supplied compact menu image with the explicitly retained profile/language block and existing main navigation. New history uses complete server case IDs and localized progress, which may grow cards beyond representative design content.

Verified geometry: Partners/Messages/Me 16px titles; creation and logout 342×46 centered at x=24; Discover filter x16/y95/57×32, count x93/y100, burst x173/y95/32×32, create x320/y86/42×42, first room card remains y142. Login and other full page actions use the same shared geometry. Layout captures are explicit HTTP or session fixtures, not live media/device evidence.

## Behavior and contracts

- Root observer is account-scoped and foreground-only, activates on the four main routes, preserves dismissed invitations in a reopen entry, and fences old account responses. It never automatically joins. Direct admission passes the invitation ID; password, capacity, rules and eligibility remain server-owned. Scheduled invitations use room detail. Active room/call and history routes do not trigger the invitation dialog.
- Current-host `GET /v1/rooms/{roomId}/invitations` supplies pending targets. Picker candidates and pending status load in parallel. Authoritative pending targets disable sends after reopening; immediate command guards and merging confirmed sends protect overlapping reads. Declined/consumed/cancelled records cease to appear as pending.
- Authenticated reporter `GET /v1/me/reports` returns only personal receipts and actual OPEN/UNDER_REVIEW/RESOLVED/DISMISSED progress, stable pagination and actual decision timestamps. Projection excludes complaint text, private messages, notes, assignees and sanction details. Room/member/direct-message submissions show a case receipt with a My reports entry. Error retries retain drafts and request IDs.
- NestJS generates the sole OpenAPI file and API client. No schema migration, credentials or provider configuration changed. Main OpenSpec requirements were synchronized; release task remains active until deployment identity is verified.

## Verification

- API verify passed: 243 unit tests, 212 PostgreSQL integration tests, 110 HTTP tests, lint, typecheck, build and OpenAPI generation check. Includes owner isolation, current-host pending query and terminal state, deduplication, paging validation, minimal projections, direct-message history after personal deletion, and actual case progress.
- Mobile: 226 tests across 60 suites passed, including account fencing, scheduled/direct joins, dismissal/reopen, stable decline retry, busy routes, persisted pending state and a pre-send read race.
- Workspace formatting, dependency boundaries, lint and typechecking passed.
- Visual/session harness: 48 tests passed. Receiver browser flow uses independent contexts, verifies invitation-specific routing and normal password admission; it deliberately stops at a fake media provider failure.
- Routed main browser suite: 27 existing tests passed. New tests initially used the default desktop viewport rather than their 390pt measurement target; the test viewport was corrected and the affected three scenarios rerun. All three affected scenarios passed on the corrected viewport (29 routed scenarios passed across the completed broad run and affected rerun). Earlier route fixture mismatches and ESM command setup failures were corrected before acceptance; they were not claimed as passing checks.

## Limits and rollback

No physical Android/iOS validation or background OS notification delivery is claimed. No new real LiveKit audio path was introduced; fixture screenshots do not establish cloud latency or microphone/device acceptance. Published API/Pages/APK identities and APK hash are checked separately in the release receipt. APIs are additive, so the prior API/web revision is a compatible rollback; Android rollback requires a higher version code.
