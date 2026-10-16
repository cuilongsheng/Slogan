# Unified mobile events and chat history

Acceptance updated2026-10-16. Change: paginate-chat-history-over-shared-sse. Backend PR32 is deployed; client PR33 has passed final local verification and Phase-one CI. Client PR33 is merged as0f9fcde910f4f2c8acfc4d95ee934696184210e1. Guarded publication and expanded Cloud audience acceptance are pending. Android physical-device acceptance is explicitly deferred by the owner for this change. The later sections record the final native and Cloud results; earlier sections preserve intermediate verification history.

## Timer inventory and acceptance boundaries

| Consumer                                                 | Prior schedule           | Disposition                                                                            |
| -------------------------------------------------------- | ------------------------ | -------------------------------------------------------------------------------------- |
| ChatScreen text/calls and detail                         | 3s /15s                  | Migrate to resource-scoped shared SSE + latest20/older20/delta20 timeline              |
| DirectCallObserver                                       | 5s                       | Migrate incoming-call detection; pending end commands remain bounded retries           |
| RoomInvitationObserver                                   | 5s on main pages         | Migrate invitation detection; retain explicit join/decline/dismiss                     |
| CallScreen                                               | 5s call GET or heartbeat | Migrate call GET; retain active-call outbound heartbeat                                |
| useRoomMessages                                          | 2–10s idle reads         | Migrate room-text invalidation and bounded catch-up                                    |
| VoiceRoomScreen room/membership refresh                  | 15s                      | Migrate state invalidation; retain SDK/device/resume callbacks                         |
| RoomControls invite candidates                           | 5s while open            | Reuse partners invalidation                                                            |
| MyReportsScreen                                          | 5s                       | Migrate reports scope                                                                  |
| Profile/restrictions/appeals/history/learning            | entry/manual reads       | Add only affected focused/self-service subscriptions                                   |
| AppUpdateProvider                                        | 6h signed-in/out timer   | Signed-in release notification; signed-out entry/foreground/manual metadata check      |
| PresenceHeartbeat                                        | server-advised lease     | Keep outbound renewal                                                                  |
| Active call liveness                                     | 5s heartbeat             | Keep outbound renewal                                                                  |
| Exit queues, failed commands                             | bounded backoff          | Keep command recovery, not change detection                                            |
| Call duration, create schedule and restriction countdown | 1s/60s/10s local clocks  | Keep UI clocks; no extra network polling                                               |
| SSE watchdog/reconnect/lease                             | bounded transport timers | Keep one root connection; valid protocol2 renewal emits ready without snapshot requery |

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

## Native acceptance and final transport correction

Manual iOS27 acceptance used Slogan-iPhone-13 (390×844 logical screen) through Xcode Device Hub and the owned local PostgreSQL/Redis fixture. Actual Expo native streaming delivered messages66–70 including Chinese text before the response closed. Entry fetched latest20 once; a35s idle window contained no product-change GET and only the retained presence heartbeat. History paging fetched20, and the corrected native inverted virtual list retained message47 at the same screen position when older rows27–46 and a new message67 arrived. The typed draft survived background/resume, message68 created in background was caught up on resume, and switching Alice to Bob cleared the old session and showed Bob's own unread state. Screenshots and AX observations are in the task's Device Hub tool evidence; sanitized request windows are in native-network-excerpts.json.

Native acceptance found two actual gaps and they were corrected before publication: the non-inverted list could follow layout callbacks into a second page, and body-reader cancellation alone could leave the Expo HTTP request alive. Native now uses an inverted virtual list with one older-page trigger per gesture. The transport owns an AbortController and aborts the HTTP request on watchdog, background and completion, including requests awaiting headers. Three focused transport tests cover these cases. A fresh40s native connection stall after the correction closed the old stream to0 before opening the replacement at1 and recovered message70 by one after query. Earlier overlapping-stream evidence is a failed diagnostic run, not a final pass.

The simulator shell required native image/clipboard modules plus simulator-only Keychain entitlements embedded by Xcode. Those ignored generated iOS files are test setup and are not production provisioning evidence. The manual Jest server fixture exceeded its one-hour runner limit during the owner's long pause; its timed-out runner is not counted as a passing test suite. Manual UI/HTTP evidence and the separately completed automated suites establish the outcomes above. Android physical-device acceptance remains explicitly deferred by this owner for this change.

After the final transport/list changes,68 mobile suites /259 tests and53 component/browser cases passed. Types, full lint, boundary and formatting checks passed. The already verified API behavior is unchanged by these mobile corrections.

## Backend-first Cloud acceptance

PR32 merged as17e16ef3773a13ffec8fb8b16f9994145ffb5afa. Guarded production run38876533350 passed encrypted snapshot, isolated restore/33-migration invariants, production migration, API commit verification and authenticated streaming. API and both Pages release identities match that commit. The hosted smoke passed protocol2 progressive delivery, default/v1 coexistence, participant/third-account and protocol cursor isolation, latest20/older20/delta20, session revocation, reset/cancel and full lease renewal; all owned fixtures were cleaned up. API message delivery was478ms, Pages487ms, and the Pages lease renewed at242274ms. These are one smoke run's measurements, not a latency guarantee. Expanded current-host/removed-member Cloud checks run with the client release; their local integration already passed.

## Final clean browser and candidate CI verification

After the final transport/list correction, the full application-router suite passed29 cases in1.2m in a clean environment. The earlier rerun accidentally reached the real native fixture API with fake browser tokens and returned to login; it is a failed diagnostic run. Stopping the owned native fixture and Metro server restored the browser suite's intended isolation; the10 affected create/admission cases and the full29-case suite then passed. No product change was needed for that environment failure.

Phase-one candidate run38910942014 passed at b39066181c01da4b06db687b3cc27d7e6ed290d9. Android candidate run38910942601 initially failed while downloading/unzipping the Google NDK, before native compilation. Its failed-job retry is tracked separately; this infrastructure failure is not classified as a passing APK build.

The failed-job Android retry succeeded: candidate APK0.0.120/code1120, source b390661, SHA-25696656f8d9eca1754726881a20ef78bdc7029bf2df81093b5a839dc0a225a5a63. Actual APK validation checked controlled certificate, package/ABI/version, required permissions, updater linkage and source/API identity. This candidate artifact is not the final main release. PR33 merged as0f9fcde; main production runs38913808883 and38913808919 are in progress.

## Client release gate failure and burst follow-up

Main0f9fcde passed all verification, backup/restore/migration and API runtime identity. API and mobile Pages deployed, but the expanded Cloud probe failed with LIVE_SMOKE_ROOM_AUDIENCE_FAILED; owned fixture cleanup succeeded. That generic code does not identify the failing room stage, so it is not evidence of a permission leak or of successful host/removal Cloud acceptance. The follow-up adds sanitized stage/elapsed/count diagnostics.

Source inspection found one database permission query for every protocol2 notification, including hundreds of duplicate projections produced by the bulk history fixture. This is a plausible Cloud latency/backlog cause and an unnecessary query amplification independently of the probe failure. The fix retains only each last identical scope/resource/kind notification within the bounded read before permission checks, preserves replay order and current authorization, and keeps v1 unchanged. Four focused tests passed, including a90-event burst with four distinct permission checks, distinct resources/kinds, replay positions, fresh permissions on a later read and exact legacy duplicate delivery. Expanded HTTP integration and new candidate/main CI follow.

Android0.0.121/code1121 built at0f9fcde with SHA-25621acddad4e4a7b7279de47addc8beff5264e4abbcc00cf8e777014e4038eddb6, but publication was correctly blocked by the failed admin Pages check. It was not published as the latest release.
