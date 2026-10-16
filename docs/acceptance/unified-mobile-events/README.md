# Unified mobile events and chat history

Implementation in progress, 2026-10-15. Change: paginate-chat-history-over-shared-sse. Owner explicitly requested implementation after reviewing the proposal. This does not claim completion, device acceptance or a new deployment.

## Timer inventory and acceptance boundaries

| Consumer | Prior schedule | Disposition |
| --- | --- | --- |
| ChatScreen text/calls and detail |3s /15s| Migrate to resource-scoped shared SSE + latest20/older20/delta20 timeline |
| DirectCallObserver |5s| Migrate incoming-call detection; pending end commands remain bounded retries |
| RoomInvitationObserver |5s on main pages| Migrate invitation detection; retain explicit join/decline/dismiss |
| CallScreen |5s call GET or heartbeat| Migrate call GET; retain active-call outbound heartbeat |
| useRoomMessages |2–10s idle reads| Migrate room-text invalidation and bounded catch-up |
| VoiceRoomScreen room/membership refresh |15s| Migrate state invalidation; retain SDK/device/resume callbacks |
| RoomControls invite candidates |5s while open| Reuse partners invalidation |
| MyReportsScreen |5s| Migrate reports scope |
| Profile/restrictions/appeals/history/learning |entry/manual reads| Add only affected focused/self-service subscriptions |
| AppUpdateProvider |6h signed-in/out timer| Signed-in release notification; signed-out entry/foreground/manual metadata check |
| PresenceHeartbeat |server-advised lease| Keep outbound renewal |
| Active call liveness |5s heartbeat| Keep outbound renewal |
| Exit queues, failed commands |bounded backoff| Keep command recovery, not change detection |
| Call duration, create schedule and restriction countdown |1s/60s/10s local clocks| Keep UI clocks; no extra network polling |
| SSE watchdog/reconnect/lease |bounded transport timers| Keep one root connection; valid protocol2 renewal emits ready without snapshot requery |

Desktop Bridge live probe succeeded for original Slogan file56nIowZmvBhb0QJvOlDQdU /02UI. Original chat186:2389 (390×844), incoming186:2407 and active186:2418 were inspected without mutation. chat-original.png is the live plugin export. Runtime comparison is pending; recorded node IDs alone do not certify visual acceptance.

A first wrapper invocation inadvertently selected the broad integration suite and was stopped. The first focused rerun then overlapped two unrelated account-access-lifecycle test processes sharing slogan_test, producing missing-fixture failures. Subsequent checks use a named loopback-only slogan_test_unified_events database and Redis8. Do not classify the interrupted/shared-fixture runs as passed.

Native acceptance for this change remains pending. The prior release waiver is not silently reused. Production API/Pages protocol2, native scroll/lifecycle and artifact evidence will be recorded separately.

## Local verification, 2026-10-16

The complete affected API run passed118 suites /607 tests (unit, integration, HTTP e2e and runtime) in231.384s. PostgreSQL isolation is now installed before Nest's import-time environment validation; the SSE fixture asserts current_database() against the named loopback target. Earlier runs that initialized the default database are not used as isolated-database evidence. The forward upgrade preserves v1 rows and the10,000-message EXPLAIN fixture uses the existing conversation/sequence indexes for bounded latest/delta scans. No additional timeline index is needed. A750-event burst drains through bounded, idempotent pipelined batches.

Mobile passed66 suites /251 tests. The final component harness passed53 browser cases, including a held-open HTTP stream through the real root provider, one connection per client, latest20 without idle history queries,20 older entries with a stable anchor, and incoming changes while reading older content. Both race-sensitive cases also passed two concurrent repetitions with distinct resources. The application-router browser suite passed29 cases with two workers. Lint, typechecks, dependency boundaries, code-first OpenAPI/client checks, native iOS export and the HTTPS-origin Pages mobile build passed. These are local/fixture checks, not Cloud or physical-device acceptance.

Desktop Bridge originals were re-read on2026-10-16. Original chat/incoming/active exports are under figma/. Existing compact bubbles/composer/menu/phone UI is retained; the historical edge adds only a localized inline earlier-history action/loading state. The original frame has a24px chat title whereas the previously released UI has16px, and the global approved control sizing uses46px. This change does not claim a new1:1 visual restoration of that pre-existing title difference. Runtime captures and functional scroll evidence are recorded separately.

The owner explicitly accepted Android physical-device acceptance as a follow-up for this change on2026-10-16 and authorized continuing deployment. iOS simulator acceptance is in progress through Xcode Device Hub (the current simulator UI owner); merely booting the simulator or exporting an iOS bundle is not recorded as a device pass. No new deployment is claimed yet.

## Current-main integration

Backend integration62c45f6 includes main3834e03 without dropping its observability changes. The sole fixture conflict retained both the named test database override and the observability defaults. Client changes applied cleanly on this integrated base. The original room-experience-release worktree and its pre-existing acceptance changes remain intact; the release is assembled in the isolated unified-events-integration checkout.

After integration, all67 mobile suites /256 tests passed,53 component/browser cases passed, and mobile types/lint/boundaries/format plus the Pages build passed. One initial mobile test exceeded its5s timeout while native compilation was running; its14-test file passed separately and the subsequent full67-suite run passed. The first mixed run is not recorded as green. Full API and application-router revalidation, iOS simulator acceptance and guarded deployment remain in progress.

The refreshed chat capture shows retained pale incoming/outgoing bubbles, header back/menu/call controls and bottom composer. Older-history capture retains the reading viewport while rows26–45 are prepended; the53-case harness asserts the first visible entry top and no forced move on a new event. Incoming and active-call runtime counterparts are included beside the Bridge originals. This is retained-UI verification within the approved event/pagination scope; the pre-existing16px title and46px controls remain the documented source differences.

The integrated backend full run passed131 suites /663 tests in427.223s, including the added observability tests. The application-router suite passed29 cases with two workers. The native debug app rebuilt successfully with the current image/clipboard/Sentry modules and was installed on Slogan-iPhone-13 (iOS27 simulator); runtime acceptance is still in progress.

The guarded streaming smoke now also creates an owned room and verifies host-only alerts, host transfer, the removed member's terminal membership update, denial of subsequent room text and unrelated-room references. The expanded script passed against the local API/owned database and cleaned up every script-owned fixture. This is an additional local full-stack check, not yet Cloud evidence. All17 release/proxy tests passed. The simulator-only signing/Keychain setup is being repaired before recording native evidence; no diagnostic source changes are retained.
