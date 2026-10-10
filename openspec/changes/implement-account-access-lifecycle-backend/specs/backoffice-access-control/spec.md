## ADDED Requirements

### Requirement: The account has been canceled and it is necessary to record the use of independent background permissions.

The system MUST define independent read permissions for necessary records of deleted accounts and grant only `PLATFORM_ADMIN` and `SAFETY_OFFICER`. This permission MUST be computed on each request based on the current active session, account state, and persistent role, and may not be overridden by client claims, legacy tokens, or broad background access.

#### Scenario: Administrator and safety officer Read

- **WHEN** The same user holds both platform administrator and safety officer roles and requests restricted account records
- **THEN** The system allows reading and recording this actual authorized role set in the audit

#### Scenario: Only auditors request restricted account records

- **WHEN** The user only holds the `AUDITOR` role and directly requests the necessary records of the canceled account
- **THEN** The system denies access; the auditor role can only read its existing approved audit scope and does not automatically obtain user security information permissions

#### Scenario: The background account itself is unavailable

- **WHEN** The caller account with administrator or safety officer role is no longer in `ACTIVE`
- **THEN** The system rejects the session before the role is judged. The administrative role cannot bypass the account life cycle status.
