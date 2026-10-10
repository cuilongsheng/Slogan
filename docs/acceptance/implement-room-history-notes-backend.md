# Room history and private notes backend acceptance record

## Range and Baseline

2026-09-14, `2687b1a30c90ee1b4abe5a768e28822153922b04` based on `develop` uncommitted workspace implementation. Front-end identity information, instant rooms, LiveKit, room host management, security reporting, and reservation room backends are all retained; the local acceptance baseline for reservation changes is seven-segment migration, 102 unit tests, 81 integration tests, and 46 HTTP E2E, for a total of 229 tests. LiveKit Cloud verification remains incomplete at the user's discretion, and this change does not rely on external providers.

## Implementation and Evidence

- `GET /v1/me/room-history` only generates history from the authenticated user's membership and reservation; when there is an actual membership in the same room, `PARTICIPATED` is given priority, only reservations are displayed as `RESERVED_ONLY`, and the `(occurredAt,roomId)` deterministic reverse order cursor is used.
- The historical response only returns the minimum projection of the relationship between the room and the person; it does not return the password summary, LiveKit identity, other members or appointments, report content and note text.
- `GET/PUT /v1/rooms/{roomId}/note` Only users with history membership of ENDING/ENDED rooms are allowed to access my notes. Only reservation-only and unrelated users will return to the historical context and do not exist. LEFT/REMOVED will not lose post-meeting qualifications.
- Only one RoomNote is reserved for one person per room. The first version is 1; save using `expectedVersion`, the same completion request can be safely retried, and only one of different concurrent edits can succeed.
- Blank input is written to nullable tombstone and incremented version, old requests after clearing cannot restore text. The application is limited to 2000 characters according to the Unicode code point and rejects illegal control characters. The database retains both length and version constraints.

### Directional evidence

- `test/unit/room-note.policy.spec.ts`: 11 policy tests covering whitespace clearing, Unicode boundaries, control characters, versions and room status.
- `test/integration/room-history-notes.spec.ts`: 6 real PostgreSQL tests covering each membership/reservation life cycle, room deduplication, stable paging, reservation to participation to note clearing closed loop, concurrent editing, idempotent retry, isolation and transaction rollback.
- `test/e2e/room-history-notes.e2e.spec.ts`: 4 authenticated HTTP tests covering three entry points, minimum response, personal isolation, qualification/status/version/content errors and unauthenticated requests.
- `test/integration/room-history-notes-migration.spec.ts`: 2 isolation schema scenarios covering empty database and eight-segment upgrade including instant/booked rooms, ACTIVE/LEFT/REMOVED, reservation, identity, report/event fixtures, validating old data, RESTRICT foreign keys and database constraint retention.
- `openapi/openapi.yaml` has generated the above three entries by NestJS code-first, and the second contract has not been maintained.

## Migration and rollback

Add `20260914000000_room_history_notes` without rewriting the first seven migrations or backfilling historical notes. The migration only adds the RoomNote table, unique index, query index, version/length constraints, and RESTRICT foreign keys pointing to Room and User; the complete eight-segment migration has been successfully applied to the local test database and two isolation schemas.

Let migration, repository/service and three entrances go online in the same batch when publishing. The old instance will not access the new table; when rolling back, first remove the three entries and retain the RoomNote table and data. Destructive down migration will not be performed, and subsequent repairs will be prioritized forward. Production migration or rollback was not performed.

## Verification status

Final `pnpm verify:api` PASS: 113 unit tests, 89 integration tests, 50 HTTP E2E, 252 in total; lint, typecheck, build and OpenAPI drift all passed. `pnpm deps:check` passed (194 modules / 651 dependencies), OpenSpec strict verification passed. `pnpm format:check` passed after this record was fixed.

## Unfinished boundary

The front-end history list and note interface, product acceptance, equipment verification and production deployment are not completed. This change does not include recording, STT, AI summary, keywords, public sharing, statistical active time or permanent retention commitment, nor does it describe local database and HTTP testing as production delivery.
