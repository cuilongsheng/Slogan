## Purpose

Define the adult audio room platform's mobile phone number independent authentication, multi-login method binding and account soft account deletion closed loop, so that identity verification, access convergence and necessary facts are retained to achieve stable results under concurrency, retries and external provider failures.

## ADDED Requirements

### Requirement: International mobile number OTP request for secure and non-enumerable accounts

The system MUST accept international mobile phone numbers that can be normalized to E.164 and request a one-time verification code. A successful response MUST only return the opaque challenge identifier, expiration time and allowed resend time, and MUST not indicate whether the mobile phone number has been registered. The system MUST implement bounded flow and retransmission cooling for mobile phone number irreversible digests, source addresses, devices, and sending frequencies.

#### Scenario: Requesting a valid mobile phone number verification code

- **WHEN** The caller submitted a valid mobile phone number in a supported country or region and the current limit was not triggered.
- **THEN** The system requests the SMS provider to send a short-term verification code and returns a unified challenge result that does not reveal the existence of the account.

#### Scenario: The mobile phone number format is invalid or the region is not supported

- **WHEN** The caller submission cannot be normalized to a valid E.164 or a currently unsupported mobile phone number
- **THEN** The system rejects the request and does not call the SMS provider or create a challenge.

#### Scenario: Resend cooldown or current limit hit

- **WHEN** The same mobile phone number summary, source or device exceeds the allowed number of requests within the limit window
- **THEN** The system returns stable rate limiting results, does not send verification codes again, and does not reveal which rate limiting dimension is hit.

#### Scenario: SMS provider is not available

- **WHEN** provider explicitly failed, timed out, or returned unconfirmable results
- **THEN** The system returns normalization failure or uncertain status, does not create an account, does not save the clear text verification code, and keeps OAuth login available.

### Requirement: OTP verification creates or logs in to a unique account at one time

The system MUST only accept correct verification codes that belong to the current challenge, have not expired, and have not been consumed. For first-time verification, MUST atomically create a `ACTIVE` platform account and unique mobile phone number identity, and for subsequent verification, MUST log in to the same account; concurrent requests MUST not create multiple platform accounts for the same mobile phone number or repeatedly consume the same verification code.

#### Scenario: First mobile phone number verification successful

- **WHEN** Valid challenge with no mobile phone number bound and received correct verification code
- **THEN** The system only creates a platform account and mobile phone number identity, issues a new session and returns to the data initialization state

#### Scenario: The mobile phone number has been bound and verified again.

- **WHEN** The mobile phone number bound to a valid account completes the new OTP verification
- **THEN** The system logs in to the original platform account and does not create duplicate users or mobile phone numbers.

#### Scenario: Verification code is wrong or expired

- **WHEN** The verification code is incorrect, the challenge has expired, or the verification code has been consumed.
- **THEN** The system refuses verification and does not create an account or session. The error response must not echo the verification code or complete mobile phone number.

#### Scenario: Verification attempt limit exceeded

- **WHEN** The number of incorrect verification code attempts for the same challenge has reached the upper limit.
- **THEN** The system invalidates the challenge and requires a new request, and no further brute force attempts are allowed.

#### Scenario: Concurrent consumption of the same verification code

- **WHEN** Two requests submitted the same challenge and correct verification code concurrently
- **THEN** At most one request can complete consumption and login. There is still only one account and one mobile phone number in the database.

### Requirement: Mobile phone identity and verification codes use minimum data boundaries

The system MUST persist only versioned phone number irreversible lookup summaries and fragments required to provide the minimum mask, and MUST not save full phone numbers or clear text verification codes in PostgreSQL, Redis, queues, audits, logs, exceptions, or traces. The SMS provider request MUST only contain the number required for delivery, verification code, template and controlled association information, and MUST not contain user information, room information, OAuth token or platform key.

#### Scenario: OTP processing completed or failed

- **WHEN** The challenge is consumed, expired, the attempt limit is reached, the sending fails, or maintenance and cleanup are running.
- **THEN** The system deletes the corresponding temporary verification code status, and the diagnostic output only retains the normalization stage, provider category, region, status and error category.

#### Scenario: Query the current login method

- **WHEN** Logged-in user reads his/her login method
- **THEN** The system only returns the login method category, verification time and minimum mask of the mobile phone number, but does not return the complete number, provider subject or any token.

### Requirement: Login method binding must be re-verified and cannot be guessed and merged

The system MUST only allow the current `ACTIVE` user to bind this login method to his or her account after completing the OTP or Google/WeChat OAuth verification of the target mobile phone number again. Retry MUST idempotent when the same identity already belongs to you; MUST stabilize the conflict when the identity already belongs to another platform account, and the data of any account MUST not be moved. The system may not use email, nickname, avatar, phone number similarity, or provider suggestion information to automatically merge accounts.

#### Scenario: Bind new OAuth login method

- **WHEN** The logged-in user completed an unbound Google or WeChat authentication
- **THEN** The system binds this identity to the current platform account, and the original information, room history, vocabulary and security facts remain under the same userId

#### Scenario: Bind new mobile phone number login method

