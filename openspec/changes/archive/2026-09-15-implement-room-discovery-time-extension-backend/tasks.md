## 1. Data model and migration

- [x] 1.1 Add `RoomVisibility`, Room’s visibility/shareCode/extensionCount, `RoomTimeExtension` and `SYNC_ROOM_TIME` command types and relationships in Prisma multi-file schema, and run `pnpm --filter @slogan/api db:generate` to verify that Prisma schema can be generated.
- [x] 1.2 Write forward migration, backfill `PUBLIC`, unique shareCode and zero extension times for existing instant and reservation rooms, add range/uniqueness/index constraints, and use migration integration tests to verify both new schema and historical schema upgrades.
- [x] 1.3 Adds `ROOM_SHARE_BASE_URL`'s Zod startup verification, test environment configuration and secure URL splicing, and uses bootstrap unit testing to verify production HTTPS, local test HTTP and illegal configuration rejection.

## 2. Room visibility, filtering and sharing

- [x] 2.1 Expand room domain type and policy, normalize `PUBLIC | LINK_ONLY`, CEFR and 1–120 character topic queries, and use policy/DTO unit tests to cover default PUBLIC, illegal visibility, case and blank topics.
- [x] 2.2 Updated instant and scheduled creation transactions to save visibility atomically with random shareCode, keep password independent and default PUBLIC for old requests, and verify both room types and shareCode uniqueness with repository integration tests.
- [x] 2.3 adds visibility, CEFR, topic filtering and versioned cursors bound to filter context for instant public lists, while being compatible with old cursors without filtering, and using repository integration tests to cover combined filtering, LINK_ONLY exclusion, paging without duplication and cursor mismatch.
- [x] 2.4 Reuse the same filter specification and cursor context for the appointment public list while retaining appointment time settlement, sorting and capacity projection, and use appointment integration tests to cover SCHEDULED/OPEN, combined filtering, LINK_ONLY exclusions and boundary paging.
- [x] 2.5 Implement a dedicated minimum projection for querying by shareCode, using database time to exclude canceled, closing, ended and expired rooms, and using integration tests to prove that responses do not contain password digest, members, booker, credentials or provider fields.
- [x] 2.6 adds a shared parsing controller without bearer token and stable 404/unavailable error mapping, and uses E2E testing to verify that it can be parsed without logging in, illegal/unknown code is rejected, and the parsing action does not create reservations, memberships or credentials.
- [x] 2.7 Extend DTO/presenter for instant and appointment creation, lists, details, return visibility and shareUrl for allowed locations by contract, and validate old create requests, public/linked rooms, password combinations, and existing response fields with E2E regression.
- [x] 2.8 Direct API E2E testing demonstrates that shareCode cannot bypass login, profile, age, security restrictions, rule confirmation, password, capacity, reservation and realtime-credentials authorization.

## 3. Room extension transactions and expiration behavior

- [x] 3.1 Implement extension policy: only currently qualified room host, only OPEN and database now is earlier than endsAt, 1–60 integer minutes, up to 3 times, and use unit tests to cover immediate/appointment, take over room host, before start, expiration boundary and times exhausted.
- [x] 3.2 Implement the locked extension repository command, update endsAt/count/stateVersion in the same transaction and write extension fact, RoomEvent and synchronization command; use integration testing to verify that all facts succeed or fail.
- [x] 3.3 Implement `(actorUserId, clientRequestId)` idempotent replay and content conflicts, and use integration tests to verify that the same request does not extend repeatedly, reuse conflicts across rooms or different minutes, and that at most one of the third concurrency succeeds.
- [x] 3.4 Add unified `POST /v1/rooms/{roomId}/extensions` application/presentation process and stable 400/403/404/409 mapping, and use E2E test to verify the current/old room host, ordinary members, SCHEDULED, ENDING/ENDED/CANCELLED and response projection.
- [x] 3.5 Arrange the expiry job according to the new endsAt after the extension submission, and strengthen the in-lock review of the current PostgreSQL time on the expiration path; use unit and integration tests to prove that the old job does not end early or revoke the identity, and the new endsAt only ends once after it arrives.

## 4. LiveKit time synchronization and recovery

- [x] 4.1 adds versioned room-time metadata serializer, the fields only contain schemaVersion/stateVersion/endsAt/extensionCount, and uses unit testing to verify stable JSON, UTC time, field whitelist and version monotonicity.
- [x] 4.2 extends the realtime provider port and LiveKit adapter to enable `ensureRoom` to write the latest metadata, existing rooms can update metadata, and use fake adapter/SDK boundary testing to cover creation, update, remote non-existence and provider error mapping.
- [x] 4.3 Connect `SYNC_ROOM_TIME` to RealtimeCommand claim/retry/recovery and voice dispatcher. The worker reads the latest snapshot of the database each time, detects the new version after calling, and uses integration tests to verify repetitions, failed retries, extensions during execution, and final convergence.
- [x] 4.4 Connect the extension result with the existing `COMPLETED | PENDING | UNAVAILABLE` provider state. When the remote end does not exist yet, the latest metadata will be brought in by the next ensureRoom, and the service/E2E test is used to verify that the three states do not roll back the business results.
- [x] 4.5 Execute the runtime smoke that is extended after Redis/worker stops, the original endsAt crosses the boundary, and the facility restarts. Verify that the room continues to open, is scheduled to the new endsAt after recovery, and that the metadata command converges, and writes the command and time evidence into the acceptance record.
- [x] 4.6 When LiveKit Cloud is configured, execute the real metadata smoke of two members online, verify that both parties receive the latest endsAt/stateVersion after the room host is extended, and the old version will not be rolled back; if there is no configuration, clearly mark BLOCKED in the acceptance record, and it is prohibited to record it as PASS.

## 5. Contract, regression and acceptance

- [x] 5.1 updated the NestJS Swagger DTO/decorator and regenerated the unique `openapi/openapi.yaml`, running `pnpm --filter @slogan/api openapi:check` verified that the shared public security, filter parameters, extended request/response and stable errors were all drift-free.
- [x] 5.2 adds logs/privacy assertions for share parsing and extended failure paths, and verifies that logs and error responses do not contain passwords, shareCode full request bodies, member data, tokens, SQL, stack or provider secrets.
- [x] 5.3 Run `pnpm verify:api && pnpm deps:check` under the `.nvmrc` Node version of the repository, record the complete results of unit/integration/E2E, build, OpenAPI and dependency boundaries, and only mark the actual passed items with PASS.
- [x] 5.4 Create `docs/acceptance/implement-room-discovery-time-extension-backend.md`, itemize OpenSpec scenarios, migrations, concurrency, Redis recovery and LiveKit evidence, and run `openspec validate implement-room-discovery-time-extension-backend --strict` with `git diff --check` to verify the delivery is reviewable.
