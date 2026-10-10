## Why

The existing backend already has room, reservation, AI/STT, security case and backend role capabilities, but lacks unified operational indicators, exception alarms and provable data cleaning boundaries. It cannot support operations analysts to perform their duties, and cannot prove data minimization, fault discovery and recovery capabilities before public testing. The V1 backend needs to converge these cross-domain facts into a minimally privileged, auditable and recoverable operation and maintenance closed loop.

## What Changes

- Added platform summary and trend indicators, including data completion, first entry, room and effective communication, appointment fulfillment, sharing conversion, AI/keyword usage, retention and security processing; indicators use server-side facts and clear caliber, time zone and freshness, and do not infer from logs or client statements.
- Added restricted operation details and internal active user sorting for platform administrators; operations analysts can only read anonymous aggregates that reach the minimum grouping threshold, and are not allowed to read users, room members, report text, case evidence, or private content.
- Add persistent exception events, deduplication, state transition and query capabilities, covering provider/Redis/PostgreSQL readiness, durable command or job accumulation, processing delay, cleanup failure and indicator expiration; alarm failure does not block the voice room or business transactions.
- Added data classification, retention policy snapshot, cleanup run, dry-run, batch limit, lease/fencing, failed recovery and deletion count proof; temporary content is cleaned according to the existing maximum seven-day boundary, and automatic physical deletion is prohibited by default for reports, penalties, appeals, audits and account identity facts that have not yet been approved.
- Add operation and maintenance contracts and acceptance records for database backup, isolation recovery, integrity check and recovery drill; production credentials, real deployment and public user testing are still executed by the target environment and are not replaced by local fixtures.
- Extended background permissions and auditing: Platform administrators can read all operational views and governance operations, operational analysts can only read anonymous indicators, and auditors can only read alarm/governance audit results; all sensitive views, policy enablement, cleanup, and alarm status operations are left with minimal auditing.
- Extend OpenAPI, configuration, migration, maintenance runner, observation desensitization and local/real environment acceptance documents.

## Capabilities

### New Capabilities

- `operations-metrics`: Define V1 indicator caliber, anonymous aggregation, trend query, freshness, internal details and minimum permission boundaries.
- `operational-alerting`: Define exception facts, deduplication, recovery and restricted queries across provider, storage, queue, cleanup and metrics pipelines.
- `data-retention-governance`: Define data classification, policy snapshots, security cleanup, dry-run, recovery, proof of retention, and prohibit deletion boundaries.
- `backup-recovery-readiness`: Define backup, quarantine recovery, integrity verification and target environment walkthrough evidence for PostgreSQL/required configuration.

### Modified Capabilities

- `backoffice-access-control`: Add mutually isolated indicators, operational details, alarms and governance permissions for platform administrators, operational analysts and auditors.
- `backoffice-audit`: Incorporate operational sensitive reads, alert handling, retention policy enablement, cleanup runs, and recovery drills into minimum append auditing.
- `temporary-speech-processing`: Connect the longest retention and deletion results of temporary voice processing to the unified governance certificate, and generate downgrade facts when the deletion certificate fails.

## Impact

- `apps/api/prisma/`: New metric snapshots, exception events, retention policy/run/sharding and recovery drill facts and corresponding indexes; only forward compatible migrations are used.
- `apps/api/src/modules/`: Add operations/governance application and infrastructure boundaries, and extend the minimum public ports of backoffice, audit, assistance, room-speech-processing, speech-safety, post-room-learning and account-lifecycle.
- `apps/api/src/workers/`: Add indicators, alarms and cleanup runner that can run independently, with leases and fencing; reuse PostgreSQL persistent facts to coordinate with Redis, and do not treat Redis as audit truth.
- `openapi/openapi.yaml`: Added background metrics, restricted details, exceptions, and governance query/command APIs; all paging, time ranges, aggregation thresholds, and errors remain stable contracts.
- `apps/api/src/config/` and deployment information: Add feature flag, cycle, threshold, batch, retention and alarm sink configuration; real backup recovery and external alarm delivery require target environment credentials and running certificates.
- Does not include PC management backend UI, mobile end point buried SDK, any original audio/complete transcription collection, data repository/BI products, audit export, personal data download, physical deletion of unapproved security evidence, or automatic deployment of production environment.
