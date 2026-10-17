# Unified mobile events release

Date:2026-10-17 (Asia/Shanghai). Status: deployed and verified. Runtime source dd0289139e4aaaa4769acdb7de70f612aca4a943; Android0.0.127/code1127. Android physical-device acceptance is explicitly deferred by the owner for this change.

## Source and behavior

PR32 added the compatible event protocol and timeline API. PR33 completed the mobile consumers, latest20/older20/delta20 chat and native HTTP cancellation/scroll corrections. PR34 bounded protocol2 permission queries by coalescing repeated scope/resource/kind notifications within each reader batch, while retaining current permission checks, replay ordering and exact legacy delivery. Backend migration is additive; all33 migrations are retained.

Source candidate36bdb5c96d43b9ccac25838e6b2c1717b21f7385 includes these changes plus PR35's owner-approved Me V3 correction and documentation archives. The owner explicitly requested PR35 be included by a later deployment task. This release performs the checks deliberately deferred by that source-only delivery. Native Vercel Git exclusions remain; the existing guarded workflow owns production publication.

Each authenticated foreground client owns one `/v1/me/live-updates` connection. Calls, invitations, room state/text/safety, account/restriction/report progress, learning/history and release availability use authorized invalidations. Focused consumers read only affected projections. Presence/call heartbeats, command retries, media callbacks and UI clocks keep their existing responsibilities. Chat opens the newest20 mixed text/call entries, loads older20 while preserving the reading position, and synchronizes bounded newer changes independently.

## Evidence before the final release

- Prior complete verification passed131 API suites/663 tests,68 mobile suites/259 tests,29 routed-browser and53 component-browser cases, contracts, lint, types, boundaries and builds.
- PR34 additionally passed4 burst/replay/current-role/legacy unit cases and14 PostgreSQL/Redis HTTP SSE integration cases; the90-event burst required only4 distinct permission queries. Its current-main Phase-one CI passed.
- Current Me source passed9 profile tests and5 affected routed-browser cases. Desktop Bridge originals and the current390×844 runtime were compared; see [Me acceptance](../acceptance/compact-me-page/README.md). No physical-device or whole-screen1:1 claim is made for that web evidence.
- iOS27 simulator acceptance covered actual native SSE, latest20/older20, retained history anchor, incoming updates, keyboard draft, background/resume, account replacement and a40s connection stall with one replacement stream and delta recovery. [Unified acceptance](../acceptance/unified-mobile-events/README.md) records exact boundaries and sanitized request windows. Android physical-device acceptance was explicitly deferred by the owner for this change.

## Prior attempts and current release boundary

Backend17e16ef was deployed and passed hosted protocol2/v1 coexistence, progressive API/Pages delivery, private/cursor isolation, timeline paging, reset/cancel/session revocation and full renewal. Owned fixtures were cleaned up.

Client main0f9fcde deployed API and mobile Pages, but its expanded room-audience Cloud probe timed out and cleaned up its fixtures. Admin Pages exceeded its15-minute matching-API wait, twelve seconds before the API runtime gate completed. APK0.0.121 built but publication was blocked. This is not full acceptance.

Correction mainb069fe2 passed Phase-one CI and built APK0.0.124/code1124 (SHA-256492a2179fc8c77f25c880ee5555feb1c41993057df8182287fc9c2ff3fab8d74). The guarded migration correctly stopped with MIGRATION_MAIN_CHANGED after PR35 advanced main. No publication of that APK or successful Cloud room-audience acceptance is claimed.

The final workflow must verify the exact new main/API/both Pages/APK identity, current-host transfer, removed-member terminal-only delivery, full stream renewal and owned fixture cleanup. Public APK bytes, source config, package/ABI/permissions and controlled certificate are checked before recording deployed status.

## Rollback

Default/v1 streams retain the released vocabulary and legacy message/call cursor semantics. A client rollback can preserve all business history and the additive schema. Repair publishers forward if needed; do not delete business data or reverse deployed migrations to manufacture rollback evidence. No production rollback was performed.


## Final release receipt

Final source dd0289139e4aaaa4769acdb7de70f612aca4a943 passed132 API suites/667 tests,68 mobile suites/259 tests,29 routed-browser and53 component-browser cases plus required lint/types/boundaries/contracts/migrations/builds. The new actual-HTTP terminal-membership assertion and all14 PostgreSQL/Redis SSE integration cases also passed locally.

The first final-main hosted probe identified a missing removed-member terminal event and correctly blocked APK publication. Runtime logs and source inspection found10 superseded pre-protocol2 deployments still running recurring queue workers against the shared outbox. Their dispatchers discarded resource/kind fields before deleting rows. Exact incompatible deployment IDs were retired with active-alias protection, retaining current and protocol2-compatible rollback deployments. No business/Redis/queue data was deleted and no permission check was weakened. See [retirement receipt](../acceptance/unified-mobile-events/legacy-worker-retirement.json) and the updated [guarded runbook](../deployment/phase-one-guarded-release.md).

Guarded run38988292048 attempt2/job117270919662 then passed encrypted backup, isolated restore,33 migration/invariant checks, production migration, API runtime identity and all16 hosted SSE checks. Current/successor-host delivery, removed-member terminal-only delivery, subsequent text denial, unrelated-account isolation, protocol2/v1 coexistence, latest20/older20/delta20, session revocation, reset/cancel and full lease renewal passed; script-owned fixture cleanup succeeded. The removed actor's terminal notification arrived in2261ms and Pages lease renewal in240171ms in this single smoke sample. [Cloud receipt](../acceptance/unified-mobile-events/cloud-verification.json).

Android run38988292062 build and publication succeeded. At2026-10-17T01:27:23.781Z, live API and both Pages matched dd02891. Actual public APK verification passed for0.0.127/code1127:87,572,993 bytes; SHA-256 e0abfc051a7016010fb18c88471533c0b630ea31210b9baf0ace10de7a8355a1. The signature matched the existing controlled certificate; package, ABI, permissions, release flags and embedded source/API/version config matched metadata. [Artifact receipt](../acceptance/unified-mobile-events/release-verification.json).

- Mobile: https://slogan-preview-mobile.pages.dev
- Admin: https://slogan-preview-admin.pages.dev
- APK: https://slogan-preview-mobile.pages.dev/downloads/android.apk

The following evidence/test-only closure is intentionally excluded from redeployment. The released application remains dd02891. Current Android device deferral and additive rollback boundaries remain explicit; no Android physical-device or new production latency guarantee is claimed.
