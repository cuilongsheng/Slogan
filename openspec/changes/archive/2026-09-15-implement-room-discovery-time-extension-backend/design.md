## Context

See Why of [proposal.md](./proposal.md). Currently `Room` has saved `kind`, topic, CEFR, password summary, status, `endsAt` and monotonous `stateVersion`. Instant rooms and reserved rooms are queried through `/v1/rooms` and `/v1/appointments` respectively. Both sets of lists are currently only cursor and page sized, and all rooms have no visibility, sharing flags or extension facts.

Room end has adopted PostgreSQL state, BullMQ deferred task and recovery scan: request path is judged by persistent `endsAt`, old or deferred task enters the end service and checks the room time again. The LiveKit control plane already has provider port and PostgreSQL `RealtimeCommand`, but it only supports removing identities, deleting rooms and room host timeouts, and does not update room metadata.

The room reservation business code and change already exist, but its main spec has yet to be independently sync/archived; this change uses the existing `RoomKind=APPOINTMENT`, reservation open and end implementation, and does not redefine reservation, no-show or reminder rules. The API continues to use NestJS code-first to generate and verify the unique `openapi/openapi.yaml`.

## Goals / Non-Goals

**Goals:**

- Support visibility, sharing, and extension of instant and reserved rooms using the same Room persistent fact.
- Add CEFR/topic filtering without breaking existing unfiltered calls and legacy cursors.
- Isolate linked rooms from public discovery while using only high-entropy share identifiers as location portals.
- Make extensions linearize within the database and allow expiration schedules and LiveKit metadata to eventually converge to the latest version.
- Reuse existing Rooms, Voice, LiveKit, BullMQ and restore scanning boundaries without adding new microservices or a second set of API contracts.

**Non-Goals:**

- The sharing ID is not designed as an authorization certificate, nor does it add link revocation, one-time link or access list.
- Does not add a full-text search engine, fuzzy relevance ranking or topic tag system.
- Does not implement client deep link, system sharing panel, countdown UI or member confirmation process.
- Do not modify the reservation creation time, first room host arrival, end of vacancy, reminder or penalty rules.

## Decisions

### 1. Visibility and sharing identifiers belong to Room

Add `visibility`, `shareCode` and `extensionCount` to `Room`:

- `visibility` uses `RoomVisibility.PUBLIC | LINK_ONLY`, and the database defaults to `PUBLIC`;
- `shareCode` uses an independent random UUID and establishes a unique constraint; it is not the same as the internal `Room.id`;
- `extensionCount` defaults to 0 and is limited to 0–3 by database constraints.

Both types of rooms share the same model, so creating, listing, detailing, and sharing parsing only requires extending the existing Rooms module. The password continues to be stored at `passwordDigest` and is not combined with visibility into further enumerations.

Choosing independent `shareCode` instead of directly exposing `Room.id` can avoid treating the internal resource identifier as a public entry and provide sufficient enumeration resistance. V1 does not support revocation, so there is only one stable identifier for a room; if revocation or multiple links are needed in the future, independent ShareLink aggregation will be introduced without creating a table in advance.

### 2. The share URL consists of a controlled public base address and shareCode

The configuration layer adds `ROOM_SHARE_BASE_URL` verified by Zod, and the server generates `shareUrl` according to the fixed path and encoded `shareCode`. Create a detail response with access that returns the share URL; public lists only need to return visibility and existing snippets to avoid inflating the response.

Added `GET /v1/room-links/{shareCode}` without bearer token. This query only accepts UUID-shaped codes and projects rooms that are still at `SCHEDULED` or `OPEN` and have not passed `endsAt` according to the current time of the database. Responses use a whitelist of private fields and do not reuse DTOs containing membership, reservation, or internal state. Unknown, canceled, ENDING, ENDED, or expired rooms return stable non-existent/unavailable errors.

