## ADDED Requirements

### Requirement: Operationally sensitive read and governance control planes must be audited

The system MUST log background audits for sensitive reads of room operations details, internal active sorting, complete exceptions, retention policies, dry-runs, preservation holds, clean runs, and recovery drills, as well as exception acknowledgment/resolution, policy enablement, hold modifications, actual cleans, and drill starts. Events MUST use field whitelists to save the operator, current role, action, target type, query or run scope summary, cause, result, server time and request ID. Metric details, candidate ID lists, deleted content, backup locations or credentials MUST not be copied.

#### Scenario: Administrator performs cleanup

- **WHEN** Platform administrator confirms and initiates an actual cleanup run
- **THEN** The system saves the policy version, dry-run flag, scope summary and result audit, and the control plane commands and audit acceptance are all submitted or all fail

#### Scenario: Auditor reads recovery drill results

- **WHEN** Auditor reads minimum results of a recovery drill
- **THEN** The system records the read range and successful results, and does not copy the original value of the backup identifier or any recovery data.

#### Scenario: Unauthorized governance request

- **WHEN** The authenticated backend user requested a sensitive governance operation due to insufficient current role.
- **THEN** The system does not change governance status and records stable rejection results without candidate or content data
