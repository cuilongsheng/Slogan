## Context

See motivation for `proposal.md`. Currently PostgreSQL has saved accounts, rooms, members, appointments, shares, security cases, background audits, AI/STT usage, keywords and persistent command facts; Redis is only suitable for presence, rate limiting, leases and temporary candidates. Each module already has scattered purge/readiness methods, but there is no unified strategy, running proof, indicator snapshot or cross-domain exception life cycle. The background has read the current PostgreSQL role as requested, and the OpenAPI is generated one-way by NestJS decorators.

## Goals / Non-Goals

**Goals:**

- Generate replayable V1 metrics from existing persistent facts without capturing new speech content or free text.
- Establish metrics, exceptions, policies, cleanup runs, and recovery drills as PostgreSQL persistent truth, and let Redis only take care of lossless coordination.
- Keep the permissions of operational analysts, platform administrators and auditors isolated, and all sensitive control plane behaviors are audited first and then returned.
- Provide version, dry-run, lease, fencing, batch, recovery and preservation hold boundaries for automatic cleaning.
- Cover local temporary content cleanup and provider removal claims with the same governance evidence while honestly preserving external proof gaps.

**Non-Goals:**

- Does not introduce data repository, BI SaaS, mobile terminal general tracking, third-party user portraits or cross-site tracking.
- Does not build PC management backend UI, audit export, personal data download, or production deployment pipeline.
- This change does not determine security evidence, penalties, appeals, audits, identities, and physical removal periods for user private content.
- Do not back up Redis temporary state, do not call real providers in recovery drills, and do not express local recovery tests as production proof.

## Decisions

### 1. PostgreSQL event facts plus window snapshot, instead of scanning or copying the full event repository during query

Metric runner reads existing normalized table in UTC daily/weekly window, writes snapshot with `metricKey`, dimension whitelist, caliber version, window and numerator/denominator. Close the window to replay and overwrite the same version of the results with a unique key; the number of real-time online users individually marks the sampling time and does not pretend to be historical facts. This avoids aggregation across large tables for each background request, and does not create a new data repository containing more personal tracks.

Alternatives are live SQL or copying all business actions to the analytics event table. It is difficult to stably control the load and caliber of real-time SQL; the general event table will expand the data copy and privacy, so it is rejected.

### 2. Grouping dimensions use typed whitelist and k>=10 suppression

Metric keys and values use a controlled schema and do not accept arbitrary column names or free labels. Operations analysts query the mandatory minimum sample of ten, and calculate the threshold again for the combined dimension. The group cannot be differentially restored through multiple queries; the administrator details independent permissions, DTO, repository and audit paths. The cache key only contains the normalized filtered summary and does not contain user or room data.

The alternatives are to rely on the front-end to hide sensitive columns or just round the final result, neither of which prevent direct API requests and differential attacks.

### 3. Cross-domain governance is coordinated through narrow ports, preventing the operations module from directly importing other module repositories.

Each domain exposes read-only statistical projections and controlled purge adapters such as counting windows, candidate scans, batch deletions and dependency checks; the operations/governance application relies only on these ports. The unified runner is responsible for orchestration, does not read the internal Prisma repository, and does not allow domain services to rely reversely on the management module. dependency-cruiser solidifies this direction.

The alternative is a super repository with all Prisma models. Although development is fast, it will bypass the domain and delete invariants and form circular dependencies.

### 4. The policy snapshot is separated from the execution run, and irreversible deletion is refused by default.

`RetentionPolicyVersion` saves immutable classification, range, period, basis and automatic run flag; `RetentionDryRun` saves candidate boundaries and short-term validity period; `RetentionRun`/batch saves generation, cursor and count. Scan uses stable `(eligibleAt,id)` cursor, rechecks policy, hold, and references before execution; deletes and updates count within database transaction each batch. Security evidence, auditing, identity and user content classification are fixed as `RETAIN` in the code policy, cannot be bypassed by configuration, and can only be released through independent OpenSpec and migration in the future.

Redis/BullMQ can trigger runs, but PostgreSQL row leases and fencing generation determine write eligibility. In this way, if Redis is lost, duplicate jobs or old processes are late, they will not be duplicated or deleted out of bounds.

### 5. Abnormal use of fingerprint occurrence and persistent delivery outbox

