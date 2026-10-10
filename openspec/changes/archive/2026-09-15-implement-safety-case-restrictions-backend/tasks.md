## 1. Data model and module basics

- [x] 1.1 Added enums/models/relations/indexes required for new cases, participant snapshots, case activities, restrictions, appeals, idempotent commands and allocation cursors in Prisma schema, and extended the audit system actor; run `pnpm --filter @slogan/api exec prisma format && pnpm --filter @slogan/api exec prisma validate` to verify the schema.
- [x] 1.2 Create deployable migration: initialize allocation cursor, backfill unique `OPEN` cases, minimum activity and obtainable member snapshots for all historical `Report` idempotent snapshots; perform migration in test database and verify with SQL that the number of reports equals the number of unique cases and there are no orphan foreign keys.
- [x] 1.3 Establish domain entities, ports, errors, state transitions, rank durations, Unicode reason normalization, and command hash policy for the `safety` module; verify 3/12/24 hours, 30 minute windows, illegal transitions, and conditional fields with targeted unit tests.
- [x] 1.4 Establish the minimum skeleton of safety repository, transaction persistence helper and module exports, and verify that `pnpm --filter @slogan/api typecheck` passes and no module loop occurs in dependency-cruiser.

## 2. Reporting and case assignment

- [x] 2.1 Expand the report acceptance transaction to achieve all or nothing between `Report`, report `RoomEvent`, unique `SafetyCase`, participant snapshot, creation activity and initial system audit; use integration test to inject midway failure and verify that there are no half-finished reports.
- [x] 2.2 Return stable `caseId` in report response and idempotent replay, retaining the original fields; use integration test to verify that the same request returns the original report/case, and different content reuse request identifiers return conflicts.
- [x] 2.3 Implement atomic automatic allocation based on current active safety officer, minimum load of open cases and persistent rotation cursor; use multiple safety officer integration test to verify minimum load, parallel rotation and retain unassigned cases when there is no safety officer.
- [x] 2.4 Implement the compare-and-set repository operation of unallocated case collection and reassignment of invalid handlers; use concurrent integration test to verify that there is only one current handler after automatic allocation, collection and recovery competition.

## 3. Backend permissions and audit expansion

- [x] 3.1 Add case full read, case work, restricted work and appeal work permissions, and update role mapping; use policy/guard unit tests to verify administrator read-only, safety officer work permissions, dual role permission union and other role denials.
- [x] 3.2 Extended administrative audit action whitelisting, DTO filtering and `SYSTEM_JOB` actors, covering cases, evidence, assignments, restrictions, expirations, appeals and permanent bans; run audit targeted tests to verify that new actions are queryable and unknown actions are rejected.
- [x] 3.3 Implement transaction success auditing and fixed field whitelisting for case, evidence, restriction, and appeal sensitive reads; use repository test to fail audit writes and verify that sensitive data will not be returned.
- [x] 3.4 Add minimum rejection auditing for authenticated background users' roles, statuses, windows and concurrent rejections, while maintaining basic background rejections for ordinary users; use API tests to verify that the business status remains unchanged and that the audit does not contain the report/appeal body or request body.
- [x] 3.5 Extract and reuse the platform administrator set transaction lock to jointly protect the last effective administrator in permanent disabling and role revocation; verify with cross-concurrency integration test that the number of effective administrators cannot be reduced to zero.

## 4. Case query, evidence and state machine

- [x] 4.1 Implement the backend case list and details repository, support stable cursors and approved status, time, target user filtering and role scope; use integration tests to verify the full amount of administrators, safety officer himself plus unassigned, illegal cursors and cross-processor isolation.
- [x] 4.2 Implement bounded evidence package projection, combining reports, accepting member snapshots, room events, room host management events, related reports/cases/restrictions summaries, and case activities; use fixture test to verify stable order, empty signal markers, and truncation information.
- [x] 4.3 Establish explicit whitelist mappings for evidence DTOs; use serialization tests and sensitive word assertions to verify that responses do not contain tokens, provider subjects, full transliterations, ORM original objects, or non-essential data.
- [x] 4.4 Implement the persistent idempotent, resource ownership and version protection of case collection and `OPEN -> UNDER_REVIEW` commands; use targeted integration tests to verify retries, request identification content conflicts, rejection of other people's cases, and consistent concurrency status.
- [x] 4.5 implements `DISMISSED` and `RESOLVED/NO_ACTION` artificial final state transactions, atomically writes cases, activities, commands and successful audits; uses tests to verify that no restrictions are created, the final state cannot be determined again and a single report will not be automatically advanced.
- [x] 4.6 implements the `TEMPORARY_RESTRICTION` case closing transaction, calculating the fixed level period and appeal deadline based on database time; use fake clock/database integration test to verify that the client cannot specify the duration and retry does not recalculate the time.
- [x] 4.7 implements `PERMANENT_DISABLE` case closing transactions, verification level and `factsConfirmed`, atomic write permanent disposal, disabling users, revoking sessions, terminating cases and auditing; using tests to verify general levels, unconfirmed facts and the last administrator are rejected.