Public analysis only solves positioning and display. Client login continues to use existing reservation, join, and real-time credential endpoints; these portals still perform all eligibility checks according to the internal `roomId`. This boundary was chosen instead of issuing a share ticket to avoid creating a second set of session or authorization states.

### 3. Two sets of public lists reuse the same standardized filter value

Instant and scheduled list DTO add optional `cefrLevel` and `topic`:

- CEFR only accepts existing A1–C2 single values and matches them exactly;
- topic removes leading and trailing whitespace, is limited to 1–120 characters, and uses PostgreSQL case-insensitive include queries;
- The query always fixes `visibility=PUBLIC`, retaining their existing kind, status, time and sort range.

New cursor encoding `version`, sort key, room kind and normalized filter snapshot. After decoding, it must be completely consistent with the current query; the old cursor is only allowed to be used for the original list that has not been submitted for filtering to maintain paging compatibility with existing clients. V1 data volume does not introduce full-text search or trigram dependency; retains the combined index of kind/visibility/status/sort fields, and controls queries through limited topic length. Design search indexes separately after actual performance evidence emerges.

### 4. A unified extension endpoint handles two types of open rooms

Added `POST /v1/rooms/{roomId}/extensions`:

```json
{
  "clientRequestId": "uuid",
  "additionalMinutes": 30
}
```

The response contains at least `roomId`, `previousEndsAt`, `endsAt`, `extensionCount`, `remainingExtensions`, `stateVersion`, and `providerStatus`. This endpoint first uses database `clock_timestamp()` and row lock convergence reservation time status, and then verifies:

- The caller is the current `hostUserId`, and the account and security qualifications still meet the existing room operation boundaries;
- The room is already at `OPEN` and `now < endsAt`;
- The minutes are an integer from 1–60, `extensionCount < 3`.

The new time is always accumulated from the current `endsAt` read from the lock and is not calculated from the request arrival time. This way continuous or concurrent extensions will not shorten the room or lose updates. Unified endpoint avoids duplicating a set of commands for room reservations; `SCHEDULED` reservations must wait for the existing open process to be completed.

### 5. RoomTimeExtension saves idempotent results and immutable facts

Add `RoomTimeExtension`, save `roomId`, `actorUserId`, `clientRequestId`, `additionalMinutes`, `previousEndsAt`, `endsAt`, `resultingCount`, `resultingStateVersion` and server time, and create a unique constraint on `(actorUserId, clientRequestId)`.

Extended transactions are executed in the following order:

1. Lock the Room and read the database time;
2. Find the same actor/requestId; the same room and minutes directly return the original fact, different content returns idempotent conflict;
3. Verify the current room host, status, time and times;
4. Update `endsAt`, add `extensionCount` and `stateVersion`;
5. Insert RoomTimeExtension, minimum `room_time_extended` RoomEvent and `SYNC_ROOM_TIME` durable command.

Steps 4–5 are committed in the same Prisma transaction. Choosing to use an independent fact table instead of relying only on RoomEvent is due to the need to completely replay the original results and to enclose concurrent idempotent by unique constraints of the database; RoomEvent continues to serve auditing, reporting evidence, and timeline projection.

### 6. The new due task is a coordination prompt, and the old task must re-read the database.

After the transaction is committed, the application tries its best to schedule the `expiry` job to the new `endsAt`, and the job id retains the runtime version. Redis unavailability does not change API submitted results; existing recovery scans rebuild tasks from `Room.endsAt`.

The old job corresponding to the original end time can be retained. It must compare the database time in the room lock when it calls the existing end service: if `now < endsAt`, do not enter ENDING, do not revoke the identity, do not delete the LiveKit room, and ensure that the latest due tasks can be scheduled or resumed. Deleting old jobs can only be used as an optimization and cannot be a correctness condition.

### 7. LiveKit room metadata carries member time synchronization

Realtime provider port adds the ability to carry metadata and update room metadata when securing a room. Metadata only contains versioned whitelist:

```json
{
  "schemaVersion": 1,
  "stateVersion": 12,
  "endsAt": "2026-09-15T04:00:00.000Z",
  "extensionCount": 2
}
```

