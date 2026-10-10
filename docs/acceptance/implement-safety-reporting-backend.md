# Basic security reporting backend acceptance record

## Current status and preliminary evidence

- Change: `implement-safety-reporting-backend`; 2026-09-12, local backend delivered 17/17, not archived, not deployed.
- Current HEAD: `2687b1a30c90ee1b4abe5a768e28822153922b04`; LiveKit, room host management, and the actual delivery of this change are all in the uncommitted workspace, and HEAD cannot be regarded as an independent submitted version of these implementations.
- Node.js 24.21.0, pnpm 12.3.4; press `.nvmrc` to activate.
- [LiveKit local acceptance](./implement-livekit-voice-session-backend.md): 21/22, the local base has been delivered, the real Cloud smoke remains unfinished.
- [Room host manages local acceptance](./implement-host-controls-backend.md): 20/21, the final 153 tests passed; historical membership lifecycle, management audit and `20260912040000_host_controls` migration have been implemented. The previous BLOCKED of "room host management not implemented" has been released.
- [RoomEvent](../../apps/api/prisma/models/room-event.prisma), [RoomMembership](../../apps/api/prisma/models/room-membership.prisma), [rooms public entrance](../../apps/api/src/modules/rooms/index.ts) and pre-acceptance have been checked. This change will not be redone or claimed to have passed the pre-Cloud test.

## Implementation and integration boundaries

- Added [moderation module](../../apps/api/src/modules/moderation/moderation.module.ts), submission use case, pure domain policy and repository port. The API only provides `POST /v1/rooms/{roomId}/reports`; the informant is obtained from the authentication context, the database generates the first submittedAt, both new creation and retry return 201, and the business body only has id/submittedAt.
- The five categories are HARASSMENT_ABUSE, HATE_DISCRIMINATION, SEXUAL_CONTENT, SPAM_ADVERTISING, and OTHER; the adapter explicitly maps the database enum. The UUID is normalized lowercase, indicating that it is only trimmed and then verified according to Unicode code points 1–2000, HTML is not executed, and intermediate spaces are not merged.
- [rooms/persistence](../../apps/api/src/modules/rooms/persistence.ts) provides the same transaction minimum historical context: Room row lock with both userId/joinedAt. Not calling will reject the details of the ended room, read the profile/online status or copy the lifecycle rules.
- The current membership is created during real join, joinedAt is required; INVITED is converted by REMOVED after joining. Historical invitation qualifications can be reported; simple links/invitations that claim not to join the line cannot be reported. domain also explicitly rejects joinedAt=null, without adding a placeholder model for future invitation-only flows.
- [audit/persistence](../../apps/api/src/modules/audit/persistence.ts) provides minimum RoomEvent writing capabilities, rooms original transactions and moderation reuse. Prisma TransactionClient is only passed between public infrastructure integration portals and does not enter application/domain/controller.
- [PrismaReportRepository](../../apps/api/src/modules/moderation/infrastructure/prisma-report.repository.ts) is the same as transaction read qualification, write Report and associated RoomEvent. Audit does not copy the text, only write reportId, room, actor, target, category, time, result.
- `(reporterUserId, clientRequestId)` unique constraint processing concurrency; content comparison includes room, target, category, and normalized description. After P2002, exit the failed transaction and then reread, only query the identity of the current reporter; the same content returns the first-time credentials, and different content conflicts stably.
- No calls to LiveKit/Redis, no new penalty, notification, broadcast, query, modification or deletion interfaces. Reporting does not change room, host, membership or account permissions.

## Errors and Privacy

| HTTP | Code / Behavior                                                                                          |
| ---- | -------------------------------------------------------------------------------------------------------- |
| 201  | New and equivalent retries only return id/submittedAt                                                    |
| 400  | VALIDATION_FAILED; the legal member self-report is REPORT_TARGET_INVALID                                 |
| 401  | ACCESS_TOKEN_INVALID, reuse existing valid session and ACTIVE account rules                              |
| 404  | REPORT_CONTEXT_NOT_FOUND; Unknown room, reporter has not joined, target has not joined, unified response |
| 409  | REPORT_REQUEST_CONFLICT, does not overwrite the original content                                         |
| 500  | INTERNAL_ERROR, no underlying database error is returned                                                 |

First authenticate and verify the format, then check the informant context to avoid revealing the target relationship to strangers. Extra reporterUserId/submittedAt fields rejected by global ValidationPipe.

The text is only saved in Report. Added description path desensitization; the exception filter only records the fixed event name, errorName, method/path/requestId, and no longer outputs the original exception stack that may contain SQL or parameter text. Privacy test captures the actual StructuredLogger output and failure response, verifying that the text, token, and SQL Sentinel are not leaked.

## Migration and rollback

Add [20260912050000_safety_reporting](../../apps/api/prisma/migrations/20260912050000_safety_reporting/migration.sql), retain pre-migration:

- Independent Report model, ReportCategory enum, request unique key, room/time/id index.
- reporter/target uses the same room membership composite foreign key; the database supplements self-report and text code point length defense lines, and RESTRICT prevents accidental cascade deletion.
- RoomEvent adds a new nullable unique reportId; old events are null, report_submitted must have Report association and audit subject/category/result fields.

Migration tests on real PostgreSQL random schema covering empty database and upgrade with ended rooms, REMOVED history members, old management audit; verify old columns are readable and writable, old event correlations are empty, foreign keys/indexes and data retention. The room process regression verification addition schema is already compatible.

