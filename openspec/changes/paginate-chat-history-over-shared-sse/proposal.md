## Why

The released client has one root SSE connection, but ChatScreen still polls messages and call history every three seconds, DirectCallObserver and RoomInvitationObserver poll every five seconds, room text polls every two to ten seconds, and room state/reports retain periodic queries. Chat initially walks oldest-first 50-item cursors instead of opening the latest visible history, causing excessive requests and poor long-conversation startup.

## What Changes

- Complete the existing authenticated mobile SSE endpoint as the single foreground event channel for current mobile business notifications; migrate remaining query observers individually, keeping their existing command, visibility and recovery semantics.
- Add typed, audience-scoped invalidations with optional opaque resource references so a chat can refresh its own history without every unrelated unread/read/profile event refetching it. Do not introduce chat-specific SSE connections or broadcast private content.
- Add a backward-compatible merged conversation timeline API: open the latest 20 visible entries, load older entries in pages of20 on upward scroll, and fetch only bounded newer changes after a revision watermark. Text and call entries share the20-entry page budget, matching their current mixed chat timeline.
- Coalesce repeated notifications and read acknowledgements; preserve history scroll anchors and loaded pages on refresh, network recovery and incoming messages.
- Include incoming calls, invitations, call state, room state/text/host alerts, profile/qualification/restrictions, report/appeal progress, private learning/history data and successful Android release availability in a publisher/consumer inventory. Keep outbound presence/voice leases, command retry and UI clocks distinct from change-detection queries.
- Preserve old message/call cursor endpoints and old client behavior during backend-first rollout. Negotiate protocol2 on the same SSE endpoint because the released parser rejects unknown event scopes; default connections retain exact legacy frames. Regenerate the single code-first OpenAPI contract.

## Capabilities

### New Capabilities

- `mobile-event-channel`: single foreground authenticated event-channel ownership, audience rules, complete notification inventory and event-driven consumers.
- `direct-chat-timeline`: latest-first initial20, older-history paging and independent incremental update recovery for the mixed conversation timeline.

### Modified Capabilities

- `main-page-live-updates`: allow minimal typed/resource-scoped private invalidations while preserving the existing endpoint, old main scopes, private isolation and recovery guarantees.

## Impact

API live-updates/direct/rooms/safety/moderation/learning modules and their transactional publishers; additive outbox envelope/index migration; mobile root provider and affected feature observers; API DTOs/generated client; managed recovery; release publication integration for Android availability. Current sessions and LiveKit media ownership remain unchanged. A session-authenticated but feature-ineligible user may receive only authorized self-service changes; this requires explicit scope authorization rather than the current blanket social-eligibility stream gate.

Existing app updates check GitHub metadata every six hours, including signed-out screens. The existing managed maintenance worker will reconcile only the fixed, verified public latest-release metadata and emit a change when its identity advances. Signed-out clients retain startup/foreground/manual metadata checks without a permanent unauthenticated stream. No new release-publisher credential or public write endpoint is introduced.

## Impacted delivery stages

- Architecture
- Backend / API
- Frontend
- Test / Acceptance
- Deployment

## Non-goals

No additional SSE connection per chat, binary/audio transport over SSE, background push service, new social relationships, changed moderation or room admission rules, client-wide server-data store, destructive data migration, or artificial periodic list polling inside SSE handlers. Retained provider SDK events manage media/device truth; product state invalidation is owned by the shared channel.
