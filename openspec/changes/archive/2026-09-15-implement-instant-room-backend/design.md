## Context

See Why of [proposal.md](./proposal.md). The current identity/profile implementation already provides server-side authentication context with `userId`, `sessionId`, and `PROFILE_REQUIRED`, `AGE_RESTRICTED`, `ELIGIBLE` status calculated in real time; PostgreSQL/Prisma, unified error body, log masking and NestJS code-first OpenAPI also exist.

`apps/api/src/modules/rooms` is still an empty skeleton. Current requirements require instant room creation, public/password join, list/details, and concurrent capacity boundaries, but LiveKit, presence, room host handover, and penalty enforcement are subsequent changes. This design therefore first establishes a persistent room control surface and an API that can be used by the front-end generated client, without pretending that "database members" are "real-time online connections".

## Goals / Non-Goals

**Goals:**

- Guaranteed room creation, idempotent joining, and capacity capping with PostgreSQL transactions without relying on Redis or LiveKit.
- Reuse existing authentication and profile eligibility, without duplicating the age algorithm or trusting the admission status submitted by the client.
- Make the room password unable to be read directly or recovered only by 10,000 offline enumerations when the database is leaked.
- Generate a unique OpenAPI contract that is stable, verifiable and can be consumed by subsequent front-end generated clients.
- Leave clear room/member fact boundaries for subsequent LiveKit/host-controls, but do not implement their state machines in advance.

**Non-Goals:**

- Do not use the number of database members to claim the number of people online in real time; the semantics of this batch field is "the number of people who have obtained the membership of the current room".
- Redis presence, queue, scheduled worker, LiveKit adapter, or room event bus not created.
- Does not define the behavior of ordinary members leaving, room host exit, handover, removal, invitation and disconnection recovery.
- No new temporary punishment, appeal or administrator writing interface will be added.
- No modifications to the frontend, Figma, or generated API client, and no final product acceptance performed.

## Decisions

### 1. The room control surface adopts `Room` + `RoomMembership` persistent model

`Room` saves UUID, host user, topic, CEFR, capacity, optional password digest, `OPEN/ENDED` status, start/end and audit time. `RoomMembership` saves UUID, room/user, `HOST/MEMBER` role, joining order, rule confirmation version and joining time, and creates unique constraints on `(roomId, userId)`.

When creating a room, write Room and room host membership in one transaction; the capacity includes room host, so the number of members after creation is 1. The join order starts from 1 and is allocated by database transactions. Subsequent host-controls can implement "second wheat" based on this fact. This batch does not implement forward movement after leaving.

The effective opening condition of the room is `status=OPEN && endsAt>now`. The list only returns valid open rooms; if the details and joining are found to have reached the end time, it will be processed as `ROOM_ENDED`, and the repository will be allowed to lazily fall into the `ENDED` state during the write transaction. There is no need to introduce scheduled workers for the current version without real-time connections.

The alternative of placing only Redis in the room will lose persistent facts and migration capabilities; creating a complete host-control state at one time will expand the current change, so it is not used.

### 2. Access is arranged by application, domain policy only determines explicit input

Each list, detail, create and join use case obtains server-side `userId` from the authentication guard and then calls `ProfilesService.getOnboardingState()`. Only `ELIGIBLE` can continue; `PROFILE_REQUIRED` and `AGE_RESTRICTED` are mapped to stable `PROFILE_REQUIRED` and `AGE_RESTRICTED` API codes.

Account `DISABLED/DELETED` has been rejected by an existing access-token session check and the room module does not read or copy user status. Check eligibility again when joining to prevent users from bypassing the rule by changing their birth date after opening the details.

`RoomAccessPolicy` accepts eligibility, room status, rule confirmation, password verification result, and capacity fact, returning an unambiguous domain result; it does not rely on NestJS, Prisma, JWT, or environment variables.

The alternative of using Controller splicing check will cause rule drift between interfaces; putting eligibility in JWT will generate expired authorization, so it is not used.

### 3. Concurrency capacity is guaranteed by PostgreSQL room row locks and unique constraints

Join the use of database transactions: first lock the target Room row, then check the valid status and existing membership; existing membership is returned directly as idempotent. The new member counts membership in the same lock, checks `< capacity`, assigns the next joining sequence and inserts it. All requests competing for the same room pass through the same line lock serially, so at most one of the last places succeeds.

The only `(roomId,userId)` constraint is the final line of defense against duplicate requests. The transaction only retries serialization/deadlock conflicts recognized by PostgreSQL, and sets a limited number of times; business conflicts return `ROOM_FULL` and must not end with 500 or duplicate membership.

Currently, PostgreSQL row locks are smaller and more reliable than Redis + PostgreSQL dual-write when running a single instance with a capacity of up to 6 people. Redis can provide temporary coordination or caching when multi-instance presence is introduced in the future, but it must not become the sole source of truth for membership, nor can it weaken database constraints.

### 4. 4-digit passwords use room-scoped HMAC instead of plain hashes

There are only 10,000 4-digit numbers, and simple SHA/Argon2 digest can still be enumerated offline after the database is leaked. When creating, the backend generates the room ID and calculates `HMAC-SHA-256(ROOM_PASSWORD_PEPPER, roomId + ':' + password)`; the database only saves the 64-digit hexadecimal digest. Recalculate when joining and use `timingSafeEqual` comparison.

`ROOM_PASSWORD_PEPPER` is a required startup secret of at least 32 characters and enters Zod, `.env.example`, log masking, and bootstrap tests. The public API only returns `passwordProtected: boolean`, never digest or password. Rooms without passwords will not generate placeholder digests.

