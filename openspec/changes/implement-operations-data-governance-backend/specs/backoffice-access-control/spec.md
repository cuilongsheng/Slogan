## ADDED Requirements

### Requirement: Operational and governance permissions maintain role separation

The system MUST allow the current `OPERATIONS_ANALYST` to read only anonymous indicators, anomaly trends, and governance health aggregations that reach the privacy threshold; allow the current `PLATFORM_ADMIN` to read the complete operational control plane and execute alarm, retention, and recovery commands; allow the current `AUDITOR` to read only exceptions, governance runs, recovery drills, and related audits. No role MUST gain user/room details, case body, policy modification, clean execution, or resume execution permissions due to being able to read aggregates.

#### Scenario: Operations Analyst Access Anonymous Metrics

- **WHEN** Current Operations Analyst request for anonymous metrics or governance health trends
- **THEN** The system allows reading aggregates that meet the minimum sample and field whitelist

#### Scenario: Operations analyst requested clean execution

- **WHEN** The current operations analyst has made a direct request to enable a retention policy, perform a cleanup, or initiate a recovery drill
- **THEN** The system rejects the request without creating the command or leaking candidate data.

#### Scenario: Auditor read-only governance evidence

- **WHEN** The current auditor queries the alarm status history, cleanup operation or recovery drill results
- **THEN** The system returns a minimal read-only projection and rejects any status modifications

#### Scenario: Use old token after role revocation

- **WHEN** Operations, administrator, or audit role revoked but old access token still valid
- **THEN** The next operational or governance request reads the current persistent role and immediately denies the revoked permission
