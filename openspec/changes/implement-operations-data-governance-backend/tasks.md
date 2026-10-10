## 1. Schema, configuration and module boundaries

- [x] 1.1 Add enumerations and models such as MetricSnapshot, OperationalIncident/Observation/AlertDelivery, RetentionPolicyVersion/DryRun/Run/Batch/Hold, DeletionEvidence and RecoveryDrill, establish the unique constraints required for window version, open exception fingerprint, idempotent command and fencing, and verify them through Prisma validate/generate and schema tests
- [x] 1.2 Write an additive migration and execute it on an empty database and a historical fixture containing accounts, rooms, reservations, AI/STT, security cases, restrictions/appeals, audits and persistent commands, using real PostgreSQL to verify that old data, references and existing APIs remain compatible
- [x] 1.3 Add OPERATIONS_GOVERNANCE_ENABLED, indicator caliber/cycle/freshness, minimum sample, exception threshold/cooling, runner lease, clean batch/dry-run TTL, alarm sink and backup target configuration, verify that startup/readiness security fails when default shutdown, illegal upper limit or lack of security configuration and does not echo the configuration value
- [x] 1.4 Establish domain/application ports for indicator fact reading, incident repository/sink, domain retention adapter, management transaction and recovery evidence, run dependency-cruiser to verify that domain does not import NestJS, Prisma, Redis, HTTP DTO or other module internal implementations
- [x] 1.5 Establish a public entrance, worker entrance and feature flag assembly for the operations/governance module, verify that the runner will not be started when closed, write operations will not be exposed, and the existing API/worker will return unchanged
- [x] 1.6 Write migration, phased activation and rollback documents, verify and clearly migrate first, then read-only indicators, then alarm, and finally dry-run/small batch cleanup, and require rollback to retain governance facts and not try to recover deleted content

## 2. Indicator facts, caliber and snapshot

- [x] 2.1 Implement UTC daily/weekly window, caliber version, dimension whitelist and normalized snapshot key policy, verify boundary time, daylight saving time input, repeated dimensions, illegal combinations and unit tests of idempotent keys in the same window
- [x] 2.2 Add narrow read-only statistical projections in the account/profile, room/member connection, appointment/sharing, AI/keywords and security fields, verify that the projection only returns counts/durations/categories and does not contain free text, private content, authenticated identities or provider data
- [x] 2.3 Achieve data completion, first creation/joining, first voice connection, five minutes of effective communication and average effective room duration caliber, use reconnection, overlapping connection, cancellation and unstarted room fixtures to verify that there is no duplicate accumulation
- [x] 2.4 Implement AI to continue communication, save expressions after meetings, participate again within seven days, share from opening to joining and making reservations, verify that anonymous attribution, repeated openings, cross-links, cancellation of reservations and failed requests will not contaminate the numerator/denominator
- [x] 2.5 Implement report processing time, repeated removal/reporting users, room host processing completion rate and misjudgment/abuse result caliber, verify open cases, repeated reports and missing final status return PARTIAL/UNAVAILABLE instead of error zero value
- [x] 2.6 Implement indicator runner with PostgreSQL lease, water level, fencing and unique window version, verify that concurrent collection, repeated execution, process restart, old generation late commit and explicit recalculation all maintain a valid snapshot
- [x] 2.7 implements independent sampling path and indicator freshness judgment for real-time online people, verifies that when Redis/presence is unavailable, only the real-time value is marked as unavailable, historical snapshots are still readable and expiration windows generate deduplication exceptions

## 3. Indicator privacy, background query and operation details

- [x] 3.1 Achieve minimum sample suppression of no less than ten, combined dimension re-judgment and stable suppressed response, verify that small samples, empty groups and multiple differential queries do not return values that can be used to infer users/rooms
- [x] 3.2 Extend the backoffice permission map, configure mutually exclusive indicators, details, incidents and governance permissions for OPERATIONS_ANALYST, PLATFORM_ADMIN and AUDITOR, and use policy tests to verify the boundaries of all single roles and role revocations
- [x] 3.3 Implement anonymous indicator summary/trends query, support controlled time range, grain, metric and dimension filtering, verify stable sorting/pagination, freshness, numerator and denominator, PARTIAL/UNAVAILABLE and illegal filtering contracts
- [x] 3.4 Implement room operation details and internal active user sorting available only to PLATFORM_ADMIN, verify that only minimal non-content projections, stable cursors are returned, are not exposed to the normal API and are not read by penalties or recommended services
- [x] 3.5 Write minimal auditing for indicator aggregation reading and administrator detail reading, verify that sensitive reads do not return data when the audit fails, and the audit does not include indicator details, user lists, or any free text
- [x] 3.6 Use real-world PostgreSQL scale fixtures to validate metric queries and runner's index/execution plans, window caps, and timeout bounds, and document repeatable test scale and results without fabricating production capacity

