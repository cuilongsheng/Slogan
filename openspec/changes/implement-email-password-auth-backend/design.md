## Context

See proposal.md for motivation. The existing implementation has been checked: auth's SessionService uses persistent AuthSession and refresh rotation, and reads the session validity every time the access token is verified; PrismaAuthRepository locks User when creating/refreshing the session. account-lifecycle marks DELETED within transaction, revokes session and handles room, current reauthentication proof is provided by PhoneChallengeStore; login method DTO only contains PHONE/GOOGLE/WECHAT. AuthRateLimitGuard is an in-process flow limiter and cannot protect new password attempts and email quotas alone.

The main spec does not yet have email authentication; `add-email-password-auth` is a prototype change that has not completed visual acceptance. This change retains the username format and 8–128-character password entry, but defines completed verification as confirming identity and returning to password login. Email links do not directly issue business sessions. This backend capability is archived independently; when synchronizing prototype delta in the future, the duplicate description and this process need to be checked and cannot be directly overwritten.

## Goals / Non-Goals

**Goals:** completes email authentication transactions, email delivery and existing session/account deletion integration in the auth domain, and adds an independent email worker entrance to maintain small batch verification.

**Non-Goals:** does not generalize the notification system, does not reconstruct the existing mobile phone number authentication, does not add a management backend, does not develop client link pages or actual deployment.

## Decisions

### 1. Identity is only created after verification is completed

Added EmailCredential (userId unique, normalized username/email unique, passwordHash, credentialVersion, verifiedAt) and EmailEnrollment (REGISTER/LINK, password hash to be verified, 24 hours expiresAt, management credential digest, bind userId/sessionId/command). Does not change User.status, and does not allow accounts to be verified to enter information/rooms.

The username is trimmed to ASCII lowercase, the email address is trimmed to lowercase, and unsupported internationalized email input is rejected; the maximum is 254 characters, dot/plus is not folded. The password is calculated according to Unicode code points, encoded as is, and the maximum request body is limited. The username and email are independent and unique. Deleted-account credentials retain their unique identity reservation while destroying passwordHash. Database constraints allow this non-authenticatable state.

Do not establish a permanent unique identity lock with the pending row; each target has a maximum of 3 unexpired applications at the same time and is protected by the target quota, and relies on the unique index to determine the winner during verification. Only 32 random bytes of management credentials are accepted for resend; the password cannot be updated by email. Password hashes and personal data will be deleted within 24 hours of application expiration; unverified applications will not create Users and will not permanently block legitimate registrations.

### 2. Passwords and one-time credentials

Use Node asynchronous scrypt, encapsulated by PasswordHasher port, initial N=32768, r=8, p=1, independent random salt and versioned encoding; limit concurrency through local time-consuming/memory test, do not block the event loop with synchronous hashing. Compared with the new native Argon2 dependency, the existing Node runtime can be deployed directly; the encoded version allows separate migration in the future. Fixed dummy hash checking is performed even if the username does not exist to reduce obvious timing differences. When there are no formal credentials, check up to 3 unexpired REGISTER applications for this user name. If only the password matches, a pending verification prompt will be returned, and the application email or management credentials will not be returned; when formal credentials exist, pending will not be returned.

EmailChallenge saves the HMAC digest, purpose, subject, generation, expiresAt and consumedAt of a random 32-byte token and does not save the plaintext. Verification defaults to 30 minutes, resets to 15 minutes; resends for at least 60 seconds and invalidates the old generation. The GET link does not modify the status; the trusted page reads the fragment token and then explicitly confirms it with POST, and any redirect parameters are prohibited. Request and error logs need to be desensitized to token, password, email, email body and management credentials.

### 3. Transaction sequence of login, reset and account deletion

Password calculation is placed outside the transaction; lock User and then EmailCredential when submitting login, and recheck ACTIVE, verified and credentialVersion. Session creation must be within this atomic verification boundary, and you cannot directly call SessionService.issue without version conditions after verifying the password. Extend the auth internal repository/session port and reuse the original token format and signature logic.

