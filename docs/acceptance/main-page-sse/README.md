# Main-page SSE acceptance

2026-10-15, room-experience-release. Owner authorized completing and deploying the change. Release is staged: backend/proxy and cloud verification first, then mobile cutover. Android native acceptance is explicitly deferred by the owner. iOS native acceptance is pending; simulator startup alone is not device acceptance.

## Backend implementation

PostgreSQL AFTER triggers enqueue scope-only invalidations atomically with mutations. They cover Room, RoomMembership, User, UserProfile, SafetyRestriction, UserBlock, DirectConversation, DirectConversationMember, DirectMessage, DirectCall and DirectCallOccupancy, including compatible older writers and recovery workers. Room-membership credential/heartbeat-only changes and direct-call heartbeat-only changes do not generate list churn. Personal read/hide changes notify their owner; messages and call/history changes notify conversation participants. Profile/security changes also invalidate affected participants' existing projections.

The dispatcher locks at most 100 rows with `FOR UPDATE SKIP LOCKED`, publishes using a Redis Lua identity marker, then acknowledges within the same PostgreSQL transaction. Failed publication leaves rows for retry. HTTP commands and managed realtime/maintenance jobs dispatch after successful writes; active streams recover pending notifications at 15s, without querying lists. Managed presence expiry uses an actor chain token and Redis TTL recheck; stale tasks cannot clear a renewed chain. A Redis expiry index supports recovery when the original instances disappear.

Each API instance multiplexes one blocking Redis connection, capped at 128 subscribers, with at most 100 events per stream key per batch. Public scopes are rooms/partners; messages only fan out from the authenticated owner's key. Redis streams retain approximately 1000 entries with a one-hour TTL. Signed cursors bind both stream offsets to the actor, expire after 15 minutes and reset on retained-history gaps. Stream leases are at most 240 seconds and end before actual token expiry. Authorization is rechecked before changed batches and within 15 seconds; slow clients disconnect rather than accumulate buffers.

## Evidence and boundaries

- API unit: 45 suites / 243 tests passed before final transport-only refactoring.
- API integration: 43 suites / 225 tests passed; the final dedicated SSE suite adds explicit token-expiry coverage and is recorded separately below.
- API end-to-end: 20 suites / 110 tests passed.
- API runtime: 8 suites / 15 tests passed. Existing Jest open-handle warning was emitted; command completed successfully.
- PostgreSQL/Redis/HTTP dedicated SSE coverage: separate Nest instances, participant/third-account isolation, invalid/foreign cursors, transaction rollback, failed Redis publication retaining the outbox, presence expiry/renewed-chain fencing, lost stream history, revocation and short token expiry.
- Pages protocol test: progressive chunks, no-transform/no content-length, cancellation after headers and downstream reader cancellation.
- Local authenticated smoke uses normal password login and three script-owned accounts. It does not read owner credentials or provider secrets. The initial direct API run observed reset in 21–33ms and private invalidations in 88–89ms; these are local timings, not cloud latency or Pages measurements. Cleanup succeeded.
- Cloud acceptance is executed by `scripts/release/live-stream-smoke.mjs` after guarded API migration/deployment and matching Pages publication. It checks both hosting paths, participants and outsider, foreign cursor rejection, revocation, recovery, abort and full bounded-lease renewal. Only the cloud receipt establishes production delivery.

The first root test attempt lost a generated Prisma source while a concurrent build regenerated that directory. The API integration suite was rerun sequentially and passed. No baseline failure is relabeled as a pass.

## Migration and rollback

The outbox table/functions/triggers are additive. Production follows encrypted backup, isolated restore and candidate schema upgrade before the approved main database migration. Keep previous clients compatible. Roll back client assets to the prior polling release if required; retain business data and the additive outbox schema. Repair publication forward; do not drop notification tables or erase committed state. Physical-device behavior and provider billing require separate evidence.

The first Vercel preview rejected `functions["src/main.ts"]` as `unused_function`. Corrected by routing only the SSE path through a real `api/live-updates.ts` function, configured for 300 seconds and cancellation, forwarding to the unchanged Nest auth/controller boundary. The failed preview never changed production.

## Mobile cutover evidence

- One root foreground connection serves Discover, Partners, Messages and unread. Focus/manual/reset/scope events revalidate authenticated snapshots; healthy unchanged streams do not schedule periodic list reads. Existing chat/call/invitation timers and online heartbeats remain.
- Background and account transitions abort old reads and fence late events. Pagination responses carry the same lifecycle fence; invalidations arriving during an active partner/message pagination request are deferred and revalidated after it completes.
- Full mobile tests: 65 suites / 244 tests; startup tests verify fast restore, font readiness and a fresh delay for later restorations. The additional targeted renewal regression verifies that a normal stream lease rotation never falsely displays outage feedback.
- Final visual harness: 52 tests passed, including unchanged-list HTTP request counts, retained rows during reconnection and invalidation during pagination. New captures: [reconnecting](runtime/partners-reconnecting.png), [retained pages](runtime/partners-retained-pages.png), Chromium 390×844, light theme, bundled Noto Sans SC.
- Original Figma targets and direct source/runtime comparison for startup/Me/compact Refresh remain in [mobile correction acceptance](../mobile-startup-empty-fix/README.md). Healthy row controls retain previous approved behavior. The new localized reconnect notice adds only outage feedback; no whole-frame 1:1 claim is made for this new state.
- Browser run: 29 passed before final startup refinements. A later parallel run produced two RootLayout font network/OTS failures in Metro; both create-page cases passed a sequential rerun. Final two-worker full rerun passed all 29 browser tests. iOS bundle export also passed.
- Native verification remains a disclosed follow-up. After the Android waiver and disclosure of the unavailable Simulator graphical control, the owner instructed continuing. No installed iOS/Android lifecycle or streaming result is claimed.

Additional final UI evidence: both 403 access denial and 503 dependency failure display distinct localized feedback, retain a retry action and are not treated as a successful empty list. Captures: [denied](runtime/partners-403.png), [unavailable](runtime/partners-503.png). Final dedicated publisher/stream suite: 9 tests passed, including cross-instance room lifecycle writes.

Backend main verification initially stopped on an existing room-history fixture race: two separate Date.now() calls sometimes violated the exact five-minute appointment deadline check by 1ms. The fixture now derives both timestamps from one instant. This is a test correction, not a relaxation of the database constraint. No production migration ran on the failed attempt.

## Backend production receipt

Backend PR #29 merged as `2ddd42f6142d266dd56e8331251065b329e7d47a`. Guarded release run `38703028513`, attempt 2, verified encrypted backup, isolated restore/schema upgrade, additive production migration and deployed-commit identity before the cloud smoke. The initial Pages build exhausted its API-wait budget while the first CI attempt failed; the admin deployment was retried after API readiness.

At 2026-10-15 08:25:52 UTC the real API/Pages smoke returned SUCCEEDED: progressive API and Pages delivery, participant notifications, third-account isolation, foreign-cursor rejection, session revocation, reset recovery, client abort and bounded lease renewal. Observed reset latency was 1503ms for API and 367–603ms for Pages; message invalidation was 769ms for API and 758ms for Pages; Pages lease renewal occurred at 240464ms. These are one smoke sample, not a latency SLA or load/cost measurement. Owned fixture cleanup returned SUCCEEDED at 08:25:55 UTC. Cross-instance writers and failed-publication retry remain covered by the separate PostgreSQL/Redis integration tests, not this cloud sample. Client cutover follows this receipt; final deployment state belongs in docs/releases.