## 4. Abnormal discovery, life cycle and delivery

- [x] 4.1 Implement incident fingerprint, severity, continuous failure threshold, cooling and OPEN/ACKNOWLEDGED/RESOLVED state policies, verify repeated observations, relapse after recovery, illegal state transitions and cause normalization
- [x] 4.2 Implement concurrent upsert, occurrence history, and idempotent confirm/resolve commands for the incident repository, using real PostgreSQL to verify that the same open fingerprint is unique, counts are correct, and request identification payload conflicts
- [x] 4.3 implements PostgreSQL/Redis/LiveKit/AI/STT/SMS readiness, command/job accumulation, case/limit delay, cleanup failure, indicator expiration and recovery failure probes, verify that the probe only reports the whitelist range and reason code
- [x] 4.4 Implement incident list/details, aggregation trend and administrator confirmation/resolution API, verify administrator complete control, auditor read-only, operation analyst only aggregation, ordinary user/safety officer rejection and old token role revocation with immediate effect
- [x] 4.5 implements replaceable alarm sink, persistent delivery outbox, backoff and fencing runner, uses fake sink to verify success, failure, timeout, uncertainty and restart recovery without rolling back the business or repeatedly sending completed delivery
- [x] 4.6 Extended log desensitization and exception payload whitelist test, capture success/failure logs of probe, sink, query and status commands, verify that connection string, URL query, provider body, token, key and content data are not visible

## 5. Retention policy, dry-run and safe execution

- [x] 5.1 implements data category registry and code-level default actions, verifies that the temporary voice limit does not exceed seven days, security evidence, punishment/appeal, audit, identity and user private content are fixed RETAIN and environment variables/API cannot be bypassed
- [x] 5.2 Implement creation, check and enable transactions of immutable RetentionPolicyVersion, verify that only PLATFORM_ADMIN is operable, basis/scope/period are complete, concurrency enables serialization and success/rejection auditing is consistent with the results
- [x] 5.3 Implement RetentionDryRun’s stable candidate boundaries, count/time summaries and expiration rules, verify that the response does not contain candidate identification or content, repeatedly requests idempotent and cannot be executed after expiration or policy changes
- [x] 5.4 Implement preservation hold creation, release and hit judgment by category/target/time range, verify hold atomic blocking candidates, release requires independent audit, and old runner cannot bypass the latest hold
- [x] 5.5 Implement the actual cleanup command confirmation text, clientRequestId, payload hash and dry-run binding, verify that there is no status change for the same command to be safely replayed, change payload conflicts, unconfirmed/no permissions/unapproved categories
- [x] 5.6 Implement RetentionRun/Batch's PostgreSQL lease, generation, stable cursor, batch cap and count commit, verify that concurrent runners, process restarts, old lease late arrival, single batch failure rollback and final count are consistent with deletion facts
- [x] 5.7 implements policy, dry-run, hold and run administrator/auditor/operation aggregation queries, validates field minimization, stable paging, successful and rejected audits and does not return sensitive control plane data when audit fails

## 6. Domain cleanup adaptation and deletion proof

- [x] 6.1 implements domain retention adapter for AI short-term output, OTP/temporary coordination, speech risk technical facts, keyword candidate/job, realtime/social/safety/account technical commands, and verifies that each adapter only deletes approved final state technical records and retains user results and recovery commands
- [x] 6.2 Added non-deletable contract tests for reports, cases, restrictions, appeals, background audits, PhoneIdentity/OAuthIdentity, room history, notes, READY keyword summary and wordbook to verify that any automatic or admin management commands are skipped
- [x] 6.3 Connect local temporary audio, complete transcription and short window release results to DeletionEvidence. Verification success, failure, timeout, cancellation and shutdown paths only save the purpose, strategy, time and results without content.
- [x] 6.4 Extended STT/provider adapter's deletion or non-retention statement and optional confirmation results. Verification failure/uncertainty will generate a governance incident. If it exceeds seven days, the related readiness will be unqualified but it will not block real-person voice.
- [x] 6.5 implements orphan detection, reference checking and batch transactions, uses intentionally created active references and constraint failures to verify no accidental deletion, rolls back the entire batch and generates a single deduplication management exception
- [x] 6.6 Running cross-domain cleanup runtime on real PostgreSQL/Redis, verifying dry-run numbers, actual batches, restart recovery, fencing, Redis TTL/orphan convergence and all RETAIN categories remain unchanged

