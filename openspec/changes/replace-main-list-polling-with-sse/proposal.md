## Why

Discover, Partners and Messages currently refetch every five seconds, while the global unread observer also polls. This delays updates, repeats unchanged queries and does not fix the separate Partners bug where an empty candidate scan still has a continuation cursor.

## What Changes

- Introduce one authenticated foreground SSE connection for room-list, partner-availability and actor-scoped conversation/unread invalidations. Keep existing authenticated queries as the authoritative snapshots.
- Remove the recurring list and unread timers after the stream path is verified. Keep presence lease renewal and existing room/call recovery outside this transport change.
- Deliver notifications across API/worker instances with durable publication and bounded replay/reset. Reconnect and requery after gaps; retain known data while offline and expose localized recovery feedback.
- Produce a deployment gate for the Vercel API and Pages proxy, including native streaming and account isolation checks. The owner explicitly authorized completing and deploying this change on 2026-10-15; retain the guarded production migration and release gates.

## Capabilities

### New Capabilities

- `main-page-live-updates`: Authenticated shared event delivery, scoped invalidations, bounded recovery and list completeness.

### Modified Capabilities

## Impact

- Architecture, Backend / API, Frontend, Test / Acceptance and Deployment.
- NestJS live-updates application/transport boundary; room, social, direct-message, profile/security mutation and recovery publishers; PostgreSQL outbox and existing Redis/managed queue infrastructure.
- The code-first generator remains authoritative for the sole `openapi/openapi.yaml`, followed by generated `packages/api-client`; add a streaming adapter without screen-owned URLs or DTOs.
- Mobile root provider and focused list/unread consumers; Pages streaming proxy headers and cancellation.
- Supersedes the five-second list/unread transport decision in the unarchived `streamline-main-pages-and-live-updates` change when approved and applied. Does not alter the invitation-picker timer, direct-chat/call transport, LiveKit, online eligibility, blocking, unread/read boundaries or public-trial rules.
- Independent startup, compact Me and Refresh geometry corrections are implemented separately against the owner's current Figma targets; they are not evidence that SSE exists.

## Non-goals and approval boundary

No WebSocket service, new hosting provider, offline push, message-content broadcast, or continuous audio worker. The owner approved implementation and deployment on 2026-10-15. Backend and proxy are released and verified first; the client transport cutover follows. Android device acceptance was explicitly accepted as a follow-up by the owner. Figma originals remain unchanged. Runtime streaming through the actual hosting chain is a release gate, not an assumed capability of the current deployment.