## 5. Temporary restrictions on reading, execution and lifting

- [x] 5.1 Implements a shared transaction helper that calculates valid limits by PostgreSQL's current time, as well as highest valid level and latest end time projections; uses repository tests to verify bounds `now == endsAt`, overlapping limits, and a recalculation after lifting.
- [x] 5.2 Integrate sharing restriction check into instant room creation and joining transactions, and keep the existing `User.status` check; use API tests to verify that restricted users do not create rooms/memberships, and that login and read-only room capabilities are not accidentally affected by temporary restrictions.
- [x] 5.3 Integrate sharing limit verification into reservation room creation and reservation writing transactions; do not write `Room`/`RoomReservation` when verifying rejection with API tests, and restrictions that have expired but have not converged will be released immediately.
- [x] 5.4 Integrate sharing restriction verification into real-time credential reservation transactions to ensure rejection before provider calls; use fake realtime provider test to verify that restricted users will not create issuance or call token providers.
- [x] 5.5 implements stable paging and minimum projection of personal restriction history/current restrictions; use e2e tests to verify that only the user can be read, the current/history/appeal status is correct, and the reporter and background handler are not visible.
- [x] 5.6 implements safety officer to directly release transactions and idempotent replay in advance; use concurrent integration tests to verify that only one release fact is written, which immediately affects subsequent access and does not release other overlapping restrictions.

## 6. Temporary restriction of appeal closed loop

- [x] 6.1 Implement API and transactions for users to submit an appeal at or before `appealDeadlineAt`; use database-time tests to cover within window, boundary time, after window, expired/released, permanent disposal and other people's restrictions.
- [x] 6.2 Implement `(restrictionId)` unique constraints and `SafetyCommand` replay for appeal submission; use concurrent integration tests to verify that at most one appeal, the same request returns the original result, and different content reuse identification conflicts.
- [x] 6.3 Implement the safety officer pending appeal list and detail range, which must be audited if the query is successful; use permission/API tests to verify that the safety officer is readable, other single roles are denied, stable paging and sensitive fields are minimized.
- [x] 6.4 implements `UPHELD` and `LIFTED` appeal decision transactions, atomic update appeal, optional release, case activity, command and audit; use concurrent tests to verify that there is only one final state, the duration is maintained, and the release takes effect immediately.

## 7. Expiration and reallocation recovery

- [x] 7.1 adds independent `slogan-safety` BullMQ queue and `SafetyRunner`, the job only carries kind/id, and implements startup and fixed period database scanning; use unit tests to verify that the security module can still be started when Redis is not configured and the logs have no sensitive content.
- [x] 7.2 Try your best to schedule expiring jobs after creating temporary restrictions, and implement row lock protected idempotent `EXPIRED` convergence, activity, and `SYSTEM_JOB` auditing; use integration tests to verify that duplicate jobs, early release, and unexpired jobs are not written repeatedly.
- [x] 7.3 Restore unassigned cases and open cases with expired handlers in the runner, and reuse the same rotation algorithm; use multi-instance concurrent test to verify single handler, current role reading and stable load results.
- [x] 7.4 Execute runtime smoke after Redis shutdown, limit crossing `endsAt`, and Redis recovery, verify that the room entrance is released according to the database time and the projection finally converges; records the commands and observable results, and does not mark unexecuted steps as passed.

## 8. API Contract and complete acceptance

- [x] 8.1 implements all case, evidence, limit, appeal controller/DTO/error mapping and OpenAPI decorators, and runs `pnpm --filter @slogan/api openapi:generate` to update unique `openapi/openapi.yaml`.
- [x] 8.2 Check OpenAPI diff and parser: confirm that the report response retains the original fields, new routes/enums/condition fields/stable errors are logged and there is no second contract; run `pnpm --filter @slogan/api openapi:check`.
- [x] 8.3 Execute migration smoke once in the new database and the database with historical reports, verify the forward migration, idempotent backfill, application startup and application code rollback path that retains the newly added table, and record the actual SQL count evidence.
- [x] 8.4 adds a complete API e2e scenario from reporting, automatic allocation, collection, review, temporary restriction, entry rejection, appeal, release/expiry to restoration of access; run the corresponding e2e suite and check that each OpenSpec scenario has automation or clear runtime evidence.
- [x] 8.5 adds administrator/safety officer duty separation, old token role revocation, concurrent final state, overlapping restrictions, permanent disabling, and security regression for final administrator protection; run the corresponding integration/e2e suites and capture responses and log desensitization assertions.
- [x] 8.6 Perform a final affected-scope verification: `pnpm verify:api && pnpm deps:check`, then run `/Users/cls/.nvm/versions/node/v25.9.0/bin/openspec validate implement-safety-case-restrictions-backend --strict`; only check the task after all have actually passed and record any environment blocking or non-executed smoke.
