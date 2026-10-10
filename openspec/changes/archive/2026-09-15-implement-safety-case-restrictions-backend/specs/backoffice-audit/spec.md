## MODIFIED Requirements

### Requirement: Sensitive background access and operations must be audited

System MUST support bootstrap, role viewing, role granting, role revocation, administrative audit viewing, security case list and detail viewing, evidence package viewing, case assignment, collection and status advancement, case conclusion, temporary restrictions, automatic expiration, early release, appeal viewing and processing, and permanent disabling of recording administrative audit events. The event MUST contains the operator type, operator user ID when available, role snapshot at the time of operation, action, target, cause or query scope, result, server time and request association ID; automatic recovery actions MUST use a clear system operator type and MUST not forge ordinary users.

#### Scenario: Role modified successfully

- **WHEN** The platform administrator successfully granted or revoked a administrative role
- **THEN** The system saves successful audits that can be associated with role results, and role modifications and audits are all submitted or all fail.

#### Scenario: Last administrator protection denied operation

- **WHEN** An administrator request that has passed identity and role verification will result in no valid platform administrator.
- **THEN** The system retains roles and logs audit events with stable denial results

#### Scenario: The background sensitive list was viewed

- **WHEN** Users with permissions can view role assignments, background audits, case lists, case details, evidence packages or appeal lists
- **THEN** The system records the viewer, operation role, query type, time and success or failure results; sensitive data must not be returned when the audit write fails

#### Scenario: bootstrap operation

- **WHEN** Create the first backend account for one-time operation and maintenance portal
- **THEN** The system records the target user, granted role, time and result with a clear system operator type, and does not forge ordinary user actors.

#### Scenario: Safe disposal successful

- **WHEN** safety officer successfully closes case, imposes or early lifts restrictions, handles appeals, or permanently bans account
- **THEN** The system saves successful audits that can be associated with business results, and the business status and successful audits are all submitted or all fail.

#### Scenario: Safe disposal denied

- **WHEN** The authenticated backend user cannot complete security processing due to role, case status, appeal window or concurrency conflict
- **THEN** The system does not change the business status and records a stable rejection result that does not contain the report text or complete evidence.

#### Scenario: Automatic allocation or limit expiration

- **WHEN** System recovery process automatically assigns cases, reassigns failure handlers, or converges expired limits
- **THEN** The system records actions, goals, times and results with a clear system operator type, without forging safety officer actors
