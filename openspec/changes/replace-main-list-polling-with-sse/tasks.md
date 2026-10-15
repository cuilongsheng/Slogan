## 1. Architecture and compatibility

- [x] 1.1 Review the Level 2 design and reconcile the older five-second main-list/unread decision; verify the approved spec trace names all retained chat/call/invitation timers and the six new live-update requirements.
- [x] 1.2 Add code-first streaming event/response and recovery-cursor DTOs, authorization/qualification integration and transport limits; regenerate the sole OpenAPI/client and verify contract conformance and invalid input rejection.
- [ ] 1.3 Add the indexed transactional notification outbox migration and forward-repair rollback notes; verify upgrade against existing data, transaction rollback and idempotent event identity.

## 2. Event publication and delivery

- [ ] 2.1 Publish outbox invalidations for room creation, occupancy, host end, activation/expiry and recovery transitions; verify committed changes from separate API/worker instances notify room/partner observers and rolled-back changes do not.
- [x] 2.2 Publish precisely owner-scoped message/read/hide/call-history notifications and profile/security/block/occupancy availability changes; verify third-account isolation and existing unread/read/hidden boundaries.
- [x] 2.3 Implement atomic presence lease/version transitions and one generation-checked expiry job chain per actor using existing managed/persistent infrastructure; verify renew/expire races, expired actors, queue retries and loss of all original API instances without assuming keyspace notifications.
- [x] 2.4 Implement leased/idempotent outbox dispatch, bounded Redis Streams and opaque actor-bound recovery cursors; verify publish-after-commit failure, retries, duplicate/order tolerance, trimmed history and Redis reset.

## 3. Authenticated bounded streaming

- [x] 3.1 Implement SSE readiness/reset/replay, live scope delivery, bounded buffering and cancellation through a thin controller/application boundary; verify incremental delivery, slow-client reset and no list-query timer inside the handler.
- [x] 3.2 Integrate access-token expiry, 15s authorization leases, revocation and qualification checks with existing auth; verify expiry/revocation closes streams, denied reconnection and no tokens or private content in event IDs/logs.
- [ ] 3.3 Bound stream lifetime to 240s or the actual shorter token/runtime deadline, and verify emitted Vercel function configuration, renewal before timeout, stream headers, proxy flush and upstream abort in a local hosting-chain smoke check.

## 4. Mobile consumers

- [ ] 4.1 Add one root foreground streaming provider and generated-contract streaming adapter for browser/native, with jittered reconnect, account-generation fence and complete listener/timer/read cleanup; verify lifecycle and chunked UTF8/SSE decoding tests.
- [ ] 4.2 Replace only Discover/Partners/Messages/unread periodic requests with scope invalidation consumers; reuse request queues and preserve loaded cursor pages/rows; verify no recurring list/unread reads during an unchanged healthy stream and real focus/manual/event-driven refresh.
- [ ] 4.3 Preserve empty-scan continuation and distinguish true empty, denied, unavailable and reconnecting states with localized feedback; verify offline-page cursors, scan budgets, account switch and background late responses.
- [ ] 4.4 Compare original Figma and final running 390×844 screens for retained rows, reconnect/error and empty-with-continuation states; verify existing compact Refresh, profile navigation and unrelated chat/call/invitation behavior.

## 5. Acceptance and controlled release

- [ ] 5.1 Run one final affected-scope contract, migration, permission, publisher/dispatcher, streaming, mobile, browser, lint/typecheck/build and OpenSpec suite; record actual results and isolate unrelated/environment failures.
- [ ] 5.2 With explicit environment/release authorization, verify progressive delivery and cancellation through the actual Vercel API and Pages proxy, cross-instance publication, two-account plus third-account isolation, publish retry and lease renewal; record release commits and observed resource/latency evidence.
- [ ] 5.3 Verify Android/iOS streaming decode, foreground/background, network loss/recovery and account switch on target devices; record device evidence separately and keep rollout blocked if required delivery-chain/device checks are incomplete.
- [ ] 5.4 Execute the separately authorized backend-first/client-second guarded release and verify rollback to the prior client with retained business/outbox data; record production state without equating local acceptance with deployment.

## Owner acceptance decisions

- 2026-10-15: owner instructed completing all work and deployment in room-experience-release. Backend/proxy release precedes the client cutover.
- 2026-10-15: owner explicitly accepted Android device acceptance as a follow-up and instructed continuing deployment. iOS native acceptance is still under investigation; do not equate simulation/unit evidence with installed-device validation.
