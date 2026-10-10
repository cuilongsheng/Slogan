## Context

See `proposal.md` for motivation and scope, and `specs/basic-safety-reporting/spec.md` of this change for behavior.

Current code facts checked on 2026-09-12:

- `rooms` already has controller, application service, domain policy and Prisma repository; `withLockedRoom` uses Room row lock, and `RoomMembership` has `(roomId,userId)` unique constraint. There is currently no lifecycle state and RoomEvent model.
- `moderation` and `audit` are still empty directory skeletons; the existing OpenAPI has no reporting interface.
- `AccessTokenGuard` verifies token, persistent session and ACTIVE account through `SessionService`. Global ValidationPipe rejects extra fields; ApiExceptionFilter uniformly exposes error codes.
- HTTP E2E uses an in-memory repository, and PostgreSQL integration tests verify transactions independently; the former cannot be used to prove real database atomicity.
- `StructuredLogger` will serialize the object into a string. It cannot be assumed that Pino path desensitization can clear the report text that has been strung into message.
- The front-end planning has been split during final verification: `implement-livekit-voice-session-backend` provides RoomEvent and real-time basis, `implement-host-controls-backend` provides LEFT/REMOVED/INVITED and management auditing that retains historical membership. Both are pending implementation; the integration points described below are implementation targets, not existing APIs.

## Goals / Non-Goals

**Goals:** ensures traceability of reporting qualifications, non-repetition of retries, and atomic storage of records and audits; it continues to use modular monoliths, PostgreSQL and the only OpenAPI contract.

**Non-Goals:** does not establish a generalized review workflow or global transaction framework; does not include external providers in reporting transactions; see the proposal for other product boundaries.

## Decisions

### 1. Determine qualifications by adding historical facts

Both the reporter and the target must have actual joining facts in the specified room. Allows ACTIVE, LEFT, REMOVED, and members who have joined and been re-invited; cannot just judge whether there is an INVITED row. The reserved joining time/event is used to distinguish between "joined and then invited" and "only invited but never joined". The membership of the current pre-design is generated from actual joining; the domain policy test still covers the input of pure invitation without actual joining evidence, and no new model will be added for the future invitation process.

The relationship constraints are satisfied if both parties have been in the same room, and there is no additional requirement of "must be online at the same time or time overlap". Room OPEN/ENDING/ENDED, wheat position, presence and room host roles are not eligible for reporting. The request is not to be reused. `RoomsService.detail()`: This method will reject the ended room. Valid identities follow the global guard; no reporting-specific login is introduced or the authentication boundary of restricted accounts is changed.

The alternative of judging by current online members will block historical reports; trusting the client userId/room link will allow forged relationships. None are used.

### 2. Interface and input boundary

Added `POST /v1/rooms/{roomId}/reports`, using Bearer certification. The request fields are:

| Field             | Constraints                                                                                                                                                                                       |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `roomId` (path)   | UUID                                                                                                                                                                                              |
| `targetUserId`    | UUID, resolved by the server to the real member of the room                                                                                                                                       |
| `clientRequestId` | Required UUID; shared by one submission and its retries from the same reporter                                                                                                                    |
| `category`        | `HARASSMENT_ABUSE` (harassment and abuse), `HATE_DISCRIMINATION` (discrimination and hatred), `SEXUAL_CONTENT` (pornographic and vulgar), `SPAM_ADVERTISING` (spam advertising), `OTHER` (others) |
| `description`     | Only accepts strings; 1–2000 Unicode code points after trimming, no HTML execution or rich text processing                                                                                        |

The path/UUID is unified and standardized; the description is only trim, and the white space in the middle is not merged. DTO and domain policy use consistent code point counting to test emoji boundaries. Unknown fields (including reporterUserId, submittedAt) return `VALIDATION_FAILED`, and the verification response is prohibited from containing input values.

Both new creation and idempotent retry return HTTP 201, the business body is only `{ id, submittedAt }`, and submittedAt is the server UTC time of the first submission. Does not return text, reporter/target profile, review status or other report records.

