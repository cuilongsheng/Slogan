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