`OperationalIncident` uses component, category, scope summary and rule version to form a fingerprint, and the same open occurrence is atomically accumulated; resume and close the current occurrence, and fail to create a new occurrence again. External sink only receives whitelist digest and is retried by standalone `OperationalAlertDelivery`. Business transactions only write the status of this field; if an exception is found after detection or outboxing, the alarm sink fails and the business is not rolled back.

Alternatives are to just write logs or call Slack/email synchronously within the business request. The log cannot provide a closed loop of status, and synchronization notification will expand the delay and fault coupling, so it is rejected.

### 6. Clean up the proof record results and strategies, and do not save the deleted content

Governance facts only keep category, scope summary, policy version, count, time and stability errors. The local cleanup of temporary voice is reported by the existing processing boundary; the provider deletes/does not retain the use configuration statement and available confirmation interface, and creates an incident when the result is uncertain. Do not save audio, transcription, AI text or provider original response in the proof to avoid "re-copying content to prove deletion".

### 7. Backup and recovery are performed by controlled scripts, and the application only saves minimal drill facts

The backup/restore script reuses the PostgreSQL tool of the deployment environment, and checks that the environment identifier, target isolation, external provider are all disabled/fake and schema compatible before starting. Run read-only invariant checker after recovery; application database records only backup summary, version, observed RPO/RTO, and check results. The backup location, connection string and encryption key are left in the deployment secret management, and the business library or audit is not written.

Local Docker recovery is used to verify scripts and invariants; target environment walkthroughs must record versions, times, and observations separately. The corresponding acceptance task remains BLOCKED when there are no target environment credentials.

### 8. The API continues to use NestJS code-first one-way generation of OpenAPI

Backend API grouped by `/v1/backoffice/operations/*`, `/v1/backoffice/incidents/*` and `/v1/backoffice/governance/*`, using stable cursor, ISO time, enum and explicit range DTO. Swagger decorators are the only generation source. After the update, `openapi/openapi.yaml` is deterministically generated and drift checks are run. The second handwritten agreement is not maintained.

## Risks / Trade-offs

- [Direct aggregation may increase PostgreSQL load] → Only handle closed windows, use water levels and indexes, limit recalculation scope, and log execution plans and latencies on real-scale fixtures.
- [Small samples can be differentially inferred by multiple dimensions] → Fixed whitelist, re-apply threshold after combination, limit the number of windows/dimensions and audit the query scope.
- [Unified cleanup of excessive runner permissions] → Domain narrow ports, code-level prohibited deletion categories, dry-run, short lease, fencing, batch transactions and preservation hold multi-layer constraints.
- [Alarm Storm] → Fingerprint deduplication, continuous failure threshold, cooling and recovery occurrence, setting an upper limit on the delivery queue and degrading itself only generates a single aggregate event.
- [Subsequent adjustment of the indicator caliber] → Version the caliber and retain the old snapshot; the new version does not silently rewrite the historical display, and the recalculation range needs to be explicitly marked.
- [Backup exists but cannot be restored] → Marked verified only if isolation recovery and invariant checks pass; local, pre-release and production evidence are clearly distinguished.
- [Real provider or deployment environment is missing] → Local implementation and testing can be completed, but external alerts, provider deletion, and target environment recovery tasks remain outstanding and changes are not archived.

## Migration Plan

1. Deploying additive migration, permission enum compatibility mapping, and new runner binary with feature flags off; old API does not read new tables.
2. Run historical fixture migration, build metrics/governance index and verify existing room, security, audit and user content has not changed.
3. First enable the read-only indicator backfill and verify the caliber, suppression and query plan in the administrator environment; then open anonymous queries to operational analysts.
4. Enable incident detection and internal query, then configure the external sink and verify the outbox and try again; the sink is not ready and does not affect business readiness.
5. Enable retention policy only for temporary content and approved technical records, dry-run reconciliation first, and then enable automatic run in small batches; security/auditing/identity/user content retention `RETAIN`.
6. Perform isolated recovery locally and pre-release, and finally perform a real walkthrough in the target environment according to the approval window and record the actual RPO/RTO.
7. When rolling back, first close the runner and write API, and then roll back the application; retain new tables, snapshots, exceptions, policies, running and drill facts, and do not perform destructive down migration. Committed deletions are not recoverable, so rollback cannot rely on re-creating the cleaned content.
