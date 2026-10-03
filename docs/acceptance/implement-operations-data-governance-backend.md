# Operations data governance backend acceptance

## Local implementation

- Added versioned UTC metric runs/snapshots, anonymous share attribution, minimum sample suppression (`k >= 10`), current-online sampling, admin-only room/activity detail, stable cursors, data watermarks, and generation fencing.
- Added persistent operational incidents, observations, idempotent acknowledge/resolve commands, occurrence history, alert delivery outbox, exponential retry, and delivery fencing.
- Added immutable retention policy versions, short-lived dry-runs, preservation holds, confirmed/idempotent runs, leases, generation fencing, transactional batches, deletion evidence, and recovery-drill evidence.
- Protected account identity, private user content, safety evidence, enforcement/appeal data, and backoffice audit categories are fixed `RETAIN` in code and cannot receive a purge policy.
- Added platform-admin, operations-analyst, and auditor permissions. Restricted detail remains platform-admin only; incident/governance mutation remains platform-admin only.
- Added an operations worker that is inert while `OPERATIONS_GOVERNANCE_ENABLED=false`, schedules active automatic retention policies, probes PostgreSQL/Redis/LiveKit/AI/STT/SMS, converges phone-auth Redis orphans, dispatches alert/recovery events, and exposes 21 generated operations/governance OpenAPI paths.

## Metric and privacy boundaries

Metrics read committed server facts. The implementation does not add audio, transcript, note, report-body, provider-body, or arbitrary analytics-event storage. Operations analysts receive aggregate snapshots only. Groups below the configured minimum sample return `suppressed=true` with null value/numerator/denominator. Platform-admin detail returns non-content room state and activity counts and writes an audit event before returning.

Share-link resolution creates an anonymous UUID attribution row. A client may return that UUID when joining the same room; the membership transaction sets `joinedAt` once. No channel account or third-party tracking identifier is stored.

## Cleanup and deletion boundaries

The current local adapters purge expired AI output, old operations metrics, completed operational/social/safety/account/vocabulary/realtime commands, completed keyword jobs, and expired speech-risk technical facts in bounded transactions. Temporary local speech windows and transcripts are released and record content-free deletion evidence. The STT provider port declares `NO_RETENTION` or deletion-after-processing assurance; unconfirmed or failed confirmation records `UNCERTAIN`, creates a deduplicated governance incident, and degrades governance health after its deadline without blocking live voice.

Retention dry-runs contain only counts and earliest/latest eligible times. Actual execution requires the exact confirmation string `DELETE APPROVED RETENTION CANDIDATES`, a fresh unused dry-run, platform-admin permission, and a new client request ID. Global active holds stop a batch before deletion. Each committed batch stores only counts and cursor metadata.

## Migration, rollout, and rollback

The migration is additive and the feature defaults off. The verified rollout sequence is migration → administrator-only read metrics → incident/outbox → reviewed dry-run → small cleanup batches. Rollback disables runners and write APIs while retaining governance facts. It does not attempt to restore already deleted content. See [operations-data-governance-runbook.md](../operations-data-governance-runbook.md).

## Local verification evidence

- PostgreSQL migration: 18 migrations applied to PostgreSQL 17.6. The additive migration passed both an empty schema and a realistic historical fixture containing accounts, room memberships, a reservation, AI/STT consent facts, a report/case/restriction/appeal, an audit event, and a realtime command.
- Isolated recovery smoke: a real PostgreSQL 17.6 custom-format dump was restored to `slogan_recovery_isolated`; all nine strengthened invariant groups passed; the isolated database and temporary dump were destroyed. Observed local elapsed time was 2 seconds. Evidence label: `local-docker-2026-09-23`; backup digest: `0e5fbdc6ced7b00ca3d051791d3c6aef307314d28989ecb7f17c5f61bb4dde4d`.
- Negative guard smoke: incomplete backup policy and non-isolated restore were both rejected before a tool invocation, with no connection string in captured output.
- Targeted unit/integration/E2E tests cover UTC windows, dimension whitelist, `k=10` suppression, protected categories, permissions, incident concurrency/recurrence/idempotency, retention dry-run/run fencing, evidence minimization, migration compatibility, and direct HTTP RBAC.
- The repeatable PostgreSQL scale fixture inserted 1,000 metric snapshots, returned a bounded 100-row page through the indexed window path, and completed the observed local query/test assertion in 461 ms (2-second test ceiling). This is local regression evidence, not a production-capacity claim.

Final affected-scope verification on 2026-09-23:

- `pnpm format:check`, Prisma validate/generate, API lint/typecheck, dependency-cruiser (423 modules and 1,785 dependencies), API build, OpenAPI generate/check, and `git diff --check`: passed.
- Unit: 35 suites and 195 tests passed.
- Integration: 33 suites and 179 tests passed against PostgreSQL 17.6 and Redis 7.4.
- HTTP E2E: 15 suites and 73 tests passed.
- Runtime: 7 suites and 9 tests passed against PostgreSQL/Redis.
- OpenSpec strict validation: passed; tasks 1.1–9.5 are locally complete and task 9.6 remains open.

## External evidence status

`BLOCKED` — task 9.6 remains open. No target deployment credentials, approved retention window, real alert sink, provider deletion confirmation endpoint, encrypted backup target, or isolated target restore environment were available locally. Therefore this acceptance does not claim:

- real alert sink delivery and restart recovery;
- real STT/provider deletion or no-retention proof;
- scheduled metric and retention workers in the target deployment;
- encrypted target backup retention;
- target-environment RPO/RTO or production recovery readiness.

The change must remain active and unarchived until those checks are completed or the OpenSpec requirements are explicitly changed.