- **WHEN** Users who have logged in and do not yet have a mobile phone number complete OTP verification of their mobile phone number
- **THEN** The system binds the mobile phone number identity to the current platform account and does not create new users.

#### Scenario: Repeatedly bind my identity

- **WHEN** User repeatedly submits the same verified identity that already belongs to him/her
- **THEN** The system returns the same binding result and does not create duplicate identity records

#### Scenario: The identity belongs to another platform account

- **WHEN** The mobile phone number or OAuth identity verified by the current user has been bound to a different userId
- **THEN** The system returns a stable identity conflict, does not reveal another account information and does not migrate, copy or delete any business data

### Requirement: The unavailable account cannot be accessed through any credentials.

The system MUST read the current account status in the OTP, OAuth, access token, refresh token and login method binding path. `DISABLED` or `DELETED` accounts may not obtain new sessions, refresh existing sessions, or bind new identities, nor may old access tokens and live credentials bypass this status.

#### Scenario: Permanently disable account reauthentication

- **WHEN** `DISABLED` account completes provider verification again through bound mobile phone number or OAuth identity
- **THEN** The system refuses to issue the session, retains the original security treatment and does not create a replacement account

#### Scenario: Account has been canceled and re-verified.

- **WHEN** The `DELETED` account uses its original mobile phone number, OAuth identity, refresh token or old access token to request access.
- **THEN** The system denies access and does not automatically restore the account or allow the original identity to create a new account

### Requirement: Soft account deletion requires recent reauthentication and idempotent command

The system MUST only allow the current `ACTIVE` ordinary user to use his/her bound login method to complete short-term, single-purpose re-authentication and then submit an account soft account deletion. The account deletion command MUST carry the UUID request identifier generated by the caller and bind the normalized payload; retrying the same request returns the original result, and changes in the payload conflict. Accounts that still hold valid administrative roles MUST complete the handover or cancellation of controlled roles first, and cannot delete the account directly by themselves.

#### Scenario: Ordinary users complete soft account deletion

- **WHEN** Current user provides valid proof of recent recertification, clear cancellation confirmation and new request identification
- **THEN** The system advances the account to `DELETED` at one time, records the server account deletion time and returns a stable completion result without credentials.

#### Scenario: Re-authentication invalid

- **WHEN** The account deletion certificate is expired, has been used, is inconsistent with the purpose, or belongs to another user
- **THEN** The system refuses to delete the account and the account, session and business relationship remain unchanged.

#### Scenario: Backend role holder self-service account deletion

- **WHEN** The user still holds any valid administrative role and directly submits the account deletion
- **THEN** The system refuses the operation and requires the handover or cancellation to be completed through administrative role management first.

#### Scenario: account deletion command retry or conflict

- **WHEN** The user retries the same account deletion with the same request ID, or reuses the ID to submit different content
- **THEN** The system returns the original account deletion result or stable idempotent conflict respectively, and does not repeatedly perform life cycle actions.

### Requirement: account deletion immediately blocks access and reliably converges business relationships

The system MUST set `DELETED` in the account deletion persistent transaction, revoke all authentication sessions, invalidate all live issuance and participant identity, and write a retryable external revoke command. The system MUST remove this user from active membership, transfer or end their active room according to existing room host rules, cancel their future reservations and pending invitations, and no longer appear in friends, availability, public profiles, or general discovery results. The external provider has temporarily failed and account access cannot be restored.

#### Scenario: The deleted user is still connected to the voice room

- **WHEN** User still has active membership or LiveKit identity when deleted
- **THEN** The database qualification immediately expires and a revocation command is permanently written. The room host is transferred or terminated according to the existing rules. Old API requests are still rejected during the provider retry.

#### Scenario: The deleted user has future appointments or pending social relationships

- **WHEN** There are future appointments, pending friend requests, or room invitations that the user is hosting or participating in when they delete the account
- **THEN** The system converges these relationships that can continue to grant access to a canceled or terminated state, and other users cannot subsequently enter or interact accordingly.

#### Scenario: account deletion transaction failed

- **WHEN** Core account status, session revocation, live invalidation, or reliable command cannot be submitted as a persistent result
- **THEN** System rollback account deletion and user get retry failed, leaving no partial `DELETED` status

### Requirement: account deletion preserves necessary facts but does not provide self-service recovery or identity reuse

The system MUST retain the necessary persistence of userIds, login identity occupations, reports, cases, penalties, appeals, audits, historical engagements, and user-initiated content preservation facts after soft account deletion until an independent data governance policy allows for further anonymization or deletion. Ordinary business and other users are not allowed to read the private information of canceled accounts; this change MUST not provide self-service recovery, identity reuse or physical deletion interfaces.

#### Scenario: There is a security case for deleting the account the user

- **WHEN** There are reports, cases, restrictions, appeals or audit facts before and after the soft cancellation of the account
- **THEN** These facts continue to be associated with the stable userId and are only visible within the existing restricted permissions. deleting the account does not revoke the penalty or destroy the evidence.

#### Scenario: Re-register using the deleted identity

- **WHEN** The caller tried to create a new account using the mobile phone number or OAuth identity occupied by the canceled account.
- **THEN** The system refuses identity reuse and does not disclose the data or security history of canceled accounts.
