## MODIFIED Requirements

### Requirement: The administrative role uses persistent multi-role authorization

The system MUST support `PLATFORM_ADMIN`, `SAFETY_OFFICER`, `OPERATIONS_ANALYST`, `AUDITOR`, and the restricted `PUBLIC_TRIAL_VIEWER` role. Existing private roles may coexist on one user; a public trial identity MUST NOT combine its role with private backoffice roles. Backend access MUST require a valid session, available account status, and currently valid persisted role. Client declarations and old tokens MUST NOT independently grant permissions.

#### Scenario: The administrator also serves as safety officer

- **WHEN** a valid private user holds both platform administrator and safety officer roles
- **THEN** the system returns both current roles and allows only their explicitly authorized capabilities

#### Scenario: Ordinary users directly call the background interface

- **WHEN** a user with a valid normal session but no administrative role requests a backoffice endpoint
- **THEN** the system rejects backoffice access without returning admin data

#### Scenario: Session or account invalid

- **WHEN** the role holder's session expires or account becomes unavailable
- **THEN** existing authentication boundaries reject access, regardless of the role

#### Scenario: One character does not imply another character

- **WHEN** a platform administrator lacks the safety officer role or a safety officer lacks the administrator role
- **THEN** the system denies the exclusive actions of the missing role

#### Scenario: Public trial role cannot be elevated

- **WHEN** a role-management request targets a public trial identity for any private backoffice role
- **THEN** the request is rejected without changing that identity's roles

## ADDED Requirements

### Requirement: Public backoffice viewers have a server-enforced safe read surface

The system MUST limit `PUBLIC_TRIAL_VIEWER` to sanitized active/scheduled room summaries and aggregate counts. It MUST deny room administration, safety disposition, appeals handling, role management, governance commands, and other business mutations. It MUST NOT expose credentials, personal contact details, raw safety evidence, private conversations, or identifiable private audit records. Client-side hiding of controls MUST NOT substitute for server-side checks.

#### Scenario: View public-safe rooms

- **WHEN** an active public viewer requests the allowed room summary
- **THEN** the server returns public-safe room metadata and aggregate counts without private account identifiers or evidence

#### Scenario: Direct mutation bypass

- **WHEN** a public viewer directly calls a room, safety, role, or governance mutation endpoint
- **THEN** the server rejects the request and business state remains unchanged

#### Scenario: Direct private data request

- **WHEN** a public viewer requests private audits, safety evidence, or account records
- **THEN** access is denied without returning those records

#### Scenario: Role revocation

- **WHEN** the public viewer role is revoked while its old token remains valid
- **THEN** subsequent backoffice requests use current persisted roles and reject access