| Scene                                                                                                  | HTTP / code                                                    |
| ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| Invalid identity or session                                                                            | 401 / `ACCESS_TOKEN_INVALID` (use the existing one)            |
| Illegal format, category, description, and extra fields                                                | 400 / `VALIDATION_FAILED`                                      |
| Legal members report themselves                                                                        | 400 / `REPORT_TARGET_INVALID`                                  |
| The room does not exist, the reporter has not joined, the target has not joined or it is across rooms. | 404 / `REPORT_CONTEXT_NOT_FOUND`                               |
| The same identifier corresponds to different valid content                                             | 409 / `REPORT_REQUEST_CONFLICT`                                |
| Unrecovered persistence failure                                                                        | 500 / `INTERNAL_ERROR`, does not expose underlying information |

First authenticate and verify the DTO, then verify the room/informant relationship to avoid disclosing target information to non-members. For the registered request ID, after successful authentication, only the existing records of the informant will be read and the contents will be compared: if they are the same, the credentials will be returned, if they are different, they will conflict; the records of other informants will not be queried or returned.

Use NestJS Swagger DTO/decorators code-first to generate `openapi/openapi.yaml` without handwriting the second contract; generating the client is outside the scope of this article.

### 3. Persistence model and retry

Added `Report` model, independent `prisma/models/report.prisma`: UUID id, roomId, reporterUserId, targetUserId, clientRequestId, category, description, submittedAt. Category uses explicitly mapped domain values ​​to Prisma enum, text cap consistent with database constraints.

- The only constraint is `(reporterUserId,clientRequestId)`; do not remove duplicates by "room + target + category" because new events can be new reports.
- Use `(roomId,reporterUserId)` and `(roomId,targetUserId)` to reference membership. There is already a composite unique key to ensure the same room relationship; the relationship uses RESTRICT, and cascading deletion of saved reports is prohibited. If migration requires supplementing relationship constraints, keep existing data valid.
- Establish `(roomId,submittedAt,id)` index to facilitate audit correlation; no query interface will be added for this purpose.
- Extended RoomEvent reporting type and nullable `reportId` unique association, this field is empty for historical events; reporting events must be associated with Report. In auditing, only actor, target, room, category, result, occurredAt and reportId are written, but the text is not written.

Compare room, target, category and normalized body for the same clientRequestId. Concurrency relies on the unique constraint of the database; end the failed transaction after a unique conflict, reread and compare according to the current reporter in the new transaction, and return the original result or stabilize the conflict. The query must not continue within a failed PostgreSQL transaction. Concurrency of the same identity in different rooms must also pass through this path and cannot only rely on room row locks.

Alternative memory/Redis deduplication cannot ensure database consistency across restarts; permanent target deduplication will swallow new events. Neither is used.

### 4. Module responsibilities and same transaction audit

`moderation` has Report, submission case, input strategy and repository port. The thin controller only passes in the current identity and DTO, and the application only uses the frameless domain type.

Adopt the existing partial callback mode of `withLockedRoom`, and add a new reporting-specific repository operation: obtain the reporting context provided by rooms in a PostgreSQL transaction, call the domain policy, save the Report, and then append the RoomEvent. The commit result can only be returned after the transaction is successful. If the audit fails, the Report must be rolled back; the successful audit is not added asynchronously after submission.

Cross-module collaboration only uses public entrances: rooms provides a minimal context containing historical joining facts; audit provides the ability to additionally report events. In order to reuse the same transaction, two modules can expose dedicated infrastructure integration entrances for moderation adapter calls; Prisma TransactionClient is only passed between these infrastructure files and does not enter application/domain/controller or global common. The exception here only serves the current atomic transaction needs and does not create a generalized UnitOfWork. May not deep import the rooms/audit repository or copy its lifecycle rules.

If the RoomEvent in front is temporarily written by the rooms adapter, this time the minimum shareable event writing part will be handed over to the audit and reused through the public entrance, retaining the existing calling behavior and transactions. The dependency direction is moderation → rooms/audit, rooms → audit, audit does not depend on moderation/rooms application; forwardRef is not used. The specific export name is aligned with the upstream implementation, and it is prohibited to modify unfinished upstream files for this plan.

Transaction only does database work, no LiveKit, Redis, webhooks or notification side effects. The database reads context in uniform room lock order; unique constraints and foreign keys are the last line of defense. leave/remove/end concurrency only changes the status quo and does not erase historical reporting qualifications.

### 5. Privacy and permissions failed

