## Purpose

Define persistent discovery, deduplication, recovery, and restricted viewing capabilities for backend critical dependencies, asynchronous convergence, and data governance exceptions so that failures can be tracked without turning the alarm system into a single point of dependency for business availability.

## ADDED Requirements

### Requirement: Critical operational exception forms minimum persistent fact

The system MUST monitor PostgreSQL, Redis, LiveKit, AI/STT/SMS provider readiness, persistent command and job accumulation or expiration, case allocation/limit recovery delay, temporary data cleanup failure, indicator snapshot expiration and backup recovery drill failure. Exception facts MUST only contain component, category, severity, scope type, first/last observed time, count, status, and stability reason code. Keys, connection strings, original requests, audio, full transcripts, report text, or private content MUST not be saved.

#### Scenario: provider readiness fails continuously

- **WHEN** The same provider reached the failure threshold within the configuration window
- **THEN** The system creates or updates a corresponding anomaly fact and records the first and latest observation times, without creating duplicate events for each detection.

#### Scenario: Abnormal payload contains sensitive values

- **WHEN** Downstream error object contains credentials, URL query parameters, or provider raw response
- **THEN** The system only saves the whitelist reason code and minimum range, but does not save the original value.

### Requirement: Exception lifecycle idempotent and retain recovery facts

The system MUST use stable fingerprints to merge duplicate anomalies of the same component, category, and scope, and support the `OPEN`, `ACKNOWLEDGED`, `RESOLVED` states. Recovery detection MUST close the current exception but retain the history; a new round of failure MUST create a new occurrence, and the previous round of recovery time MUST not be overwritten.

#### Scenario: The same exception was found concurrently

- **WHEN** Multiple runners report the same abnormal fingerprint concurrently
- **THEN** The system only retains one currently open exception and atomically accumulates the observation count

#### Scenario: Component failed again after recovery

- **WHEN** The component corresponding to the resolved exception later reached the failure threshold again.
- **THEN** The system retains the old exception and creates a new open occurrence

### Requirement: Alarm operations and queries follow the minimum permissions

The system MUST only allow `PLATFORM_ADMIN` to view the full exception scope and confirm or manually resolve the exception, allow `AUDITOR` to read only the exception and status history, and allow `OPERATIONS_ANALYST` to only read trends aggregated by component, severity, and status that meet the minimum sample threshold. Confirm or resolve MUST carry the cause and caller UUID request identification, and use the current persistent role judgment.

#### Scenario: Administrator confirmation exception

- **WHEN** The platform administrator acknowledged an open exception with a valid reason and request ID.
- **THEN** The system idempotent saves the confirmation person, time and reason, and adds administrative audit

#### Scenario: Auditor modification exception

- **WHEN** Only users with the auditor role are trying to confirm or resolve the exception.
- **THEN** The system rejects the modification and retains the original status

#### Scenario: Operations analyst reads abnormal trend

- **WHEN** Operations analyst queries abnormal trends
- **THEN** The system only returns anonymous aggregates, not room, user, command or provider request identifiers.

### Requirement: External alarm delivery and business transaction isolation

The system MUST deliver exception notifications without content via a replaceable sink and retry in a persistent delivery state. The sink is unavailable. Submitted business results such as rooms, security disposals, account account deletion, cleanups, or indicator snapshots MUST not be rolled back, and real-person voices MUST not be blocked. The system MUST retain delivery for retry and expose the delivery degradation status.

#### Scenario: External sink timeout

- **WHEN** Exception submitted but external alarm sink timed out
- **THEN** The business results remain submitted, the delivery enters the retryable state and the sensitive exception context is not copied.

#### Scenario: Delivery resumes after restarting

- **WHEN** The process restarted after the exception was submitted but before the notification was successful.
- **THEN** New runner can receive persistent delivery and complete or stable record failure
