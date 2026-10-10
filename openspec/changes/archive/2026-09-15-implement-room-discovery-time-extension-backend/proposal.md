## Why

The current room backend can only browse public real-time rooms in pages, and lacks linked rooms, shareable entrances and CEFR/topic filtering; real-time rooms and open reservation rooms cannot be extended by the room host. Supplementing these capabilities will allow users to find rooms by level and topic, enter via external links, and safely extend sessions when real communication needs to continue.

## What Changes

- Add the visibility of `PUBLIC` and `LINK_ONLY` to instant rooms and reserved rooms; existing rooms are compatible and migrated to `PUBLIC`, and password protection continues to be a condition for independent room entry.
- Generate a non-enumerable stable sharing identifier for each room and provide minimum public sharing information; sharing links must not bypass login, profile, age, security restrictions, password, capacity, reservation or room status verification.
- The public list of instant rooms and reserved rooms supports CEFR precise filtering and standardized subject query; linked rooms do not enter the public list, and the paging cursor is bound to the current filtering conditions.
- Allow the current room host to extend the instant room or reserved room that is still at `OPEN`: a single increase of 1–60 minutes, each room can be successfully extended up to 3 times, accumulated from the current `endsAt` in the database.
- The extend command uses the client UUID idempotent key and updates the end time, count, and event facts within the same database transaction; concurrent requests cannot exceed the maximum number of times or lose time.
- The extended end time is synchronized to online members via a resumable LiveKit control plane update and expiration tasks are rescheduled; when Redis, queues, or LiveKit are temporarily unavailable, the new end time in PostgreSQL still immediately determines join, issue, and expiration behavior.
- Maintain confirmed product boundaries: This change does not add appointment reminders, no-show penalties, waitlists, late penalties, or "10 minutes after start" rules.

## Capabilities

### New Capabilities

- `room-discovery-sharing`: Define boundaries for visibility across instant and reserved rooms, public list filtering, stable sharing links, minimum public resolution, and not bypassing check-in verification.
- `room-time-extension`: Define room host to extend permissions of open rooms, single and cumulative upper limits, idempotent concurrency, persistent time facts, expiration rescheduling and online member synchronization.

### Modified Capabilities

- `instant-room-discovery`: Expand existing instant room creation, lists and details, adding public/link visibility, CEFR/topic filtering and sharing fields while keeping existing calls compatible with new fields.

## Impact

- API contract: Instant room and reserved room creation/list/details DTO in `openapi/openapi.yaml`, as well as sharing resolution and room extension endpoints.
- Backend: `apps/api/src/modules/rooms`’s room policy, query, transaction command, Prisma repository, presentation DTO/controller; `apps/api/src/modules/voice`’s recoverable time synchronization and expiration scheduling with LiveKit adapter.
- Data: Room visibility, share identification, extension times, and extension commands/facts; forward migration, existing data backfill, indexing, and recovery instructions required.
- Validation: filtering and paging, link privacy and permission bypass, extended boundaries for two types of rooms, idempotent concurrency, old expired tasks, Redis/queue recovery, and LiveKit metadata synchronization.

## Impacted delivery stages

- Architecture
- Backend / API
- Test / Acceptance

## Non-goals

- Does not implement the mobile terminal or backend management interface, nor does it define the visual and interaction of the system sharing panel.
- Does not provide sharing link revocation, one-time invitation, friend invitation, room editing or appointment reminder.
- Do not change the existing password, member capacity, room host transfer, security restrictions, reservation occupancy and actual membership rules.
- This change is not required to complete production deployment before archiving; real LiveKit Cloud synchronization is recorded separately as evidence of acceptance of dependent external configuration.
