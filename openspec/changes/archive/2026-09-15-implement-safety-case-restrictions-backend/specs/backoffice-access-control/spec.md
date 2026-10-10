## ADDED Requirements

### Requirement: Backend security case permissions keep roles separated

The system MUST allow the current `PLATFORM_ADMIN` to view all security cases and allowed evidence, and allow the current `SAFETY_OFFICER` to view their own work queue, claim unassigned cases, and perform explicit case, restriction, and appeal actions. The platform administrator role MUST not imply safety officer disposal permissions, and the safety officer role MUST not imply role management, full backend auditing or operational indicator permissions; each request MUST be judged using the current persistent role and account status.

#### Scenario: Holds both the administrator and safety officer roles

- **WHEN** The current user holds both the platform administrator and safety officer roles.
- **THEN** The system allows him to view all cases with administrator permissions and handle cases assigned to him or received according to safety officer permissions.

#### Scenario: Administrator does not have safety officer role

- **WHEN** Only users with the platform administrator role view the case and try to close the case, impose penalties, lift restrictions or handle appeals
- **THEN** The system allows viewing but denies disposition action, and case, restriction, and appeal status remain unchanged

#### Scenario: The safety officer role has been revoked before processing the request.

- **WHEN** The user's old access token is still valid but his safety officer role has been revoked from PostgreSQL
- **THEN** The next case or penalty request will immediately lose the safety officer authority and must not rely on old tokens or cache to continue execution.

#### Scenario: safety officer account has been disabled

- **WHEN** User accounts holding the safety officer role are no longer available
- **THEN** The system denies its backend access and puts its open cases into the recoverable reassignment process

## MODIFIED Requirements

### Requirement: The system always retains a valid platform administrator

The system MUST prevent role management or security disposal from causing the platform to lose the last valid `PLATFORM_ADMIN`. Users can first grant the platform administrator role to another valid account, and then revoke the role of the original account or permanently disable the original account to complete the auditable transfer of management rights.

#### Scenario: Remove the last administrator

- **WHEN** The administrator attempted to revoke the administrator role of the only currently valid platform administrator.
- **THEN** The system returns a stable conflict, retains the original role and records the rejection result

#### Scenario: Permanently disable last administrator

- **WHEN** safety officer attempts to permanently disable the only currently valid platform administrator account
- **THEN** The system returns a stable conflict, keeps the account available and records the rejection result.

#### Scenario: Transfer administrator rights

- **WHEN** Another valid platform administrator already exists and the original administrator is revoked or permanently disabled.
- **THEN** The system allows the operation and ensures that there is still at least one valid platform administrator after the transaction is completed.

#### Scenario: Concurrently revoke multiple administrators

- **WHEN** Concurrent requests attempt to remove all active platform administrators via role revoke or permanent disablement
- **THEN** The system can perform at most operations that will not reduce the number of effective administrators to zero, and the remaining requests fail stably.
