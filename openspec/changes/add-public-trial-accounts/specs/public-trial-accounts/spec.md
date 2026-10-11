## Purpose

Provide explicitly public trial credentials with controlled lifecycle and limited data access while preserving private identities, normal authentication rules, and server-side authorization.

## ADDED Requirements

### Requirement: Public trial identities are distinct and environment bound

The system SHALL support two ordinary public trial identities, `demo_s1` and `demo_s2`, and one read-only backoffice trial identity, `demo_m1`. Provisioning SHALL target an explicitly named environment, preserve existing private accounts, and fail on an unrelated username collision. Repeated provisioning SHALL not reset unrelated credentials or duplicate identities.

#### Scenario: Safe repeat provisioning

- **WHEN** provisioning is repeated for the same public identities in the same environment
- **THEN** the original identity set is returned without additional users, roles, or private-account changes

#### Scenario: Username collision

- **WHEN** a requested public username already belongs to an unrelated account
- **THEN** provisioning fails without changing that account or partially creating the trial set

### Requirement: Public passwords have a scoped provisioning exception

The system SHALL permit the user-selected public password `12345678` only through controlled public-trial provisioning. Ordinary registration, password changes, and private pilot provisioning SHALL retain their existing password rules. Passwords SHALL be hashed using the existing credential mechanism and SHALL not be returned by account APIs or written to logs.

#### Scenario: Shared public password

- **WHEN** the operator provisions the three designated public trial identities
- **THEN** all three can authenticate using the documented public password with their respective permissions

#### Scenario: Ordinary weak password remains rejected

- **WHEN** an ordinary account attempts to set `12345678`
- **THEN** the existing weak-password rejection applies

### Requirement: Public access is revocable and truthfully documented

The system SHALL allow operators to disable public trial access and invalidate its sessions without affecting private accounts. Both root READMEs SHALL publish only the three public credentials, their access limitations, and working entry URLs after the target deployment and provisioning have completed. Trial accounts SHALL not become eligible to obtain private backoffice roles or change their own public credentials through self-service.

#### Scenario: Emergency disable

- **WHEN** an operator disables public trial access
- **THEN** public trial authentication and existing trial sessions lose access while private account login remains available

#### Scenario: Public README publication

- **WHEN** the public credentials are published
- **THEN** the English and Chinese instructions describe the same deployed identities and read-only backend boundaries without exposing private credentials