Stop new reporting entries when rolling back the application, retain Report, enum, nullable event correlation and written data, and restore after repair with forward fix; no destructive down migration is performed. Room/membership with reports can no longer be deleted by cascade, and subsequent deletion/account deletion must be designed separately for data processing. No real production rollback was performed, no retention period or automatic deletion policy was set.

## Requirements and Verification Matrix

| Delta scene                                                                      | Verification entrance                                                                                                                                                                     |
| -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Five types of valid reports, invalid description/category, Unicode length        | [policy unit test](../../apps/api/test/unit/report.policy.spec.ts)、[HTTP test](../../apps/api/test/e2e/reports.e2e.spec.ts)                                                              |
| historical members, current/historical room host, end room                       | [PostgreSQL transaction test](../../apps/api/test/integration/reports.spec.ts) covers ACTIVE/LEFT/REMOVED/INVITED and OPEN/ENDING/ENDED; HTTP historical reporting process                |
| Forged identity/time, invalid session, self/cross-room, no joining fact          | HTTP extra fields, 401/400/404 consistency; domain joinedAt=null and reporter priority verification                                                                                       |
| Concurrency and response loss retry, content change conflict, reporter isolation | Same real database/unique conflict across rooms, retry to reestablish connection, and different reporters with the same request ID                                                        |
| Reporting and auditing are all successful or failed                              | Database trigger injection into Report and RoomEvent respectively failed to write; verification did not exist on both sides, and successfully matched reportId/actor/target/category/time |
| Existing room host management/connection audit                                   | Reuse audit writer and run pre-regression; report concurrent leave/remove/end without losing historical qualifications                                                                    |
| Minimal results, text privacy, no query/modification/penalty/notification        | HTTP accurate body, log capture, routing 404, provider/outbox and room/membership/account no change assertion                                                                             |
| Data migration, database last line of defense                                    | [migration test](../../apps/api/test/integration/report-migration.spec.ts) and transaction constraint testing, covering enum/length/self/FK/unique audit/RESTRICT                         |
| Full HTTP smoke supported by database                                            | Fake OAuth adapter + real Session/Prisma: Login→Supplement information→Build/Join→Leave/End→Report→Retry; query Report/RoomEvent one each                                                 |

## Local verification result

| Check                                                           | Result                                                                                                                                      |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Prisma validate / migrate                                       | PASS; the complete six-segment migration chain of the isolated database, independent empty database and historical data upgrade test passed |
| Orientation rule test                                           | PASS; 16 policy unit tests                                                                                                                  |
| Directed PostgreSQL / migration / HTTP                          | PASS; 27 tests, passed once, including real database HTTP closed loop                                                                       |
| Final `pnpm verify:api`                                         | PASS; 90 units, 67 integrations, 39 HTTP E2E, 196 total; lint, typecheck, build, OpenAPI drift passed                                       |
| `pnpm format:check`                                             | PASS                                                                                                                                        |
| `pnpm deps:check`                                               | PASS; 169 modules, 513 dependencies, no module boundary or circular dependency violation                                                    |
| `openspec validate implement-safety-reporting-backend --strict` | PASS                                                                                                                                        |

The tests corresponding to all back-end range scenarios of the above matrix have passed. This time there are 43 new tests; after the implementation is completed, the complete `pnpm verify:api` will only run for one round and pass once. After document registration, only the document will be reformatted and the business test will not be rerun.

Environment log: Docker daemon stopped causing first migrate to fail; continue after starting Docker Desktop, restoring the isolated container, and successfully executing the full migration chain. Development checks fixed a test type declaration and a lint wrapper issue; environment failures or unexecuted items were not logged as PASS.

Frontend/Figma, physical device, product owner acceptance, CI and production deployment are not performed. The database reporting process of this change does not rely on Cloud; the front-end LiveKit/room host management Cloud item remains unfinished and will not be replaced by this back-end verification.

## 2026-09-15 Main spec merge and archive acceptance

The user confirms that this change executes "Merge and synchronize main spec → Verify → Archive", and the acceptance scope is the delivered basic reporting backend. The number of tests and unexecuted items on 2026-09-12 above are retained as historical evidence; the front-end LiveKit/room host management Cloud items have not yet been completed and remain unarchived, and the deployment status is still undeployed.

The follow-up `2026-09-15-implement-safety-case-restrictions-backend` has been archived and the report acceptance has been expanded. This time, the old delta is merged with the main spec for compatibility, retaining reports, unique safety cases and the same transaction submissions initially assigned when available, as well as scenarios where there is no safety officer, case creation fails, and the original case is retried; the minimum submission credential alignment is `id/caseId/submittedAt`. These behaviors are from subsequent archived changes, which are also reflected in the current controller, repository and HTTP tests, and are not recorded as capabilities delivered by this change on 2026-09-12.

This time, only specifications and archived materials will be synchronized. Business codes will not be modified, business tests will not be re-run, and existing test records will not be regarded as new execution results.

The results of this archive verification: change strictly verify PASS; all 14 main specs strictly verify PASS; 5 delta requirements are consistent with the merged main spec, the other 2 original requirements are retained, the 17/17 task is completed, and the difference blank check PASS.

Archive location: `openspec/changes/archive/2026-09-15-implement-safety-reporting-backend/`, schema is `spec-driven`. Subsequent cloud environment verification, front-end/device acceptance and deployment are still tracked separately and are not completed by this archive mark.
