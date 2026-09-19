# implement-safety-case-restrictions-backend acceptance

## Baseline and result

- Date: 2026-09-15. Change tasks: 40/40 complete; implementation is local and archived, but not deployed.
- Revision: `2687b1a30c90ee1b4abe5a768e28822153922b04` on `develop`. The repository already contains other uncommitted OpenSpec deliveries, so the revision is only the checkout baseline.
- Runtime: Node.js 24.21.0 and pnpm 12.3.4 for application verification; the required OpenSpec command used the explicit Node.js 25.9.0 binary.
- Final affected-scope verification: PASS. Unit 18 suites / 126 tests, integration 17 suites / 120 tests, HTTP E2E 9 suites / 54 tests; 44 suites / 300 tests total. Build, lint, typecheck, migration deploy, OpenAPI drift check, workspace audit, and dependency-cruiser also passed.

## Delivered behavior

- A report acceptance transaction now persists one `Report`, one linked `RoomEvent`, one unique `SafetyCase`, participant snapshots, creation/assignment activities, and system audit facts. Equivalent retries return the original report and `caseId`; injected failures at each write boundary roll back the whole transaction.
- New cases use current active `SAFETY_OFFICER` assignments, least open workload, and a locked persistent rotation cursor. Cases remain unassigned when no officer exists; recovery atomically assigns unowned cases and reassigns cases whose officer was disabled or lost the role.
- Platform administrators can read all cases. Safety officers can read their own and unassigned queues, claim cases, start review, dismiss, resolve, create or lift restrictions, and decide appeals. Current PostgreSQL roles are checked on every operation, including requests made with an older access token.
- Case decisions support `NO_ACTION`, fixed 3/12/24-hour temporary restrictions, and confirmed `SERIOUS`/`HIGH_RISK` permanent disable. Permanent disable atomically records the disposition, disables the user, revokes active sessions, and uses the same platform-admin set lock as role revocation.
- Active temporary restrictions block instant-room creation/join, appointment creation/reservation, and realtime credential issuance. They do not block login, read-only access to the user's own restriction history, or a valid appeal.
- Restriction enforcement uses PostgreSQL time and the durable interval `startsAt <= now < endsAt`. Overlapping restrictions remain independent; the error projection returns the highest active severity and latest active end time. Expired rows stop blocking immediately even before the asynchronous status projection converges.
- Each temporary restriction accepts at most one appeal through its inclusive 30-minute deadline. Submission and decisions are idempotent and serialized. `UPHELD` preserves the original end time; `LIFTED` records an early lift and restores access unless another restriction remains active.
- Sensitive case, evidence, restriction, and appeal reads append success audit in the same transaction. Trigger injection proves an audit failure prevents protected data from being returned. Rejected backoffice safety attempts store a minimal code and correlation identifier without report or appeal bodies.

## Migration and contract evidence

- Migration `20260914020000_safety_case_restrictions` passed on isolated fresh and historical schemas. Historical SQL evidence was: reports `1`, cases `1`, distinct case report IDs `1`, orphan cases `0`, orphan snapshots `0`, participant snapshots `2`, case activities `2`, assignment-state rows `1`.
- Re-running the data-only backfill retained one case, two activities, and two snapshots. The migration is additive; old room/report data remains readable and the rollback path retains the new tables for a forward fix rather than deleting safety evidence.
- PostgreSQL enum migration compatibility was verified against the complete historical migration chain. The audit actor check compares the newly added enum label through text so PostgreSQL does not reject same-transaction enum use.
- `openapi/openapi.yaml` remains the sole contract. It includes the report `caseId`, all approved case/restriction/appeal routes, role and safety enums, nullable terminal fields, explicit evidence DTOs, and the minimal own-restriction projection.

## Runtime and concurrency evidence

- Redis recovery smoke commands:
  - `docker compose -f docker-compose.test.yml stop redis-test`
  - delayed `docker compose -f docker-compose.test.yml start redis-test`
  - Jest `test/runtime/safety-redis-recovery.smoke.spec.ts`
- Observable result: while Redis was stopped, a restriction crossed `endsAt` but still had stored status `ACTIVE`; instant-room creation succeeded from PostgreSQL time. After Redis restarted, the fixed scan converged the row to `EXPIRED` in about 15 seconds and wrote exactly one `SYSTEM_JOB / SAFETY_RESTRICTION_EXPIRED` audit. Runtime smoke: 1 suite / 1 test, PASS in 16.5 seconds.
- PostgreSQL integration tests covered concurrent claim, first appeal, appeal decision, early lift, expiry, assignment recovery, terminal decisions, and cross-operation last-admin protection. Each race retained one authoritative result.

## Commands

- `pnpm format:check` — PASS.
- `pnpm verify:api && pnpm deps:check` — PASS; dependency-cruiser checked 240 modules / 876 dependencies with zero violations.
- `pnpm --filter @slogan/api openapi:check` — PASS.
- `/Users/cls/.nvm/versions/node/v25.9.0/bin/openspec validate implement-safety-case-restrictions-backend --strict` — PASS.

The first final verification attempt exposed a test-harness issue: five expected audit-write failures were started before Jest attached rejection assertions. The test was changed to start each expected failure sequentially; the focused test and the complete final verification then passed. No business implementation rollback was required.

## Boundaries

- This change does not add live-room kick or host takeover, room disable, STT, automated punishment, permanent-disable appeal/recovery, admin UI, retention cleanup, deployment, or production evidence.
- Existing LiveKit Cloud, OAuth provider, appointment Cloud lifecycle, and product-owner acceptance items keep their prior status and are not counted as proof from this change.
