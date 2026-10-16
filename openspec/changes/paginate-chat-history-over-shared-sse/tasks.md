## 1. Scope and delivery inventory

- [x] 1.1 Review the Level2 proposal, three capability deltas, audience matrix and latest20 mixed-entry choice; verify the approved scope reconciles earlier retained chat/call/invitation polling and records current release/device authorization separately.
- [x] 1.2 Record every current timer consumer from the design as migrate, outbound lease, media/device callback, UI clock or bounded retry; verify a source inventory includes ChatScreen, both global observers, CallScreen, room messages/state/invite picker, MyReportsScreen and AppUpdateProvider.

## 2. Shared event protocol and authorization

- [x] 2.1 Add protocol2 negotiation on the existing endpoint, typed event kinds and optional opaque resource references; regenerate the single OpenAPI/client and verify exact default/v1 frames against the released parser, protocol-bound cursor isolation, new-parser unknown-kind tolerance, recovery ID advancement and invalid envelope rejection.
- [x] 2.2 Add a forward-only outbox envelope/constraint/index migration without rewriting the deployed migration; verify upgrade over existing rows, rollback-safe transaction publication, idempotent dispatch and retained old-client events.
- [x] 2.3 Replace blanket social stream eligibility with explicit topic authorization and root authenticated-account ownership; verify permitted self-service updates for restricted actors, denied social topics, trial exclusion, session revocation and third-account/host-role/membership isolation.
- [x] 2.4 Extend root subscriptions with resource filtering, burst coalescing and pending-work retention; verify one active connection across all mounted consumers, no lost invalidation during in-flight reads, account/background fencing and no timer-based query fallback.

## 3. Transactional publishers

- [x] 3.1 Publish distinct conversation-history/state, inbox/unread and calls changes from text, read/hide, call lifecycle, peer eligibility and managed expiry/recovery; verify participant-only delivery and no history notification for read-only or heartbeat-only mutations.
- [x] 3.2 Publish invitation create/resolve and eligibility/lifecycle invalidations to the recipient and authorized host; verify ordinary/re-invitation, password/capacity and dismissed-dialog semantics remain unchanged.
- [x] 3.3 Publish room lifecycle/membership/role/settings/extension/consent and room-text changes from API/admin/worker paths; verify member removal/end reaches the affected actor without subsequent room text or credential disclosure.
- [x] 3.4 Publish host-only safety alert changes and own profile/restriction/appeal/report progress; verify current-host, former-host, unrelated reporter and internal-case-only negative scenarios, including restricted-account self-service delivery.
- [x] 3.5 Publish own history/notes/vocabulary and entitled summary readiness/failure changes; verify current read permissions and no events for job lease, retry-attempt or no-op churn.
- [x] 3.6 Add fixed-public-release metadata reconciliation to the existing managed maintenance path with one distributed five-minute lease; verify monotonic verified release identity, duplicate/no-op suppression, provider failure recovery and no per-client metadata loop or new public write credential.

## 4. Additive chat timeline contract

- [x] 4.1 Add the layered merged timeline endpoint and generated discriminated DTOs for latest/before/after modes with a20-entry maximum; verify invalid combined modes, participant authorization and unchanged legacy messages/calls cursor behavior.
- [x] 4.2 Implement latest20 and older20 queries using stable creation ordering and owner/conversation/direction-bound cursors; verify65-plus mixed entries, equal-time ordering, explicit exhaustion, foreign cursor rejection and personal hide boundaries.
- [x] 4.3 Implement consistent revision high-watermark reads and20-entry incremental continuation using text sequence/call stateSequence; verify snapshot/write races,20-plus missed changes, empty delta termination and updates to old call entries without history duplication.
- [x] 4.4 Add supporting indexes only where representative query plans require them; verify bounded query results and EXPLAIN/upgrade evidence on a large deterministic history fixture.

## 5. Mobile chat behavior

- [x] 5.1 Replace chat polling and paired50-item queries with the feature-owned timeline state and shared resource subscriptions; verify initial entry fetches only latest20 and no idle3s history/detail reads or automatic older-page traversal occur.
- [x] 5.2 Implement upward20-entry loading with virtualized anchor preservation and localized loading/exhaustion/retry states; verify repeated edge callbacks, concurrent incoming updates, retained history and no forced jump while reading older content.
- [x] 5.3 Separate older cursor, sync watermark, pending-send merge and lifecycle generations; verify echoed/duplicate/reordered changes, hide/page races, account switching and late send responses cannot duplicate or resurrect content.
- [x] 5.4 Coalesce text read acknowledgements and unread invalidations without history refetch loops; verify focused/foreground/actually visible text only, no call-based read advancement, one reconciliation per burst and a queued follow-up when new data arrives during a read.

## 6. Remaining mobile consumers

- [x] 6.1 Migrate incoming-call detection, call state, global invitations and open invitation candidate picker to the shared channel; verify prompt actionable updates, preserved dismissal/acceptance controls and no5s query timers.
- [x] 6.2 Migrate room text and room state/safety observers, preserving media/device callbacks and outbound leases; verify no2–10s text or15s room-state query timers and removal/end/role updates work without useful media callbacks.
- [x] 6.3 Migrate report/profile/restriction/appeal/learning/history observers and signed-in update availability; verify only affected focused projections refresh, signed-out update checks remain event/entry/manual based, and installation trust/safe-page deferral is retained.

## 7. Acceptance and release

- [x] 7.1 Use project figma-to-frontend and the connected Desktop Bridge to confirm original chat/call targets and capture source/runtime states at390×844; verify retained compact UI, initial latest end, prepended history anchor, reconnect and retry states without an extra toolbar or connection.
- [ ] 7.2 Run owned-fixture protocol2 API/Pages progressive streaming plus default/v1 coexistence, authorization, participant/outsider/current-host/removed-member, reset, cancel and full renewal checks; verify all publishers across instances and record cleanup/resource/backlog evidence separately from integration-only retry tests.
- [x] 7.3 Run Android/iOS native decoding, background/resume/account switch, long-chat prepend/keyboard and two-client update acceptance; record actual device evidence or explicit current-scope follow-up acceptance, without automatically reusing the earlier waiver.
- [x] 7.4 Run one final affected lint/type/boundary/contract/migration/publisher/mobile/browser/visual/build/OpenSpec suite and network request-count acceptance; verify one SSE and no idle product-change query polling while retaining outbound heartbeat and command traffic.
- [ ] 7.5 Sync approved specs and record backend-first/client-second release readiness; under applicable owner deployment authorization run guarded release, verify actual API/Pages/APK commit/hash and rollback compatibility, retaining additive data/schema and explicit device limits.
