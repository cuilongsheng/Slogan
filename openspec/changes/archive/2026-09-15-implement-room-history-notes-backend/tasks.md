## 1. Data model and domain rules

- [x] 1.1 Verify the Room/RoomMembership/RoomReservation of the reservation change, the reporting history qualification and the seven-segment migration baseline, and indicate the actual revision, test number and unfinished boundary in the acceptance record.
- [x] 1.2 Added a unique RoomNote model and additive migration for one person, one room, using an empty library and an upgrade test including instant/reservation, each membership lifecycle, reservation, identity, report/event fixture to verify historical data and RESTRICT relationship retention.
- [x] 1.3 implements note text normalization, 2000 Unicode character upper limit, control character rejection and stable errors, covering whitespace clearing, boundary characters and illegal input with minimal unit tests.

## 2. Personal history query

- [x] 2.1 Implement the union query of membership/reservation limited by the current userId, prioritize PARTICIPATED in the same room and return the minimum projection of the user; use real PostgreSQL tests to cover the deduplication and isolation of BOOKED/CANCELLED/CONSUMED/EXPIRED and ACTIVE/LEFT/REMOVED/INVITED.
- [x] 2.2 Implement `(occurredAt,roomId)` deterministic reverse order cursor and limited paging, and verify no duplication and stable boundaries with simultaneous recording, cross-page insertion, illegal cursor and end-of-page tests.
- [x] 2.3 provides `GET /v1/me/room-history` to authenticate HTTP E2E verification only returns personal relationship, note existence flag and allowed fields, without revealing password, provider identity, other members/appointers, reports or note text.

## 3. Notes after private meeting

- [x] 3.1 Implement note reading qualification: only historical membership and Room is ENDING/ENDED; use integration test to verify that LEFT/REMOVED can still be read, only reservations/strange users are hidden uniformly, and SCHEDULED/OPEN is rejected.
- [x] 3.2 implements expectedVersion conditional saving and safe retry of the same content, and uses real PostgreSQL concurrency testing to verify that at most one different edit of the same version is successful, transaction failure is rolled back, and other user notes are not affected.
- [x] 3.3 Implement nullable tombstone clear and increment version to clear late save, repeated clear and never save version=0 test to verify that old content cannot be revived.
- [x] 3.4 provides `GET/PUT /v1/rooms/{roomId}/note` and generates a unique OpenAPI contract to verify personal authorization, status, version conflicts, content boundaries and response fields with HTTP E2E.

## 4. Regression and acceptance

- [x] 4.1 Use real PostgreSQL to complete the closed loop of "only reservation history → actual participation deduplication → room end → save/read/clear notes", return to real-time rooms, reservations, reporting qualifications and old APIs, and save desensitization evidence.
- [x] 4.2 Only run `pnpm verify:api`, `pnpm format:check` and `pnpm deps:check` once after all implementations are completed; if it fails, run the minimum failure range repair first, then rerun a complete check and record the accurate number of tests.
- [x] 4.3 Complete the acceptance, migration and rollback records against all delta scenarios, and perform OpenSpec strict verification; the front-end, product acceptance and deployment remain incomplete, and this change will not be recorded as AI/STT or production delivery.