Reset using the same lock sequence, verify that the challenge is still valid and the account is ACTIVE; consume credentials, increment the version, update the hash, revoke all AuthSession, invalidate the remaining resets and re-authentication certificates in one transaction. If the old password verification is late, it will be rejected due to version changes; the old login session completed first will be reset and revoked; refresh and reset share the User lock. The token is not automatically issued after the reset is submitted. When the response is lost, it can be restored by logging in with a new password.

The account deletion transaction additionally clears the mailbox passwordHash, invalidates the user's enrollment/challenge/proof and unsent email payload, and retains the identity occupation. Only the EMAIL_PASSWORD type is added to the background restricted records, and the plain text mailbox viewing permission is not extended. The global reset cancels the platform session, but does not claim to immediately cancel the issued LiveKit media token; current room removal and banning still use the existing control plane.

### 4. Binding and re-certification certificate

Standalone, purpose-qualified EmailAuthProof saves user, sessionId, credentialVersion (when applicable), command ID, purpose, digest, and 5-minute expiration. Bind the proof to verify the true identity of the current account through the existing OAuth adapter/mobile phone number challenge. You cannot reuse the login exchange to create new users, nor can you use the ACCOUNT_DELETE proof. Start binding transaction consumption LINK_EMAIL proof, bind the original session to enrollment; when confirming, verify again that the session is valid and the account is ACTIVE, and write in the order of User → Credential → Enrollment/Challenge lock.

The password account deletion proof is connected to the existing account-lifecycle proof verification boundary through the auth public interface. Keep the old mobile phone number/OAuth proof path and DTO compatible; add a new password proof and replay it safely according to the same command ID. Recovery from consumption and account deletion failures cannot bypass re-authentication. Avoid a complete reconstruction of all proof stores for this new method.

### 5. Mail outbox and limited retries

auth owns MailSender port, SMTP adapter and EmailDelivery. Uses SMTP TLS verification (except local capture service), does not require vendor-specific SDK. The application transaction saves both enrollment/challenge and outbox; the random credentials and recipient address only exist in the AES-256-GCM encrypted payload. The key is provided by the deployment configuration, with keyId and AAD attached, and cannot be backed up in clear text with the database. The ordinary identity mailbox is protected by the database access boundary and does not enter the query/log; the outbox does not store the complete link and text, and only the minimum template parameters are encrypted.

The independent auth-mail worker receives the PostgreSQL lease after the switch is turned on, and the generation fencing submission status is limited to 20 entries per batch and exponential backoff of up to 5 times; the challenge stops sending when it expires, has been consumed, or has been replaced. Stable Message-ID can assist in deduplication, but SMTP does not guarantee exactly-once; the same link may be resent if the submission is lost if the transmission is successful, and single consumption ensures state security. The encrypted payload will be cleared immediately after the sending is completed; it will be cleared 24 hours after the final state of failure/expiration, and the technical metadata will be cleared within 7 days. Temporary password hashes and administrative credentials are cleared immediately upon successful Enrollment and personal data is deleted within 24 hours after expiration. Retrying does not extend the challenge validity period. Cleaning only involves adding new auth temporary tables and cannot delete existing identities/auditing.

### 6. Contracts, Switches and Quotas

Follow NestJS code-first; the following is the expected route, and the only publishing contract is still generated by decorators:

| Routing (both under /v1)                                      | Behavior                                                                                              |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| POST /auth/email/registrations                                | Username/email/password application, 202 returns opaque management credentials and period, no session |
| POST /auth/email/verifications/resend                         | Management credentials reissued, 202, return cooling time                                             |
| POST /auth/email/verifications/confirm                        | Registration token consumption, 200, no session                                                       |
| POST /auth/password/exchange                                  | Username and password login, 200, use tokens/onboarding response                                      |
| POST /auth/password/reset-requests                            | Email retrieval, unified 202, no existence field                                                      |
| POST /auth/password/resets                                    | token and new password, 204                                                                           |
| POST /me/login-methods/email/proofs/oauth/:provider           | Current account OAuth re-authentication, purpose LINK_EMAIL                                           |
| POST /me/login-methods/email/proofs/phone/challenges、confirm | Current account mobile phone number re-authentication, purpose LINK_EMAIL                             |
| POST /me/login-methods/email/requests                         | Application with binding proof and command ID, 202                                                    |
| POST /me/login-methods/email/confirm                          | Valid original session and binding token confirmation, 200                                            |
| POST /me/account/deletion/proofs/password                     | Confirm current password, return existing account deletion proof response form                        |

