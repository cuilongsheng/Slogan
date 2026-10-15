## Context

See proposal.md for motivation. In this checkout, `useFocusedPolling` / `startForegroundPolling` drive Discover, Partners and Messages at 5s; `MessageUnreadProvider` has its own foreground observer. `LatestRequestQueue` serializes refreshes and the screens fence stale generations. `PresenceHeartbeat` renews Redis TTL independently. `SocialService.listAvailable` scans at most five database candidate pages; it can correctly return no rows with a non-null cursor. That independent rendering bug is being corrected separately.

The API is NestJS/Express on Vercel, with Redis/ioredis and managed maintenance/realtime queues. PostgreSQL owns room, security, message and read/hide facts. Current public API has no SSE contract. `CurrentAccessIdentity` exposes userId/sessionId, not credential expiry; stream authorization must consult the existing auth boundary instead of guessing a fixed token lifetime. The old `openapi/README.md` is historical; the current generator and release code use NestJS code-first output.

## Goals / Non-Goals

**Goals:** one foreground subscription, event-driven invalidations, correct cross-instance delivery, bounded recovery, immediate focus/manual revalidation, and no periodic main-list/unread HTTP reads.

**Non-Goals:** direct-chat/call or room-media transport redesign, invitation-picker timer removal, offline push, broadcasting private content, replacing Redis/hosting, or altering eligibility. Presence renewal and server maintenance are lease/recovery mechanisms, not substitutes for polling lists inside an SSE handler.

## Decisions

### 1. Push invalidations, preserve existing reads

Add an authenticated `GET /v1/me/live-updates` with `text/event-stream`, documented through NestJS Swagger and the sole generated OpenAPI. Events are ready/reset, rooms-changed, partners-changed and owner-specific messages-changed (including unread). Ready/reset force a snapshot. Events contain event ID and scope only; no actor IDs or private content are broadcast. A technical streaming adapter consumes the generated contract with response streaming; screens keep using existing generated clients. Reuse refresh queues/fences to coalesce bursts and retain pagination/rows. Sending full lists was rejected because it duplicates permission, filtering and cursor semantics.

The client provider owns one connection per logged-in eligible actor. Each focused page subscribes only to its scope. The unread consumer shares messages invalidations even when another tab is focused. Account/session generation, focus and app visibility invalidate old callbacks and abort pending stream reads. Manual refresh remains usable during a stream outage. No hidden fallback to 5s reads; show localized offline/reconnecting feedback without clearing last known data.

### 2. Durable publication and bounded recovery

Use a PostgreSQL outbox for persistent projection changes in the same transaction as business facts. A managed/persistent dispatcher publishes committed invalidations into bounded Redis Streams with a global public discovery stream and per-owner private stream. All connected API instances read those streams; an in-process Subject alone cannot cross Vercel instances. PostgreSQL AFTER triggers write scope-only outbox rows in the business transaction, including older compatible writers and recovery workers. The dispatcher uses transaction-held row locks with SKIP LOCKED as its fenced delivery lease; a Redis Lua identity marker makes republishing idempotent. It deletes acknowledged rows only after stream publication. API commands, managed realtime/maintenance jobs and a 15s active-stream recovery cadence retry failed publication. One shared blocking Redis reader per API instance multiplexes at most 128 active subscribers, filtering each private stream to its owner and reading at most 100 entries per key. Slow clients disconnect/reset rather than accumulate unbounded buffers.

Opaque compound recovery IDs cover public and owner stream positions without revealing another owner's stream keys. Validate cursor shape/length and bind recovery to the authenticated actor; reject forged scope/owner selection. Replay has bounded age/count/bytes. Gaps, trimmed entries or unavailable cursors return reset; existing HTTP snapshots restore truth. No event body is a permission grant. Establish subscriptions/replay boundaries before emitting ready so snapshot startup cannot miss an intervening mutation. Redis data loss uses reset, with recovery from persisted outbox and current snapshots; it never claims replay completeness.

### 3. Cover every projection publisher

Publish rooms/partners invalidations from room create/join/leave/end, scheduled activation/expiry and worker cleanup state transitions. Include profile eligibility, restrictions/expiry, blocking/unblocking and direct-call occupancy transitions. Publish private messages invalidations after send, personal read/hide changes and call history updates to precisely affected owners. Sending to all accounts was rejected because even empty private invalidations reveal unrelated activity.

Ephemeral presence uses an atomic Redis lease/version write plus durable notification scheduling; do not infer candidates online from reads. On a new or renewed lease, emit a partners invalidation only for an observable offline-to-online transition. Keep one idempotently scheduled expiry job per actor lease chain; at the current server expiry, recheck the generation/TTL and emit only a real expiry transition, or reschedule to the newer expiry. Existing managed queue/persistent worker executes this outside the request lifetime. Redis keyspace notifications are not assumed enabled and provider settings are not changed. Background expiry and first subscription/reset are covered even if every old API instance disappeared.