Normal clients can no longer update themselves or room metadata, so only the backend LiveKit Server API can publish this value. LiveKit's room metadata update event is used to notify online members; subsequent participants obtain the latest snapshot from the remote room metadata.

`SYNC_ROOM_TIME` reuses existing RealtimeCommand leases, retries, and recovery scans. After receiving the command, the worker re-reads the latest value of Room and sends it instead of trusting the payload when the command was created. After the call is completed, compare `stateVersion` again. If a new version appears during the period, keep or create the latest synchronization command. The client only accepts metadata that is no lower than the local observed version to avoid late event rollback countdown.

If the remote room does not yet exist, the synchronization command can be completed because the next `ensureRoom` must carry the latest metadata of the database. If the provider call fails, the command remains in a recoverable state, and the API reuses `COMPLETED | PENDING | UNAVAILABLE` semantics to return to the control plane state. Business success does not depend on LiveKit being available at the time.

### 8. OpenAPI continues to be generated by NestJS code-first one-way

DTO, controller decorator, and stable error map are implementation inputs, producing results that cover unique `openapi/openapi.yaml` and pass existing drift checks. No other handwritten contract is allowed. New public share resolvers must explicitly remove the bearer requirement; create, list, detail, and extend endpoints continue to retain existing authentication boundaries.

## Risks / Trade-offs

- [Public share resolver may be detected] → Use independent high-entropy UUID, strict format verification and minimum field whitelist; this change does not promise universal rate limiting, and subsequent governance changes can be supplemented after unified rate limiting facilities are available.
- [Case-insensitive inclusion queries slow down after data growth] → Limit the topic length and use the existing relational database for query; record query indicators first, and then introduce trigram or search services when there are real bottlenecks.
- [Database extended but LiveKit temporarily shows old time] → API returns providerStatus, durable command retries, recovery scans and first ensureRoom all read the latest database version; client rejects rollback with stateVersion.
- [Old expiry job runs at original time] → Reread PostgreSQL `endsAt` within the expired action lock. No Redis job can decide to end independently.
- [The new RealtimeCommand enum is incompatible with the old worker rolling deployment] → Deploy workers/APIs that can recognize `SYNC_ROOM_TIME` first, and then open extended traffic; stop generating new commands and processing or retaining records to be synchronized before rolling back, and prohibit old workers from treating unknown commands as successfully completed.
- [Incorrect shared URL base address configuration will generate unavailable links] → Bootstrap performs absolute HTTPS URL verification. The test environment allows clear local HTTP base addresses. Deploy smoke to verify that the generated URL is consistent with the parsed route.

## Migration Plan

1. Added RoomVisibility enum, Room's `visibility`, `shareCode`, `extensionCount`, and RoomTimeExtension table, index, constraint and `SYNC_ROOM_TIME` command types.
2. Backfill all existing rooms to `PUBLIC` within the migration, generate a unique shareCode for each record, and set the number of extensions to 0; retain the database default value so that the old creation code that runs briefly after migration can still be inserted into the room.
3. Use the isolated temporary database to verify the newly created database and historical migration chain, confirm that the shareCode is unique, existing rooms can still be publicly queried, and old Room/appointment data is not lost.
4. Deploy realtime workers and APIs that support the new command, and generate OpenAPI; confirm that all running instances can recognize the new command and then open the extension request.
5. Run local provider, Redis stop/resume and old expiry job smoke; perform real metadata updates and member event smoke when LiveKit Cloud configuration is available, and record unexecuted items as environment blocking instead of PASS.

When the application is rolled back, the newly added endpoint and public resolver are closed, the generation of new synchronization commands is stopped, and the application version is rolled back to an application version compatible with the old response; the database fields and fact tables are retained, and no destructive downgrade is performed. The repaired version continues to read the saved `endsAt` and extension facts to avoid the loss of time or idempotent facts caused by rollback.