The alternative of using a normal password hash for the PIN increases the computational cost but does not prevent low-entropy offline enumeration; putting the password in Redis or a clear text database is not acceptable.

### 5. The rule confirmation is saved with the membership, but the Chinese and English copy is not maintained by the backend.

Joining DTO must contain `rulesAccepted: true`; otherwise `ROOM_RULES_NOT_ACCEPTED` will be returned and membership will not be created. The server saves fixed `ROOM_RULES_VERSION` and `rulesAcceptedAt` in membership to prove which version of the rules the user confirmed when joining.

Currently, the complete copywriting in Chinese and English continues to be handled by the front-end localization resources and Figma visual process, and the back-end only has version and confirmation facts. The rule version is fixed and verified through environment configuration; if the meaning of the rule changes later, the OpenSpec requirement should be modified first, and then the client copy and server version should be updated.

The alternative of submitting an arbitrary version by the client would make the audit facts falsifiable; returning the entire set of localized copy by the backend would transfer the current front-end language responsibilities to the API, so it is not used.

### 6. API uses authenticated resource endpoints and stable error codes

First batch of endpoints:

- `POST /v1/rooms`: Create an instant room; body contains topic, CEFR, capacity and optional 4-digit password.
- `GET /v1/rooms`: Press the `startedAt desc, id desc` cursor to page back to valid open rooms.
- `GET /v1/rooms/{roomId}`: Return room details and current membership qualification information.
- `POST /v1/rooms/{roomId}/memberships`: Confirm the rules and join; you can submit a password in the password room.

Create response contains room host membership; join response contains membership ID, role, and join order. `memberCount` in the list/details is the persistent membership number, not `onlineCount`. The list defaults to 20 and the maximum is 50; the cursor is an opaque string, and the encoding structure is not promised to the client.

Stable bugs include at least `PROFILE_REQUIRED`, `AGE_RESTRICTED`, `ROOM_NOT_FOUND`, `ROOM_ENDED`, `ROOM_FULL`, `ROOM_PASSWORD_REQUIRED`, `ROOM_PASSWORD_INVALID`, `ROOM_RULES_NOT_ACCEPTED`, and `VALIDATION_FAILED`. Both non-existence and unauthorized viewing will return `ROOM_NOT_FOUND` in this batch, reducing resource enumeration differences.

OpenAPI continues to use NestJS DTO/decorator code-first generation, updates `openapi/openapi.yaml` and performs validation/drift check; does not create a second handwritten contract.

### 7. Display data is read in profile in real time, rooms do not copy user information

Room only saves the `hostUserId` foreign key. The list and details repository query only selects `displayName` of the host profile, and does not return the date of birth, nationality, city or interest. In this way, the room display will be updated synchronously after the user changes the nickname, and it will also avoid copying data snapshots across modules.

Prisma join only exists in rooms infrastructure adapter; domain/application only receives mapped room view and does not expose Prisma model. The room module calls the profile application API to determine the current requester's eligibility and does not deeply import the profile repository.

### 8. Separation of evidence and delayed acceptance

This change must provide domain unit tests, real PostgreSQL migration/repository concurrent integration tests, provider-neutral HTTP E2E, OpenAPI validation/drift, dependency boundary, lint, typecheck and build evidence. Concurrent testing competes for at least one remaining slot at the same time, and verifies that failed requests have no remaining membership.

This batch has no UI, LiveKit or physical device behavior and therefore does not produce visual/device/audio evidence. At the current decision of the product owner, the change remains unarchived after the automated verification is completed, and the final acceptance is made together with the front-end integration verification.

## Risks / Trade-offs

- [Risk] The number of database memberships is different from the number of people online in LiveKit in the future → The field is explicitly named `memberCount` and `onlineCount` is not exposed; the presence is implemented by subsequent changes.
- [Risk] Row locks cause waiting in the hotspot room → The current capacity is up to 6 and single instance, the transaction only performs short queries and insertions; recording conflicts is time-consuming, and Redis coordination will be introduced after real bottlenecks occur.
- [Risk] When the room expires, there is no background task to write `ENDED` immediately → All reads/joins calculate the effective status according to `endsAt`, and the write request can be persisted lazily; real-time notification is left to LiveKit/worker change.
- [Risk] The password room cannot continue to verify after the HMAC pepper is lost → configure it as a deployment secret backup and rotation item; rotation requires independent change and compatibility windows.
- [Risk] identity/profile change not yet product acceptance → only rely on its verified public application API; if unified acceptance requires modification of the identity contract, this change will be adjusted synchronously before archiving.
- [Trade-off] Redis is not currently introduced, which is different from historical recommendations → archived inventory has clarified that Redis/Lua is an implementation recommendation rather than a current MUST; PostgreSQL transactions directly meet the observable concurrency upper limit and avoid double writes.

## Migration Plan

1. Expand the environment schema and sample configuration, add room password pepper and rule version, and start the failed test first.
2. Add additive migration of Room, RoomMembership, enum, foreign keys and indexes to existing schema; execute `prisma migrate deploy` on test database upgraded from identity/profile migration.
3. Implement rooms domain/application/repository with HTTP API, keep Controller thin and reuse existing authentication/profile boundaries.
4. Generate a unique OpenAPI contract that performs domain, repository concurrency, HTTP E2E and workspace verification.
5. Log verification evidence; do not perform deployment or product-owner acceptance in this change.

The application is rolled back to the previous version that does not expose room routes. Keep the newly added table when room data already exists, and do not perform destructive down migration; repair the schema or logic through forward fix. The test environment can be stopped and re-executed with all migrations after rebuilding the dedicated tmpfs PostgreSQL container.
