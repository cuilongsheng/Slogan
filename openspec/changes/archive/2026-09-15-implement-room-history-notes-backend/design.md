## Context

See [proposal.md](./proposal.md) for motivation and scope, and [spec.md](./specs/room-history-notes/spec.md) for observable behavior. The current instant room creation generates host membership, and the actual joining reserves one membership for each `(roomId,userId)`; the reserved room also has RoomReservation, and it is converted to CONSUMED when actually joining. The two can already distinguish between "actual participation" and "appointment only". Room, membership and reservation are all PostgreSQL persistent facts and do not require additional replication of historical snapshots.

The existing reporting qualifications are also based on historical membership, proving that life cycles such as LEFT and REMOVED will not erase the actual participation facts. New capabilities must maintain this meaning while avoiding historical queries that reveal other members, bookers, password digests, provider identities, or reported content.

## Goals / Non-Goals

**Goals:** Query personal room history through stable cursors; use independent persistent records to save personal notes for each person and room; ensure that concurrent editing within database transactions will not overwrite newer content.

**Non-Goals:** does not create a universal activity stream, full-text search, historical snapshot repository, or content collaboration system; does not automatically generate notes from audio, transcripts, reports, or RoomEvents.

## Decisions

### 1. History is the projection of existing relationships

History query with union of RoomMembership and RoomReservation as candidate, qualifying all rows on the server side with `userId`. If the same user both makes a reservation and actually participates, only one item is returned for the same room, relationship=PARTICIPATED; otherwise, it is RESERVED_ONLY, and the reservation status of the user is returned. The actual participating sorting time uses membership.joinedAt, and only reservations use reservation.bookedAt. Then roomId is used as the stable order, and the cursor encodes these two values.

Returns roomId, kind, topic, CEFR, planned/actual start and end time, current room status, personal relationship, membership lifecycle/role or reservation status, and whether the personal note exists. Password digests, provider IDs, other members/subscribers, reports or note content will not be returned. The text of the note is only read by the single room details entrance to avoid the expansion of sensitive content and response bodies in the history list.

The alternative is to write a RoomHistory snapshot, but this copies data that can be deduced from the persistent relationship and introduces room state synchronization issues; there is currently no approved behavior for deleting a Room or modifying the history title, so it is not adopted.

### 2. Standalone RoomNote reserved version fence

Added RoomNote: id, roomId, userId, nullable content, version, createdAt, updatedAt, and are unique with `(roomId,userId)`. Both roomId and userId use RESTRICT foreign keys so that notes do not lose owner or room context by clearing membership. Database constraints ensure that version>0, content is null or the length does not exceed 2000 characters; the application layer counts Unicode code points and rejects control characters, and only blank input is normalized to be cleared.

GET returns `{content:null, version:0, updatedAt:null}` when no record exists. PUT accepted `{content, expectedVersion}`: expectedVersion=0 for the first time; subsequent versions must match the current version and increment within the same transaction. Flushing does not delete the line, but instead sets content=null and increments the version, ensuring that late requests before flushing cannot resurrect old text. Completion requests with the same expectedVersion can be safely retried according to the saved content; different content or versions return stable conflicts.

The alternative of directly overwriting or physically deleting empty notes will lose the concurrency fence and cannot prevent old clients from writing back, so it is not used. The note is not associated with a membershipId because actual participation eligibility is proven by a unique `(roomId,userId)` membership query, and membership lifecycle changes should not change private note ownership.

### 3. Write qualification and status boundaries

Both history reading and note entry derive the principal from the authentication userId and do not accept the target userId. Note GET/PUT requires actual membership to exist; RoomReservation alone does not qualify. The room must be ENDING or ENDED to allow reading and writing, so that "post-meeting notes" will not evolve into text chat in the room. LEFT, REMOVED, or role changes do not undo the fact that participation has occurred, nor do they allow access to other people's notes.

Use HISTORY_CONTEXT_NOT_FOUND uniformly for non-existent rooms, missing memberships and other people's resources to reduce resource enumeration information. The room is still SCHEDULED/OPEN returns ROOM_NOT_ENDED; illegal text returns VALIDATION_FAILED; version mismatch returns NOTE_VERSION_CONFLICT. All authorization and version judgments and upsert share database transactions.

### 4. HTTP and unique contract

Added three new Bearer entries:

| Endpoint                    | Behavior                                                                                                  |
| --------------------------- | --------------------------------------------------------------------------------------------------------- |
| GET /v1/me/room-history     | `cursor/limit` returns the actual participation and reservation-only history after de-duplication by page |
| GET /v1/rooms/{roomId}/note | Returns my post-meeting notes; returns empty content and version=0 if never saved                         |
| PUT /v1/rooms/{roomId}/note | Save or clear my notes, content and expectedVersion required                                              |

Use NestJS code-first DTO/decorator to generate unique `openapi/openapi.yaml`. No handwriting of the second contract, no new front-end exclusive type; subsequent clients are generated from the contract.

## Risks / Trade-offs

- [Risk] The union of membership and reservation causes duplication, page skipping or missing pages → Press room on the database side to deduplicate and define the relationship priority, use `(occurredAt,roomId)` as a deterministic reverse order cursor; use cross-page concurrent insertion to test the fixed boundary.
- [Risk] Query leaks other user information → repository All candidates are first bound to the current userId, DTO uses an explicit whitelist, and HTTP test verification has no password, identity, other members, and other people's note fields.
- [Risk] Old text resurrected after two devices overwrite note or clear → Row lock/conditional update combined with expectedVersion, preserve nullable tombstone rows, and verify concurrent writes and late replay.
- [Risk] There is currently no approved historical display period → This change does not add a new retention or automatic deletion policy. The acceptance clearly states that this is the query capability of the records available in the current database, and does not promise permanent storage.
- [Trade-off] Allow reading notes only after ENDING/ENDED → The boundaries are simple and consistent with the "after-meeting" positioning. The interface cannot be used as a text chat while the room is in progress.

## Migration Plan

1. Add a separate RoomNote model and additive migration; do not rewrite the first seven migrations, and do not backfill historical notes.
2. Completely upgrade the empty library, and upgrade fixtures including instant/reservation rooms, various memberships, reservations, identities, reports, and events, confirming that historical relationships, reporting foreign keys, and old APIs remain unchanged.
3. Deploying schema, history/note repository, service and three endpoints in the same batch; the old instance ignoring the new table will not disrupt the room operation, but the new endpoint is only routed to the new instance.
4. When rolling back, remove the new entry first and retain the RoomNote data and new tables; do not perform destructive down migration and give priority to forward fix.

## Verification and Acceptance

- Unit tests cover text normalization, Unicode length, status and eligibility rules, cursor parsing, and stable errors.
- PostgreSQL integration tests cover membership/reservation deduplication, different lifecycles, paging stability, concurrent writes, idempotent retries, clearing tombstones, and transaction rollback.
- HTTP E2E covers three entrances, personal isolation, reservation-only refusal to write notes, field minimization and unique OpenAPI contract.
- Only run the complete `pnpm verify:api` once after the implementation is completed, and then run the format and dependency boundary checks; this change has no external provider, device or Cloud verification requirements, and the front-end and product acceptance are kept separately.