### 4. Authenticate the stream and renew it within hosting limits

Bearer authentication remains in headers, never URL parameters or logs. Use Expo's streaming fetch adapter for native; browser uses its streaming implementation with the existing origin policy. Revalidate session/qualification at connection setup, before private batches, and at bounded 15s authorization heartbeats. Close on credential expiry, revoked/disabled account, restriction or background. Heartbeat comments keep the transport live; they do not query main lists. Unknown initial native AppState follows the current foreground helper.

Use a maximum 240s stream lease, shortened by the actual access-token expiry and runtime deadline. Emit renewal/close before termination and reconnect with jittered bounded exponential backoff, resetting backoff after a healthy ready event. Renew/authenticate through the existing session refresh path; avoid authorization refresh races. The dedicated `api/live-updates.ts` hosting adapter forwards `/v1/me/live-updates` to the same Nest controller and guards and awaits response completion/cancellation. This gives the actual stream function an explicit 300s duration and cancellation configuration: the backend auto-entry `src/main.ts` is not a valid `functions` glob in the existing project. Inspect emitted Vercel function configuration to ensure this lease is supported; if the actual runtime deadline is shorter, shorten the lease and test the emitted artifact rather than assuming Fluid Compute settings.

Official platform references: [Vercel streaming](https://vercel.com/docs/functions/streaming-functions), [duration limits](https://vercel.com/docs/functions/configuring-functions/duration), [Expo 57 streaming fetch](https://docs.expo.dev/versions/v57.0.0/sdk/expo/). These describe capabilities, not verified production settings. Verify `Cache-Control: no-cache, no-transform`, progressive flush, proxy response-body forwarding, abort propagation, CORS and no compression/buffering through the actual API/Pages chain. Do not use waitUntil as ownership of an open response.

### 5. Separate visual correction and streaming acceptance

Original Figma 56nIowZmvBhb0QJvOlDQdU / 02 UI: login118:2970, loading206:2879, Me152:1467, empty Partners206:3032, populated lists217:3386/218:3449, all390x844. Existing logo/assets and compact controls remain. Keep error feedback localized and co-located with the existing empty/error state; do not redesign the page to explain infrastructure. Original-to-runtime captures cover initial, retained rows while reconnecting, true empty, empty-with-continuation and denied/error states. Native lifecycle/decoder evidence is separate from web fixtures.

## Risks / Trade-offs

- [Outbox introduces schema/write paths] → Additive indexed table, idempotent dispatch, transaction rollback and worker/crash tests; include every publisher explicitly before changing the client.
- [Presence churn and expiry jobs increase coordination cost] → Emit only effective transitions, retain one expiry chain per actor and test renew/expire races and offline API instances.
- [Stream resources and connection churn on serverless] → Single root connection, bounded leases/replay/backpressure, shared instance readers, cancellation and measured cloud delivery latency before rollout. Billing is provider usage evidence and is not inferred from a smoke test.
- [Revocation between authorization checks] → Header credential expiry fence plus a 15s authorization lease; no private content on events and all reads/writes independently authorize. Verify revocation timing.
- [Notification retries reorder events] → Events only invalidate; snapshots use durable state and refresh generations, with duplicate-safe IDs.
- [Publisher missing a recovery path] → Trace every affected mutation/worker transition; an SSE response driven by timed list queries does not meet this design.

## Migration Plan

1. Review this Level 2 design and reconcile the older unarchived 5s requirements. Create the additive outbox migration with recovery/index tests. Keep old clients unchanged.
2. Implement backend publishers, dispatcher, presence expiry scheduling and authenticated SSE; regenerate OpenAPI/client. Verify cross-instance, commit/publish failure, gaps, private isolation and revocation before mobile cutover.
3. Verify local progressive streaming/cancellation and emitted Vercel artifacts, then an explicitly authorized isolated cloud path through Pages/API and native clients. Release remains blocked if that chain buffers or the deadline is unsupported.
4. Implement the provider and replace only Discover/Partners/Messages/unread timers. Verify no scheduled list reads, retained pagination, foreground/account fences and reset recovery. Keep unrelated call/chat/invitation behavior.
5. Publish backend first, client second under the guarded release process only when authorized. Track cloud/native acceptance and release commit separately.
6. Roll back the client release to the existing polling implementation if required; do not silently enable polling inside the new client. Stop new event delivery after connections drain, retain the outbox table/business data, and use forward repair rather than destructive down-migration.