## 7. Backup, isolation recovery and integrity check

- [x] 7.1 Writing a controlled PostgreSQL backup script and configuration check that refuses to run without environment identification, encryption/preservation/RPO/RTO claims or security credential boundaries, logs and evidence do not contain connection strings or keys
- [x] 7.2 Writing restore scripts for production target guarding and external provider disabled/fake gatekeeping fails before writing when verification points to a live database, cannot prove isolation, or may send real notifications
- [x] 7.3 Implement a post-recovery read-only invariant checker covering migration, identity occupancy, rooms/members, reservations, security, roles/audits, private content, persistent commands, and governance references, and verify each type of failure is identifiable with a corruption fixture
- [x] 7.4 implements RecoveryDrill minimal result logging with administrator launch/query, auditor read-only API, verification saves actual RPO/RTO observations and inspection results, does not save backup locations, connection strings or recovery data
- [x] 7.5 Complete real backup, isolation library recovery, invariant check and smoke destruction in local Docker PostgreSQL, record tool/schema version, time consumption and local evidence label, and verify that the result will not be marked as production proof

## 8. API, OpenAPI, Observability and Maintenance

- [x] 8.1 Adds DTO, stable error, time/cursor/enumeration checks and default caps for metrics, details, incident, policy, dry-run, hold, run and recovery APIs, runs HTTP E2E verification that direct requests cannot bypass RBAC, suppress or confirm boundaries
- [x] 8.2 extends BackofficeAuditAction, target/result whitelist and audit repository, verifies that all newly added sensitive reads/commands are traceable and does not introduce update/delete/export audit routes
- [x] 8.3 Extended readiness/health output is component status and data policy status without credentials, and the observable semantics of verification dependency failure, stale indicators, deletion uncertainty and sink degradation do not incorrectly block the core voice business
- [x] 8.4 Update module public entrance and dependency-cruiser rules to verify that operations/governance only reads each field through the public port and there is no cross-module Prisma import or circular dependency
- [x] 8.5 Regenerate `openapi/openapi.yaml` and run drift check to verify that the permission descriptions, paging, time, enumeration, confirmation fields and sensitive fields of all background operation/governance contracts are consistent with the runtime

## 9. Verification and acceptance

- [x] 9.1 Complete window/caliber, five-minute deduplication, seven-day retention, shared attribution, small sample suppression, incident fingerprint, policy/hold, dry-run, fencing, idempotent and desensitization unit tests, and verify that all target tests are passed
- [x] 9.2 Complete historical migration, snapshot concurrency/recalculation, incident/outbox recovery, clean transaction/restart and local backup/restore integration/runtime tests on real PostgreSQL and Redis, and record database, Redis and PostgreSQL tool versions
- [x] 9.3 Complete HTTP E2E for operational analyst anonymous indicators, administrator details/incident/governance, auditor read-only, role revocation, confirmation and audit atomicity, and verify that ordinary users and wrong roles cannot obtain or modify data through direct API
- [x] 9.4 Run format, Prisma validate/generate, OpenAPI drift, dependency boundaries, build, full unit/integration/e2e/runtime, `git diff --check` and OpenSpec strict validation, and log commands, quantities and results in a final affected-scope validation
- [x] 9.5 Write `docs/acceptance/implement-operations-data-governance-backend.md` to record local implementation, indicator caliber/privacy, cleanup protection, migration/rollback, local recovery, external sink/provider/target environment evidence and all BLOCKED items
- [ ] 9.6 Verify real alarm sink delivery/recovery, provider deletion or no retention proof, scheduled indicator/cleanup run and encrypted backup to the actual RPO/RTO of isolation recovery in the target deployment environment; record BLOCKED when credentials, approval window, privacy/retention policy or target environment are missing, keep this task incomplete and do not archive change
