## Context

See proposal.md. RootLayout observes direct calls but not room invitations. Incoming invitations are reachable only through SocialScreen. RoomControls stores sent targets in component state and exposes a receipt only until its unmount. Existing Prisma tables already persist invitations, reports and safety case states; no new storage model is needed.

## Goals / Non-Goals

Provide a complete foreground invitation loop and reporter-owned history while preserving current admission, moderation and account rules. Exclude background OS push, automatic room replacement, internal case details and changes to authentication/session issuance.

## Decisions

1. Use the existing foreground polling infrastructure at the root, account-fenced, with a bounded pending-invitation queue. A main-page dialog has Join, Decline and close; closing exposes a small invitation entry for reopening. Polling never steals an active room/call screen. Join calls beginDirect(roomId, invitationId) and navigates to the existing session route; scheduled invitations use existing room detail instead of attempting immediate admission.
2. Add `GET /v1/rooms/{roomId}/invitations` for the current host's pending records. Check host and room identity inside the repository transaction; return bounded cursor pages with minimal existing invitation DTOs. RoomControls refreshes this state with candidates and preserves confirmed sends while overlapping pre-send reads finish. Do not persist target lists in unencrypted device storage or guess sent state after app restart.
3. Add `GET /v1/me/reports` in moderation, deriving reporter identity solely from the access identity. Use an explicit Prisma select for receipt, room topic, category, timestamps and case status. Never select or serialize description, original message content, notes, assignment or sanctions. Map missing legacy cases to received without inventing a decision. Paginate by submittedAt/id with a capability-specific validated cursor.
4. NestJS decorators generate the single OpenAPI contract, followed by generated API-client output. Existing endpoints remain compatible. No schema migration, credential or provider configuration change is required.
5. Add a reporting feature with foreground-refreshed history and a compact shared confirmation used by room and direct-message submissions. Use actual DTO-derived status enums and localize their labels. Failures retain drafts and retry IDs.
6. Figma access is Desktop Bridge only. Preserve originals; capture source frames 186:2348, 186:2369, 152:1467 and 111:882/190:2529. The owner explicitly overrides title size and Me layout. New invite/history/receipt states reuse the existing light page, dark sheet, Noto Sans SC styles and buttons; store editable design variants separately.

## Risks / Trade-offs

- Foreground polling has up to one polling interval of latency → use immediate activation/focus polling, bounded requests and no overlapping reads; do not claim background push delivery.
- Account change or late response leaks another account's dialog → fence all reads and commands by account/lifecycle and clear queues on logout.
- Dismissal hides a still-valid invite → retain an accessible pending entry; server decline is a separate explicit action.
- Sender stale refresh erases successful sent state → merge confirmed sends until a later authoritative read started after command completion; retain in-flight guards and server deduplication.
- New read APIs disclose sensitive relationships/case details → enforce current-host/reporter ownership and test cross-account requests; strict projections exclude internal fields.
- Several pending invites or calls interrupt one another → suppress automatic invitation dialogs outside main pages and preserve queued invites, while direct-call handling retains precedence.
- Bounded report history queries use existing data; measure representative fixture behavior rather than claiming untested large-volume performance.

## Migration Plan

Verify OpenAPI/client generation, targeted PostgreSQL/HTTP ownership and state tests, mobile hooks/forms, routed two-session invitation/report flows and comparable visual captures. Run affected-scope verification once after fixes. Merge to main and use existing guarded backup/restore/API/Pages/APK gates. Rollback to the preceding compatible API/web clients if needed; publish Android with a higher version code rather than downgrading. Physical Android rendering and background notifications are separate evidence boundaries.

## Latest owner visual directions

Discover retains a centered heading at y=47, with the filter/count/burst/create toolbar below it and the first card at y=142 (390pt web reference). Me retains its heading and existing avatar, display name and language controls beneath it. Menu labels align left; My reports remains available. All standalone large page actions use a shared 342×46 geometry, centered with a maximum width of 342 and responsive shrinkage; 390pt page layouts keep 24pt outer margins. Compact row actions and paired controls retain their distinct sizes.
