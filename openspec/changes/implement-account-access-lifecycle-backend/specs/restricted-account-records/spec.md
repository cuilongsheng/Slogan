## Purpose

Define the minimally restricted backend access to the necessary status and security associations of deleted accounts so that security investigations can retain continuity while preventing ordinary operations, auditing, or unrelated backend roles from accessing authentication secrets and non-essential private information.

## ADDED Requirements

### Requirement: Canceled account records are only open to administrators and safety officers

The system MUST only allow users who currently hold `PLATFORM_ADMIN` or `SAFETY_OFFICER` to query the necessary records of canceled accounts. Not accessible to regular users, only `OPERATIONS_ANALYST`, or only `AUDITOR` users; one role may not be implicitly relaxed by another role's permissions.

#### Scenario: Administrator or safety officer queries canceled accounts

- **WHEN** The current valid backend user holds the platform administrator or safety officer role and requests a restricted account record with the specified userId
- **THEN** The system returns the minimum record according to the current permissions of the role and writes and reads the audit

#### Scenario: Unauthorized role direct call

- **WHEN** Ordinary users, operations analysts or auditors who do not have the administrator/safety officer role directly request this record
- **THEN** The system denies access, does not return additional information on whether the account exists, and records the denial for audit.

#### Scenario: Role has been revoked

- **WHEN** The user requested restricted records using an access token issued before the role was revoked.
- **THEN** The system denies access based on the current persistent role, the old token does not retain revoked permissions

### Requirement: Restricted account response uses minimum field set

The system MUST return only the account ID, account status, creation/account deletion time, login method category, minimum snapshot of data, and references/status of relevant security cases, active or historical restrictions, and appeals necessary for investigation. The response MUST not contain the full phone number, phone number lookup summary, OAuth issuer/subject, authorization code, access/refresh token, verification code, provider response, key, room password, private note, or full voice content.

#### Scenario: Query existing canceled accounts

- **WHEN** An authorized administrator or safety officer queries a `DELETED` account
- **THEN** The system returns minimal accounts and security associations, and does not return authentication secrets or private content not relevant to the investigation.

#### Scenario: Query a target that does not exist or is not allowed to be viewed

- **WHEN** The target does not exist or the caller does not have the corresponding recording permission.
- **THEN** The system returns stable non-leakage results and does not distinguish the existence of the target through status code or text.

### Requirement: Restricted reads must be auditable and must not modify the account

The system MUST log the actor, current role, target userId, server time, request ID, result, and normalized reason for successful and rejected restricted queries; auditing MUST not copy private fields in responses. This query MUST be a read-only operation and may not restore accounts, unbind identities, lift penalties, or modify security facts.

#### Scenario: Successful read leaving audit

- **WHEN** The administrator or safety officer successfully read the canceled account record
- **THEN** The system submits a corresponding read audit and the audit only contains minimal metadata

#### Scenario: Repeated reading

- **WHEN** The same admin user repeatedly queries the same account
- **THEN** Each independent read can be tracked, but it will not change the account, identity, security case or restriction status
