## 1. Data and shared capacity

- [x] 1.1 Verify the pre-six-segment migration with the rooms/voice public entry, and list the actual baseline and Cloud reservations in the acceptance record.
- [x] 1.2 Add the additive migration of reservation type, status, first room host mark and independent RoomReservation, and verify the original real-time room and report history retention through empty database and historical data upgrade tests.
- [x] 1.3 Unify the seat budgets of ACTIVE and unused reservations in the Room row lock, and verify that there is no seat grabbing or double counting through the last seat concurrent reservation, ordinary join, re-entry and invitation check.

## 2. Reservation business and API

- [x] 2.1 Implement creation, paging discovery and personal details. The creator takes a seat but does not create membership; verify by date, qualification, password and privacy test.
- [x] 2.2 Implement reservation, versioned cancellation and re-appointment, and verify that the seat and version are consistent through replay, late old requests and transaction rollback testing.
- [x] 2.3 Implement the entire room cancellation and reservation invalidation before the start, and test and verify with permission, repeated cancellation and start boundary competition.
- [x] 2.4 Access the actual join reservation atomic consumption and role determination, retain the reservation through failure, be late, the old room host is MEMBER, the reservation cannot obtain token, or report test verification.
- [x] 2.5 provides six reservation HTTP entries and stable errors in the design, generating a unique OpenAPI; verified with HTTP authentication, field verification and contract check.

## 3. Time and room host life cycle

- [x] 3.1 Achieve unified time settlement: first expire and end, then open; test and verify with 1 millisecond before and after the start/end, shutdown across the entire period and recovery on request.
- [x] 3.2 Achieve full 5 minutes. If the room host is absent for the first time, the earliest online member will take over. It is compatible with the old room host without membership. It is verified by not connecting to the media for the first time, being disconnected after arriving, late events and role audit tests.
- [x] 3.3 Achieve the end of the current vacancy after 5 minutes, and then end when the last person leaves/remove/disconnect; use the boundary, it will be empty after being online, the room host will be empty after arriving on time, and it will not wait for an additional 60 seconds for test verification.
- [x] Expire the reservation at the end of 3.4 and reuse revoke/delete; only directly ENDED when there is no provider/identity history, and verify through failed recovery and old token/event cannot be revived test.
- [x] 3.5 reuses existing queues and database recovery scans, adds start and 5-minute checks; verifies that business time does not depend on Cloud based on lost tasks, restarts, repeated tasks, Redis unavailability and REALTIME_ENABLED=false scenarios.

## 4. Comprehensive verification and delivery

- [x] 4.1 Use real PostgreSQL/Redis and local fake provider to verify reservation to actual session closed loop, return to real-time room, room host management, reporting and identity history, and save desensitization evidence.
- [x] 4.2 After all implementations are completed, run pnpm verify:api, pnpm format:check, and pnpm deps:check to record the accurate results and quantities; if they fail, perform directed repair first, and then perform final verification.
- [x] 4.3 Complete the acceptance record and migration/rollback instructions against the delta scenario, and pass strict OpenSpec verification; the unexecuted front-end, equipment, Cloud and deployment are clearly left unfinished.
- [ ] 4.4 Verify actual connection, 5-minute takeover, end of vacancy, and scheduled end cleanup in isolated LiveKit Cloud; without configuration, this item is left unfinished at the user's discretion and does not need to be replaced by a local fake provider.