Add EMAIL_PASSWORD to login method list and restricted account deletion record enum (update client generation type); no new public identity query is added. Verification/login failed 400/401, not verified and the password is correct 403, identity occupation/command conflict 409, quota 429, configuration or dependency unavailable 503; retrieval of unknown/disabled/account deletion mailboxes is accepted uniformly and there is no email. Public registration exposes occupancy status, which is an explicit behavior of the prototype and separate from the goal of logging in/retrieving hidden existence records.

EMAIL_PASSWORD_AUTH_ENABLED defaults to false, and worker synchronization is controlled. Enabling requires complete SMTP, from, trusted link base address, HMAC/AES keys and Redis configuration; closing does not disable OAuth/mobile phone number and original session revocation. Redis Lua atomic check source, target summary and global quotas (initial source 20 times/15 minutes, login target 10 times/15 minutes, mail target 5 messages/hour, global 100 messages/hour, configured with hard cap), no target same count. The flow-limiting key does not contain plain text email/user name, configure a trusted proxy source, and reject new email/password attempts if the dependency fails. SMTP failure does not block login with existing email account and password.

## Risks / Trade-offs

- [The 8-character minimum length follows the prototype, and there is a risk of weak passwords] → Added versioned common password rejection table, strict sharing current limit and cost-controlled hashing; does not claim to have MFA strength.
- [There is a trade-off between registration field occupancy prompt and privacy goal] → Only registration allows field-level occupancy, login/retrieval maintains unified response, and quotas constrain enumeration at the same time.
- [SMTP Uncertain Retransmission] → The same purpose/version token can only be consumed once, delivery does not mean verified, and does not create exactly-once.
- [Loss of encryption key makes outgoing emails unrecoverable] → Stabilize failure codes, invalidate old applications, and allow resending; retain the decryption ability of old keyIds of unexpired payloads during rotation.
- [Prototype and account life cycle active change exist at the same time] → Only the capability is added this time; additive expansion of the current code is implemented, and the capability overlap is independently reviewed during archiving.

## Migration Plan

1. Turn off the switch, add a new table, unique constraint, and User optional relationship; historical OAuth/mobile phone number users do not have email credentials, and migration must not automatically read provider email to create credentials.
2. Verify migration in an empty database with historical fixtures containing existing sessions, mobile phone numbers/OAuth, and account deletion accounts; real PostgreSQL test unique race and reset/login/refresh/account deletion race conditions.
3. Use the local SMTP capture service to complete delivery, retry, restart, expiration cleanup and desensitization runtime, and then accept the receipt and link confirmation/reset closed loop in the isolated real email environment.
4. A final affected-scope run of format, Prisma, type/lint, dependency, OpenAPI, build and full API regression; process only runs corresponding small-scale tests.
5. Rollback closes the portal/worker and rolls back the application, retains the identity and challenge table, and does not restore the old password or revoke the session; unique users of the mailbox cannot log in with password during the shutdown period, and instructions need to be issued. Old snapshots cannot be used to restore the old authentication status.
6. When the real sending environment is missing, the external task is BLOCKED and not archived; this change does not require visual/physical device certification on the mobile terminal. The client's bounce page access will be subject to separate acceptance. It cannot be claimed that the mobile terminal has been completed.

## Open Questions

- The target environment SMTP provider, authenticated sending domain name, and trusted client HTTPS page address are provided by the deployment configuration; do not affect the above implementation contract. Real smoke requires a controlled recipient mailbox and a test confirmation client to complete the POST, and does not rely on the yet-to-be-developed mobile page.