The main text only exists in Report; the audit save mark does not copy the main text. Does not register the query/modify/broadcast interface, and does not trigger room host notifications or any penalties. The necessary technical logs use fixed event names, requestId, reportId and stable result code whitelists. It is prohibited to write logs after JSON.stringify the entire DTO, exception object or text. Supplement `description` path desensitization as an auxiliary line of defense, and test the actual logger output and error response at the same time. You cannot only test the configuration array.

This change does not specify the final retention period or automatic cleanup; the purpose of adding FK is to prevent accidental cascade loss, and does not mean that the permanent retention strategy has been determined. The subsequent deletion/account deletion process requires an independent solution.

## Risks / Trade-offs

- [Risk] The upstream real-time and room host management change has not yet been implemented → press LiveKit → room host management → security report execution; the proposal can be reviewed first, and apply first verifies the actual schema, public interface, RoomEvent and front-end and back-end evidence. If missing, stop relying on the implementation and do not forge the temporary membership model.
- [Risk] Historical reports are not required to be online at the same time, and the user's statement has not been verified by the platform → only marks the submission as successful, does not identify the facts, and does not automatically impose penalties; a separate change will be established for subsequent review.
- [Risk] Cross-module writes of the same transaction may lead to boundary penetration → Only share transactions through clear infrastructure public integration entrances, keep domain pure, and perform dependency checks and existing room audit regressions.
- [Risk] New unique association or RESTRICT affects historical data/deletion path → additive migration is verified on clean library and pre-version fixture; destructive deletion is rejected and old migration is not changed.
- [Risk] There is currently no reporting frequency limit defined → This time only a single request idempotent and field upper limit are guaranteed, and it does not claim to have completed anti-abuse capabilities; the rate limiting parameter is listed as a subsequent product decision.
- [Risk] Fake repository cannot prove concurrency, transactions, foreign keys → PostgreSQL integration test with real database HTTP smoke provides evidence.

## Migration Plan

1. Before applying, confirm that LiveKit's RoomEvent foundation and the historical membership lifecycle of room host management have been implemented, that both phases of migration are available, and record their respective actual revisions and test evidence; they are not required to be deployed or archived in production first, and unfinished provider verification is not recorded as passed.
2. Added additive migration of Report, event correlation/category and index under fixed Node 24.21.0; the reportId of historical RoomEvent remains empty, and the original room/membership data remains unchanged.
3. Apply migration to empty database and upgrade fixture with pre-room, historical membership, audit events; verify foreign keys, unique constraints, historical data, and rollback on failure.
4. Perform affected scope validation after implementing endpoint, module wiring, error mapping, and code-first contract. The actual production release is the responsibility of subsequent deployment work.
5. When the application rolls back to the pre-deployment version, it stops providing new reporting endpoints, retains new tables, enum/nullable columns, and written audits, and does not delete tables/delete data down migration; the old version's room basic process on the addition schema needs to be verified for compatibility. Restore submission after fixing the problem through forward fix.

## Verification and Acceptance

- Unit: five-category mapping, codepoint length, trim, identity field rejection, current/historical qualifications, self/cross-room, request content comparison, pure strategy without relying on NestJS/Prisma.
- PostgreSQL: normal writes, bilateral failure injection rollback, concurrency with same identity, cross-room identity conflict, isolation of different informants, FK/delete protection, leave/remove/end concurrency and retry after restart.
- HTTP: valid identities and invalid sessions, historical members and ended rooms, illegal DTOs, permission bypasses, minimal responses, stable errors, no new query or notification paths; at least one real PostgreSQL-based login → join → leave/end → report → retry closed loop.
- Regression: front-end room host management and event auditing, existing auth/rooms HTTP, log text/credentials not leaked, OpenAPI drift, module boundaries and formats.
- Run `pnpm verify:api`, `pnpm format:check`, and `pnpm deps:check` once after all implementations are completed; after failure, first make minimum scope repairs and then rerun for necessary final checks.
- `docs/acceptance/implement-safety-reporting-backend.md` records scene-by-scene PASS/FAIL/BLOCKED, command, version, actual quantity and real database smoke. The UI, real equipment and production release will be verified by subsequent corresponding changes. This time, the back-end testing shall not be equated with the acceptance of the entire set of products.
