## 1. Configuration and module boundaries (planned for 0.5 days)

- [x] 1.1 Add at least 32 characters of `ROOM_PASSWORD_PEPPER` and non-empty `ROOM_RULES_VERSION` to the environment schema, `.env.example` and log masking configuration, and verify through bootstrap tests that missing or illegal configuration will prevent startup and the secret will not enter the log
- [x] 1.2 Improve `apps/api/src/modules/rooms`’s domain, application, infrastructure and presentation directories and public module exports, and verify through `pnpm deps:check` that Controller, Prisma and cross-module dependencies do not cross the established boundaries
- [x] 1.3 Define room DTO, view model, stable error code and authenticated principal input boundaries, and verify illegal topic, CEFR, capacity, PIN, cursor and `rulesAccepted` through compile-time type checking and DTO validation unit testing are unanimously rejected

## 2. PostgreSQL Schema and Migration (planned for 0.5 days)

- [x] 2.1 adds `Room`, `RoomMembership`, room status and member role Prisma schema, including UUID, host, topic, CEFR, capacity, password digest, time, joining order, rule version and `(roomId, userId)` unique constraints, and the model can be generated through Prisma schema validation verification
- [x] 2.2 Create increment-only migrations and query the required foreign keys/indexes, execute `pnpm --filter @slogan/api db:test:migrate` on a clean test database upgraded from existing identity/profile migrations, and use integration schema inspection to verify that tables, constraints, and indexes exist
- [x] 2.3 Implement the Prisma mapping and transaction entry of rooms repository, ensure that domain/application does not expose Prisma types, and verify the mapping and dependency direction through repository integration smoke tests and `pnpm deps:check`

## 3. Room area rules and safety (planned for 1 day)

- [x] 3.1 Implement instant room creation policy: only accept capacity of 2–6 people, CEFR supported, valid topic, and set by the server `startedAt` and default two hours `endsAt`; verify boundaries through frozen clock and table-driven unit testing
- [x] 3.2 implements `RoomAccessPolicy`, covering `ELIGIBLE` admission, effective open status, rule confirmation, password results and capacity results, and verifies stable error codes one by one through table-driven unit testing
- [x] 3.3 Implement room-scoped HMAC-SHA-256 password digest and constant time check, database and response only retain digest/`passwordProtected`, and verify correct PIN, wrong PIN, different room ID, password-less room and output desensitization through security unit testing
- [x] 3.4 Implement the application use case of creating a room, write Room and join HOST membership with order 1 in a single transaction, and verify through integration tests that the capacity includes room host, default duration, password digest, and no residue from failed transactions

## 4. Query and concurrent join (planned for 1.5 days)

- [x] 4.1 Implement the open room cursor list for authenticated users. Press `startedAt desc, id desc` to return the default 20 and the maximum 50 items, and verify expired/end room filtering, stable page turning, `memberCount` semantics and only project room host nicknames through integration tests
- [x] 4.2 Implement room details query for authenticated users, return room display fields and current requester membership status, and verify open rooms, joined users, unjoined users, unknown/invisible resources unified `ROOM_NOT_FOUND` and expired `ROOM_ENDED` through integration tests
- [x] 4.3 Implements joining application use case, locks Room in transaction, returns duplicate membership idempotent, counts capacity, assigns joining order and saves rule version/time, and verifies public room, password room, unconfirmed rule, data incomplete, under 18 years old, full membership and expired path through integration tests
- [x] 4.4 Add real PostgreSQL last seat concurrency test, submit join requests of at least two qualified users at the same time, and verify that there is only one new membership, the failed party receives `ROOM_FULL`, there is no duplicate join order, and there is no residual data after transaction failure
- [x] 4.5 Implement limited retries for serialization/deadlock database conflicts and do not retry business conflicts, and verify the retry upper limit, successful recovery and final error mapping through repository/application tests without generating 500 or duplicate memberships

## 5. HTTP API with the only OpenAPI Contract (planned for 1 day)

- [x] 5.1 Implement authenticated Controller/DTO/response mapping of `POST /v1/rooms` and `GET /v1/rooms`, and verify through HTTP E2E unauthenticated, data incomplete, under 18 years old, public/password creation, paging list and response without leaking password digest
- [x] 5.2 implements `GET /v1/rooms/{roomId}` and `POST /v1/rooms/{roomId}/memberships`, and verifies details through HTTP E2E, idempotent joining, unconfirmed rules, missing/wrong password, full, expired and stable error bodies
- [x] 5.3 updates NestJS code-first decorators and generates `openapi/openapi.yaml` deterministically. Verifies that the unique contract is drift-free through `pnpm --filter @slogan/api openapi:check` and Swagger parser validation and that the four endpoints, schema, certification and error responses are complete.

## 6. Backend verification and deferred acceptance (planned for 0.5 days)

- [x] 6.1 Run `pnpm verify:api` to verify that bootstrap, domain, repository, concurrency, HTTP E2E, lint, typecheck, build and OpenAPI drift all pass, and record the command, results and known boundaries to the change's acceptance evidence
- [x] 6.2 Run workspace `pnpm format:check` and `pnpm deps:check` to confirm that the changes to rooms do not destroy the monorepo format or dependency boundaries, and record PASS, FAIL or reproducible BLOCKED reasons in evidence
- [x] 6.3 Check the backend criteria against `openspec/specs/instant-room-discovery/spec.md`, `openspec/specs/localization-and-room-rules/spec.md` and this change design; only record verification has been completed, product-owner, vision, equipment and front-end integration verification acceptance mark is DEFERRED, keep the change unarchived and wait for unified acceptance
