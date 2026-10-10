# implement-backoffice-rbac-audit-backend acceptance

## Baseline

- Revision: `2687b1a30c90ee1b4abe5a768e28822153922b04` on `develop`; existing local OpenSpec work is preserved.
- Runtime: Node.js `24.21.0`, pnpm `12.3.4`.
- Unit: PASS, 15 suites / 113 tests.
- Integration: PASS, 13 suites / 89 tests against PostgreSQL on port 54329.
- E2E: PASS, 7 suites / 50 tests.
- Total: PASS, 252 tests. Initial sandbox attempts could not access local Docker/PostgreSQL/listen sockets; the same commands passed with local-service permission.
- Google and WeChat provider smoke still depends on external platform configuration. It is not counted as a local RBAC pass and does not block this change.

## Final verification

### Delivered behavior

- PostgreSQL is the role truth for `PLATFORM_ADMIN`, `SAFETY_OFFICER`, `OPERATIONS_ANALYST`, and `AUDITOR`; one user can hold multiple roles and revoked roles disappear from the next request even when the access token is still valid.
- `backoffice` owns authorization policy, current-role lookup, role management, last-admin protection, and the UUID-only bootstrap command. `audit` owns the independent append/query path; `RoomEvent` remains unchanged.
- The first-admin CLI atomically grants `PLATFORM_ADMIN` and `SAFETY_OFFICER`. The deterministic test identity `11111111-1111-4111-8111-111111111111` produced `created:true`; the retry produced `created:false`. PostgreSQL contained exactly two active assignments and one `BACKOFFICE_BOOTSTRAPPED/SUCCEEDED` audit.
- Role commands use normalized content plus `(actorUserId, clientRequestId)` persistent idempotency. The stored result snapshot is returned even after a later command changes the current assignment.
- Role changes, rejection audit, and sensitive reads are transactional. PostgreSQL trigger injection proved both role-first and audit-first failures do not return or commit partial protected results.
- The generated contract exposes only `GET /v1/backoffice/me`, `GET /v1/backoffice/role-assignments`, the two role mutation routes, and `GET /v1/backoffice/audit-events`. No audit update, delete, or export route exists.

### Delta scenario results

| Delta scenario                                          | Result | Evidence                                                                                        |
| ------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------- |
| The administrator also serves as safety officer         | PASS   | Bootstrap integration, CLI, and HTTP `/me` return both roles.                                   |
| Ordinary users directly call the background interface   | PASS   | HTTP returns `BACKOFFICE_ACCESS_DENIED` without data.                                           |
| Session or account invalid                              | PASS   | Existing session guard plus ACTIVE-user role tests; DISABLED/DELETED lose access.               |
| One character does not imply another character          | PASS   | Safety/operations cannot manage roles; auditor can only read audit.                             |
| Create your first backend account                       | PASS   | Transaction lock, two assignments, one system audit.                                            |
| Safely retry on the same account                        | PASS   | CLI and integration retry return `created:false`, one audit.                                    |
| Illegal target or initialization has been completed     | PASS   | Missing, disabled, partial target, and second-target bootstrap reject without partial writes.   |
| The administrator granted the safety officer role       | PASS   | HTTP and repository role grants return minimal assignment fields.                               |
| Non-administrators bypass the interface to modify roles | PASS   | Guard and repository defense reject direct HTTP access.                                         |
| Retry same character command                            | PASS   | Concurrent and reconnect retries return the original snapshot with one audit.                   |
| Reuse request identification modification content       | PASS   | HTTP/repository return `BACKOFFICE_REQUEST_CONFLICT`.                                           |
| Concurrently modify the same role                       | PASS   | Five concurrent commands converge on one result and audit.                                      |
| Remove the last administrator                           | PASS   | Role remains active and a REJECTED audit is committed.                                          |
| Transfer administrator rights                           | PASS   | Grant-then-revoke transfer leaves the second administrator active.                              |
| Concurrently revoke multiple administrators             | PASS   | One succeeds, one rejects, and PostgreSQL retains one active administrator.                     |
| Get the current background identity                     | PASS   | Response contains only `userId` and sorted `roles`.                                             |
| Role revocation takes effect immediately                | PASS   | Auditor's old token receives 403 on the next audit request.                                     |
| Successful audit of role modification                   | PASS   | Mutation and audit commit together with actor-role snapshot.                                    |
| Last administrator protection denied audit              | PASS   | REJECTED role audit persists while assignment remains active.                                   |
| The background sensitive list was viewed                | PASS   | Role/audit list reads append access audit; injected audit failure returns no list.              |
| Bootstrap operation audit                               | PASS   | `SYSTEM_BOOTSTRAP`, null user actor, fixed target and role details.                             |
| Audit role management request minimized                 | PASS   | Explicit writer mapping and details-key assertions; no raw DTO/header/error object.             |
| Request audit modification interface                    | PASS   | PATCH/DELETE receive 404 and no mutation route is generated.                                    |
| The user subsequently loses his role                    | PASS   | Stored actor-role snapshots remain unchanged after revocation.                                  |
| Auditor View Audit                                      | PASS   | Auditor reads paginated minimal events.                                                         |
| Administrator views audit                               | PASS   | Administrator reads and creates `AUDIT_EVENTS_VIEWED`.                                          |
| safety officer Try to view the full audit               | PASS   | Role-only access returns 403.                                                                   |
| Illegal filter and cursor                               | PASS   | DTO/date/cursor validation returns `VALIDATION_FAILED`.                                         |
| Audit persistence failed                                | PASS   | Trigger injection returns sanitized 500 and rolls back business result.                         |
| Capture actual logs and error responses                 | PASS   | Fixed event/request/result logging and redaction exclude reason, cursor, token, SQL, and stack. |

### Commands and counts

- `pnpm --filter @slogan/api exec prisma validate` — PASS.
- Isolated migration test — PASS, 2 cases: empty schema and a populated schema containing users, session, room, memberships, report, reservation, note, and RoomEvent. Existing rows remain queryable; new role/audit tables start empty; role uniqueness and RESTRICT relations hold.
- Application rollback evidence — PASS for the documented additive rollback: the migration does not alter or remove old columns/routes, old-data queries work after upgrade, and rollback retains the new role/audit tables instead of running a destructive down migration.
- Change-focused verification — PASS, 19 new tests plus 2 existing log-redaction tests.
- `pnpm verify:api` — PASS: unit 16 suites / 117 tests; integration 15 suites / 102 tests; E2E 8 suites / 52 tests; total 39 suites / 271 tests. Lint, typecheck, build, migration deploy, and OpenAPI check also passed.
- `pnpm format:check` — PASS.
- `pnpm deps:check` — PASS, 219 modules / 764 dependencies, zero violations.
- `pnpm --filter @slogan/api openapi:check` — PASS.
- `/Users/cls/.nvm/versions/node/v25.9.0/bin/openspec validate implement-backoffice-rbac-audit-backend --strict` — PASS with OpenSpec `1.12.0`.
- Runtime: Node.js `24.21.0`, pnpm `12.3.4`.

### Boundaries

- Production bootstrap was not run and no real user ID or provider credential is stored in the repository.
- PC admin UI, production deployment, MFA, break-glass access, retention/cleanup, and export remain outside this change.
- LiveKit Cloud smoke and Google/WeChat real-provider verification keep their prior unexecuted/configuration-dependent status; local fake providers are not reported as provider proof.
