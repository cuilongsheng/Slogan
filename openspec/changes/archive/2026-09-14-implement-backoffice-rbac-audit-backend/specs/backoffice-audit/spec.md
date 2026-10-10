## Purpose

Define persistent audit boundaries for background high-privilege data viewing and status modification, so that operators, current roles, goals, causes, times and results can be traced, while avoiding audit records from expanding sensitive data exposure.

## ADDED Requirements

### Requirement: Sensitive background access and operations must be audited

The system MUST log administrative audit events for bootstrap, role view, role grant, role revocation, and administrative audit view. The event MUST contain the operator type, operator user ID when available, role snapshot at the time of the operation, action, target, cause or query scope, result, server time, and request correlation ID.

#### Scenario: Role modified successfully

- **WHEN** The platform administrator successfully granted or revoked a administrative role
- **THEN** The system saves successful audits that can be associated with role results, and role modifications and audits are all submitted or all fail.

#### Scenario: Last administrator protection denied operation

- **WHEN** An administrator request that has passed identity and role verification will result in no valid platform administrator.
- **THEN** The system retains roles and logs audit events with stable denial results

#### Scenario: The background sensitive list was viewed

- **WHEN** Users with permissions can view role assignments or administrative audit lists
- **THEN** The system records the viewer, operation role, query type, time and success or failure results; the sensitive list must not be returned when the audit write fails

#### Scenario: bootstrap operation

- **WHEN** Create the first backend account for one-time operation and maintenance portal
- **THEN** The system records the target user, granted role, time and result with a clear system operator type, and does not forge ordinary user actors.

### Requirement: Backend auditing remains minimal and cannot be modified by business APIs

The system MUST save the administrative audit as an append fact and does not provide a business API to modify or delete the administrative audit. Audit content MUST use a field whitelist, and access/refresh tokens, provider secrets, passwords, complete report text, SQL, stack, or any request body snapshots MUST not be saved.

#### Scenario: Audit role management request

- **WHEN** The system records a role grant, revoke or deny event
- **THEN** The event only saves the identification, role, reason, result and related fields required for the action, and does not copy the authentication header or complete request object.

#### Scenario: Request audit modification interface

- **WHEN** The caller tried to modify or delete the existing administrative audit through the public API
- **THEN** The service route does not exist in the system and the existing audit remains unchanged.

#### Scenario: The user subsequently loses his role

- **WHEN** The operator of the audit event was later revoked from the role
- **THEN** Existing events still retain the character snapshot when the operation occurred and will not be overwritten by the current character status.

### Requirement: Background audit query follows least privileges

The system MUST only allow users who currently hold `PLATFORM_ADMIN` or `AUDITOR` to query the administrative audit by page. Queries MUST use stable cursors and provide only explicitly supported time, actor, action, target, and result filtering; safety officers or operations analysts without additional roles MUST not browse the full audit.

#### Scenario: Auditor View Audit

- **WHEN** The current auditor uses valid filtering and paging parameters to query the administrative audit
- **THEN** The system returns the minimum event projection and next page cursor in stable order, without providing any modification actions.

#### Scenario: Administrator views audit

- **WHEN** Current platform administrator queries administrative audit
- **THEN** The system allows reading and adds access audit for this view.

#### Scenario: safety officer Try to view the full audit

- **WHEN** Users who only hold the role of safety officer directly request full administrative audit
- **THEN** The system returns stable background permission denial and does not return event content

#### Scenario: Illegal filter and cursor

- **WHEN** The caller submitted illegal time, unknown action, too long identifier or damaged cursor
- **THEN** The system returns a stable verification error, does not execute the query and does not echo sensitive input in the error response.

### Requirement: Backend audit failure does not reveal internal information

The system MUST return a stable error to the client and record only the fixed event name, request identifier and stable result code in the technical log. Persistence or query failures must not expose SQL, stack, credentials, or protected audit content to the client or logs.

#### Scenario: Audit persistence failed

- **WHEN** Audit write required for role modification or sensitive read failed
- **THEN** The system does not return successful business results and returns a stable server error without database details.

#### Scenario: Capture actual logs and error responses

- **WHEN** Background authentication, verification or persistence failure is recorded
- **THEN** The captured logs and responses do not contain authentication credentials, original request body, SQL, stack or unnecessary user data
