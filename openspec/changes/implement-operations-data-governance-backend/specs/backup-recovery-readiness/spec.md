## Purpose

Define the backup, isolation recovery, integrity verification and drill evidence of V1 backend persistent data and necessary configuration, so that failure recovery capabilities can be proven before public testing, instead of treating local fixtures as proof of production recovery.

## ADDED Requirements

### Requirement: Backup scope and recovery target must be explicitly declared

The system MUST declare the environment, PostgreSQL data ranges, encryption and key management methods, backup period, retention amount, RPO and RTO goals before enabling backup of the target environment. Redis temporary state, application keys, and provider secrets MUST not serve as business truth that can be restored from database backups; key recovery MUST use a separate controlled process.

#### Scenario: Backup configuration missing recovery target

- **WHEN** The target environment does not have RPO, RTO, encryption, or retention boundaries configured
- **THEN** readiness reports that backup capabilities are not ready and does not claim recovery guarantees

#### Scenario: Backup product records

- **WHEN** A backup completed successfully
- **THEN** System records environment, time, logical scope, verification summary, tool version and results without credentials

### Requirement: Recovery drills are only performed in isolation environments

The system MUST restore the backup to a target that is isolated from production and has controlled access, and is prohibited from overwriting the current production database. Walkthrough MUST use standalone database identification and explicit validation, and policy-based destruction of quarantine copies or retention of minimal walkthrough facts after validation is complete.

#### Scenario: Targeting the active production database

- **WHEN** Recovery command detected the target is the same as the active production database or cannot prove isolation
- **THEN** The system refused execution and did not write to the target

#### Scenario: Isolation recovery successful

- **WHEN** Valid backup restored to quarantine target
- **THEN** The system continues to perform schema, key table, reference and business invariant checks, and does not declare the drill to be successful just because the database is connectable.

### Requirement: Recovery verification covers key business invariants

The system MUST verify the quantity and referential integrity of migration status, account and identity occupancy, room and membership relationships, reservations, security cases/restrictions/appeals, backend roles/audits, user private content, persistent commands, and governance facts. Check MUST not call real LiveKit, AI/STT, SMS or alert providers, nor send notifications to real users.

#### Scenario: There is a dangling security record after recovery.

- **WHEN** A restriction, appeal, or audit reference in the quarantine database is missing the target fact
- **THEN** The walkthrough failed and logged the minimum failure category and did not mark the backup as verified

#### Scenario: Resume validation triggers external side effects

- **WHEN** The isolation environment does not have clear fake/disabled provider boundaries
- **THEN** Recovery verification refuses to start, avoiding connection to real external system

### Requirement: Restricted visibility of drill results and retention of actual observed values

The system MUST save exercise start/end times, backup identification summaries, tool/schema versions, observed recovery times, RPO distances, inspection results, and operators. It MUST not save database connection strings, keys, or data content. Only `PLATFORM_ADMIN` can launch the drill and view full results, `AUDITOR` can read-only results; MUST audit each time it is launched and viewed.

#### Scenario: Walkthrough reaches configuration target

- **WHEN** Isolation recovery and all invariant checks passed and observations were within configured targets
- **THEN** The system marks this exercise as successful and retains the actual observation values. There is no need to configure targets to replace the measurement results.

#### Scenario: Local fixture walkthrough

- **WHEN** Recovery verification is only completed on the local test database
- **THEN** Evidence is clearly marked as local and may not be used as proof of recovery for production or public test environments
