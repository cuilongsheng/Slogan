## Purpose

Defines the username and password authentication capabilities of email verification, allowing users to register, log in, recover passwords, or add login methods to existing accounts, while maintaining existing data, session revocation, and account account deletion boundaries to avoid identity preemption, cross-account binding, and email credential leakage.

## ADDED Requirements

### Requirement: Registration input and unique identity

The system MUST accept usernames of 3–20 ASCII letters, numbers, or underscores, a valid ASCII mailbox of no more than 254 characters in length, and a password of 8–128 Unicode code points; usernames are case-insensitive, mailboxes are case-insensitive with leading and trailing whitespace removed, and plus labels or periods are not removed. Passwords MUST be processed as is, without clipping or silent truncation. Username and profile display name MUST be independent of each other; hitting a versioned common password rejection table MUST return a stable weak password error.

#### Scenario: New registration and occupied identity

- **WHEN** The user submits a registration application that meets the input rules
- **THEN** The system creates a short-term application pending verification; the username/email address occupied by the verified or canceled account returns corresponding stable occupation error. Repeated unverified applications must not modify the original application password or permanently occupy the identity.

#### Scenario: Concurrent verification of the same identity

- **WHEN** Multiple applications competing for the same canonical username or email address
- **THEN** At most one verification is successful and the identity is established, the others return stable conflicts, and do not overwrite existing passwords or repeatedly create accounts.

### Requirement: Email verification and controlled resending

The system MUST provide time-limited, purpose-limited, single-use email verification credentials. Unverified applications are not allowed to obtain platform access/refresh tokens. Resending MUST have a cooldown and does not extend the maximum survival time of the original application; the old credentials become invalid after the new credentials take effect. Simply opening the email link MUST not consume credentials.

#### Scenario: Verification completed

- **WHEN** User explicitly submitted valid registration verification credentials
- **THEN** The system creates verified email credentials and platform accounts at one time, returns verification success and requires password login; subsequent first-time information and adult restrictions are still in effect

#### Scenario: Expired, duplicate or wrong purpose

- **WHEN** Submit credentials that are expired, consumed, replaced by reissue, or used for other purposes
- **THEN** The system rejects the status change and returns a uniform invalid/expired result

#### Scenario: Resend and preemption protection

- **WHEN** The caller requested to resend the verification email
- **THEN** The system will only resend the application if it holds the opaque management credentials and meets the cooling/quota. It is not allowed to change the application password, cancel other people's applications or extend the occupancy period based only on the public email or user name.

### Requirement: Login with username and password

The system MUST only establish existing platform sessions for accounts with correct passwords, verified email addresses, and ACTIVE, and return existing onboarding status. There is no user name and incorrect password. MUST use the same error; only when the password is correct, a return to the email address for verification prompt is allowed.

#### Scenario: Successful login and permission boundaries

- **WHEN** Verified ACTIVE account submitted correct username and password
- **THEN** The system issues existing session types. Incomplete data, underage, room restrictions and administrative role checks continue to be executed according to the original rules.

#### Scenario: Disabled, deleted and invalid passwords

- **WHEN** The account is not ACTIVE or the credentials are incorrect
- **THEN** The system rejected the session without revealing password hashes, email addresses, or internal account status.

### Requirement: Email password recovery and concurrent session revocation

The system MUST return the same retrieval acceptance status for registered and unregistered email addresses; a valid reset credential can only set a new password once. After success, all platform sessions of the account and other uncompleted credential resets will be cancelled, and automatic login will not be performed. Reset MUST not restore disabled or deleted accounts.

#### Scenario: Password reset successful

- **WHEN** ACTIVE Verified account submits valid reset credentials and compliant new password
- **THEN** The new password takes effect, the old password and all old access/refresh tokens are no longer available, and the user needs to log in again

#### Scenario: Concurrent login and refresh of old password

- **WHEN** Password reset concurrently with old password login and session refresh
- **THEN** A new or refreshed valid session based on the old credentials must not be left after the reset is complete

#### Scenario: Replay and account enumeration

- **WHEN** Requesting retrieval of a non-existent mailbox, or replaying used reset credentials
- **THEN** Retrieval acceptance does not disclose the existence, reset and replay does not change the password or issue the session again

### Requirement: Bind email password to existing account

The system MUST require a valid login session, re-authentication of the current login method, and verification of the target email address before binding a unique username and password to the current account. Reauthentication proofs MUST be bound to the user, session, purpose, and command and cannot be exchanged for account-deletion proofs. Email confirmation MUST also verify that the original linking session remains valid. The system MUST not automatically merge accounts based on OAuth mailboxes.

#### Scenario: Binding successful

- **WHEN** The logged-in account has completed re-authentication of the current login method and verification of the target email address.
- **THEN** The email password is associated with the same userId, the original login method, information and business data are retained, and the desensitized EMAIL_PASSWORD is added to the login method list.

#### Scenario: Identity conflict or session invalidation

- **WHEN** The target identity has been assigned to another account, the current account already has email credentials, or the session that initiated the binding has been revoked.
- **THEN** Reject overwriting/merging and binding, and do not change the identity of any account

### Requirement: Compatible with email account account deletion

The system MUST allow a signed-in email/password account to generate a short-lived account-deletion proof using the current password and continue through the existing explicit confirmation and deletion command. After deletion, the username/email remains reserved, the password and all pending verification, linking, and reset credentials become invalid, and existing security-audit retention rules remain unchanged.

#### Scenario: delete the account and then re-enter

- **WHEN** After deleting the account the email account, try to log in, reset, re-register or consume the credentials before deleting the account.
- **THEN** The system cannot restore the account or create a new account with the same identity. The old session is still invalid.

### Requirement: Email reliability and credential privacy

The system MUST persistently save the delivery status of accepted emails, provide an upper limit for retry and restart recovery, and MUST not incorrectly mark the mailbox as verified if the email fails to be sent. Credentials, password, full email address, and message body MUST not appear in logs, errors, audits, or general queries. Restorable credential payloads for expired or completed messages MUST be purged within 24 hours.

#### Scenario: Delivery failure and uncertain result

- **WHEN** The email timed out, failed temporarily, or the sending process restarted
- **THEN** The acceptance fact remains recoverable. Repeated emails will not be given additional verification times. When the retry limit is reached, it will stop and allow controlled resending.

#### Scenario: Link security and logs

- **WHEN** Email generation verification or reset link
- **THEN** Only use server-side configured trusted HTTPS targets, do not accept request-injected bounce addresses, do not expose credentials via URL query/access logs or errors

### Requirement: Switches, Quotas and External Acceptance

The system MUST turn off email authentication by default; verify email, encryption, and trusted link configurations when enabled. Registration, login, resend, retrieval, and reauthentication MUST enforce source and destination quotas across instances; reject these requests when coordination is unavailable and not fall back to unlimited sends or password attempts.

#### Scenario: Quota and dependency failure

- **WHEN** Source/destination/global mail quota reached or coordination service unavailable
- **THEN** Returns stable current limit/unavailable error and does not add unbounded delivery, and does not affect the existing OAuth and room interfaces

#### Scenario: Real email acceptance is missing

- **WHEN** Failure to obtain real sending service, domain name and verifiable receiving environment
- **THEN** The local test and the real email evidence are recorded separately, the real send/reset smoke remains BLOCKED, and the local mailbox capture test is not marked as external acceptance passed.
