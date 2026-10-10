## Why

Actual membership and reservation records have been retained for instant and reserved rooms, but users cannot yet query their participation history or leave private reviews. To complete the V1 backend, we first deliver history and handwritten notes that do not rely on STT/AI.

## What Changes

- Added paginated query of personal room/reservation history to distinguish between actual participation and reservation only, without disguising reservation as room check-in fact.
- Provides reading, versioning, saving and clearing of private text notes for rooms that I actually participated in and ended.
- Reuse Room, RoomMembership, RoomReservation; do not copy historical snapshots, save audio or transcribe.

### Confirmed Scope

Users requested to complete the missing backend of V1; history and simple post-meeting notes belong to the subsequent V1 roadmap. This change is an independent delivery within this scope and does not modify the instant/appointment joining or reporting rules.

### Proposed Details

History default paging queries the personal records retained in the current database, without adding automatic deletion or artificial hiding period; this is not a permanent retention commitment. One note is for one person per room, and the maximum length of plain text is 2000 characters. It can only be edited when you have actually participated and the room has entered ENDING/ENDED; use expectedVersion to avoid multi-end overwriting, empty text is cleared but the version fence is retained. History does not expose other member lists.

### Non-goals

Does not do automatic keywords, STT, AI summary, public sharing, statistical active time, front-end, back-end query or deployment. Users whose reservations are only placeholders are not allowed to write actual post-meeting notes.

### Unresolved Decisions

The historical product display cycle has not yet been independently determined. This time, existing data will be retained for paging retrieval, and no new deletion strategy will be added. If a time limit is set in the future, it must be independently confirmed. Other rules are based on the above minimum private review plan for review.

## Capabilities

### New Capabilities

- `room-history-notes`: Personal participation/appointment history and private meeting notes.

### Modified Capabilities

None.

## Impact

- Backend / API、Test / Acceptance。
- Added RoomNote and corresponding unique/foreign key/version constraints; room history uses existing persistent relationships.
- NestJS code-first generates a unique OpenAPI without modifying the front end and historical PRD.
