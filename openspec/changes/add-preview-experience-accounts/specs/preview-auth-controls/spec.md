## Purpose

Define the independent availability of password authentication, Google login and email processes in the first round of web trials, limit the legal sources and environments of controlled preset credentials, maintain the boundaries of ordinary user authentication, secure sessions and temporary payload cleanup, and do not turn no-email trials into verification-free registration for any account.

## ADDED Requirements

### Requirement: Password authentication and email processes are independently controlled

The system MUST support explicit configuration of password authentication on and email flow off, retaining the configured Google login; this mode MUST not require SMTP, email encryption keys, or verify/reset email callback addresses, but still requires normal password quotas, signatures, and session security dependencies. When the new mail switch is not explicitly configured, the start-stop semantics of the old configuration MUST be maintained; illegal switch combinations MUST prevent startup.

#### Scenario: No email trial start

- **WHEN** Password authentication, experience account capabilities in the specified environment and Google have been configured correctly, the email process is explicitly closed and SMTP is not configured
- **THEN** The application starts normally, normal passwords and Google exchange are available, the email process is not available, and the browser still follows the security cookies and source verification of the public environment

#### Scenario: Ordinary mailbox mode keeps verification

- **WHEN** Mail flow is enabled but secure SMTP, encryption, trusted links or coordination configuration is missing
- **THEN** Startup failed, not applying trial mode exception to real mail mode

#### Scenario: Old configuration and illegal combination

- **WHEN** The new mail switch is not explicitly set, or mail is explicitly enabled but password authentication is turned off
- **THEN** The former maintains the email start and stop behavior corresponding to the old password switch, while the latter fails to start.

### Requirement: The controlled experience source cannot pretend to be an email address for verification

The system MUST distinguish between real mailbox verification and controlled experience initialization. Only experience credentials with correct passwords, ACTIVE status, valid controlled provisioning records, experience capabilities turned on, and matching environments can log in through provisioning exceptions; ordinary email credentials MUST still have real verification facts. Password login MUST not send emails, echo password hashes, full mailboxes, environment maps, or secrets to the client.

#### Scenario: Experience password and log in normally

- **WHEN** Submit the correct username and password for the ACTIVE account that has been initialized under control in the current experience environment.
- **THEN** Log in via normal password quota, authentication and session mechanisms, and return to original onboarding state without creating emails or bypassing backend/room authorization

#### Scenario: Invalid source and ordinary unverified identity

- **WHEN** Ordinary unverified application or attempted login with forged/missing credentials for controlled records
- **THEN** Session not established, not considered authenticated or controlled provisioned identity due to trial mode

#### Scenario: Source projection

- **WHEN** Authenticated users query their login method
- **THEN** The experience credential returns an identifiable controlled source and the email verification time is empty; the real email credential keeps the original verification time and does not display the initialization time as the email verification fact

### Requirement: Experience Credentials Maintain Secure Session and Environment Boundaries

The system MUST maintain the preset environment/validity boundary during password verification, session issuance, refresh and access verification; after the experience capability is turned off, the environment does not match, the preset record is retired, or the account is disabled/deleted, access to the old session MUST not be restored. Bad passwords and unknown usernames MUST remain consistent errors; new password attempts MUST be rejected when Redis quotas are unavailable. Google identity MUST be verified according to the original rules and not automatically associated with accounts with preset passwords.

#### Scenario: Old Credentials and Cross-Environment Denials

- **WHEN** The logged-in experience user is later retired, disabled, deleted, or accesses and closes services that do not match the experience capabilities/environment.
- **THEN** New password login, old access and refresh cannot establish or restore access, and the account cannot be revived by opening an email or re-initializing it.

#### Scenario: Wrong password and quota failure

- **WHEN** Wrong password submitted, unknown username or password quota service unavailable
- **THEN** The former two return a unified result of invalid credentials, while the latter returns a stable and unavailable result. No session is issued or it degrades to infinite attempts.

#### Scenario: Google Visitor

- **WHEN** Guest logged in using valid Google OAuth credentials
- **THEN** Establish its normal independent identity and perform original onboarding. Do not merge preset accounts or grant background permissions due to similar display names or email addresses.

### Requirement: Reject all mail processes when mail is closed

When the email process is closed, the system MUST return a unified `EMAIL_AUTH_UNAVAILABLE`, HTTP 503, for registration, resending, email confirmation, retrieval/reset password, email binding, and binding-specific certification; MUST not create applications, challenges, or deliveries, do not call binding-specific external authentication, do not consume old email credentials, and do not return the sent success status. Normal password and Google login, normal password account deletion re-authentication MUST not be disabled for this reason.

#### Scenario: Direct request to close the interface

- **WHEN** The caller bypasses the UI and requests any closed email process interface, including submitting an email token that is still valid.
- **THEN** Returns a unified unavailable result without producing persistent email side effects, consuming tokens or changing password/binding status

#### Scenario: Keep password and delete the account

- **WHEN** Users who have logged in passwords provide the correct password and clear account deletion confirmation when the account life cycle capability is enabled.
- **THEN** Use the original purpose/session/command constrained account deletion process. Email closing does not block legal account deletion and does not relax proof verification.

### Requirement: Deactivating messages does not stop retention period cleanup

The system MUST stop collection and delivery when the mail process is closed, and maintain independent expiration temporary data cleanup; stop delivery switching MUST idempotent cancel old unterminated delivery and mail process challenges, clear restorable payloads and temporary identity/password materials, and avoid restarting or reopening old backlogs of mail delivery. Expired/completed payloads MUST maintain the original 24-hour purge boundary and temporary metadata period; official account, security audit, and still valid account deletion proof MUST not be accidentally deleted due to deactivation of purge.

#### Scenario: Old data to be delivered

- **WHEN** Services with pending delivery or expired lease records are switched to mail shutdown and run outage maintenance/cleanup
- **THEN** The mail service is not called, and the record is not marked as successfully delivered; the pending record is canceled and invalidates the old lease result, the payload is cleared, and repeated maintenance is not re-delivered.

#### Scenario: Deadline cleanup without email configuration

- **WHEN** The email is closed and the SMTP/AES configuration does not exist. The application has expired or the proof has reached the cleanup period.
- **THEN** Temporary materials can be cleaned according to the deadline without decryption, formal identity and auditing can be maintained, and unexpired ACCOUNT_DELETE proof can still be used normally.

### Requirement: The minimum authentication capability that the client can read

The system MUST provide authentication capability results that do not contain identities or secrets, allowing clients to determine password, Google, and email process availability. The result MUST be consistent with the effective configuration of the server and cannot be used as a substitute for requesting authorization; for unknown/failed results, the client MUST not open the email process.

#### Scenario: First round trial capability

- **WHEN** The client reads the configured first-round trial authentication capability
- **THEN** Returns the password and the minimum result available for Google and unavailable for email. It does not include account list, environment identifier, complete email address or provider key.

#### Scenario: Tampering with client status

- **WHEN** The caller's ability to forge emails is available and directly requests the interface
- **THEN** The server still rejects the request according to the actual closed status.
