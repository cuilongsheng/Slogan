## 1. Schema, configuration and boundaries

- [x] 1.1 Added PhoneIdentity, AccountLifecycleCommand, required action/state enumeration and User.deletedAt, established mobile phone number hash unique key, one mobile phone number per user, one identity per user per OAuth provider and idempotent command constraints, and passed Prisma validate/generate and schema structure test verification
- [x] 1.2 Write a forward-only migration and use the migration test with historical OAuth users, sessions, rooms and security facts to verify that the old data remains logging in, the historical user deletedAt is empty and the new constraints do not destroy the existing relationship.
- [x] 1.3 Added mobile phone number authentication feature flag, hash version/pepper, SMS provider, supported area, TTL, attempt upper limit, cooling, timeout and multi-dimensional quota configuration. The old OAuth API can be started when the verification is turned off. It can be started when enabled but the Redis/security configuration is missing or the readiness security fails and the configuration value is not echoed.
- [x] 1.4 Establish domain/application ports for SMS provider, phone challenge store, account identity and life cycle transaction, run dependency boundary check verification domain and do not import NestJS, Prisma, Redis, HTTP DTO or specific SMS SDK
- [x] 1.5 Record the deployment, phased activation and rollback sequence in the acceptance document. Verification includes keeping the switch off, migrating first, provider/readiness smoke, retaining identity occupation/DELETED/audit facts and prohibiting emergency account recovery.

## 2. Mobile phone number standardization, OTP and SMS adaptation

- [x] 2.1 implements international number resolution, E.164 normalization, supports regional policies, versioned HMAC lookup summaries and minimum masks, verifies that equivalent inputs map to the same hash, invalid/disabled regions are rejected and complete numbers do not enter persistent or diagnostic objects
- [x] 2.2 Implement the creation of Redis challenge, verification code HMAC, purpose, TTL, resend time, remaining attempts and compare-and-delete, use atomic script to verify error deduction, expiration, attempt exhaustion, purpose isolation and concurrent correct code to succeed at most once
- [x] 2.3 Implement Redis rate limiting and cooling based on mobile phone number summary, source, device and global sending volume. When verifying that any dimension exceeds the limit, the provider will not be called, errors will not reveal the hit dimension, and the count will be restored according to TTL
- [x] 2.4 Implement minimum request, timeout and SUCCESS/FAILED/UNCERTAIN error normalization for replaceable SmsProvider adapter, use fake transport to verify that the request does not contain user profile, room information, OAuth token or platform key
- [x] 2.5 implements public OTP request use case and provider failure cleanup, verifies that valid requests return challenge/expiration/resend time, invalid format does not call the provider, whether the account exists does not change the response shape, and OAuth login is still available in the event of SMS failure.
- [x] 2.6 Implement the purpose/user/request binding and retry boundary of short-term verification grant. After the verification database submission fails, only the same command can be retried within the period, other users/purposes/requests cannot be consumed, and the grant cannot be used again after successful submission.
- [x] 2.7 Adds maintenance, cleaning and shutdown behaviors for challenge, grant, and rate limiting keys to verify that expired data cannot be read, that there is no residue of plain text verification codes, and that cleaning does not touch PhoneIdentity, OAuthIdentity or account facts

## 3. Mobile phone number registration, login and data connection

- [x] 3.1 Implement serializable mobile phone number find-or-create transaction, verify that only one ACTIVE User/PhoneIdentity is created for the first verification, repeated verification returns the original userId, and unique conflicts and retries will not produce orphaned users
- [x] 3.2 Connect the mobile phone number exchange to the existing SessionService and ProfilesService. Successful verification returns token pair, created and PROFILE_REQUIRED/AGE_RESTRICTED/ELIGIBLE. The mobile phone number verification itself does not bypass the data and adult verification.
- [x] 3.3 Added `POST /v1/auth/phone/challenges` and `POST /v1/auth/phone/exchange` DTO/controller/error mapping, verified that challenge/code/phone field whitelist, stable status code, anti-enumeration response and OpenAPI runtime are consistent
- [x] 3.4 Uniformly verify User.status in mobile phone number exchange, OAuth exchange, session issue/refresh and access guard. Verify that DISABLED/DELETED identity cannot obtain or refresh the session, cannot go to the post-creation account branch if it is not found, and the old access token becomes invalid immediately.
- [x] 3.5 Run the existing OAuth, refresh rotation, replay revoke, data initialization and adult access control regression to verify that the public contract remains compatible with the original behavior when the feature flag is turned off

## 4. Binding multiple login methods

- [x] 4.1 implements `GET /v1/me/login-methods`. The verification only returns the verified method category, time and minimum mask of the mobile phone number. It does not return the phone hash, complete number, issuer, subject, authorization code or token.
- [x] 4.2 Implement challenge/confirm binding of logged-in mobile phone number, verify that the current user is bound to the LINK purpose, no new User will be created if successful, retry idempotent with the same identity, and other account occupations will return non-leak conflicts
- [x] 4.3 Implement Google/WeChat OAuth link command, verification must use the current valid session and new provider authorization code, only call linkIdentity, do not call findOrCreateUser, and refuse to move other userId identities into the current account
- [x] 4.4 Implement per-user per-OAuth provider/per-user phone number boundaries in database transactions and unique constraints, verify that concurrent binding can be successful at most, with no partial records, and the existing userId’s information, history, wordbook, and security facts remain unchanged
- [x] 4.5 Added that the similarity of provider email, nickname, avatar and mobile phone number will not participate in the test of automatic merging. Verify that similar recommended materials will still create an independent first login account or return a clear binding conflict, and do not copy cross-account business data.
- [x] 4.6 Add ACTIVE status, purpose, current user and provider to configure access control, verify and revoke sessions, disable/delete the account accounts, error providers, expired grants and directly bypass the UI. Login methods cannot be added.

## 5. Re-authentication and account soft cancellation

- [x] 5.1 Implement the ACCOUNT_DELETE step-up proof of PHONE/OAuth, verify that the proof is short-term, single-purpose, bound to the current userId/identity/nonce, expired, reused, the identity does not belong to the person, and cross-purpose use are all rejected
- [x] 5.2 Implement the clientRequestId, normalized payload hash and result snapshot of AccountLifecycleCommand, verify that the same UUID/payload returns the original account deletion result, change the payload conflict, and concurrent commands only submit one life cycle change
- [x] 5.3 Implement access control for ACTIVE users, confirmation content and valid backend roles before account deletion, verify that ordinary users can continue, any backend role holder must first revoke the role and reject the path without modifying the account/session/relationship
- [x] 5.4 Implement the core serializable transaction of account cancellation: set DELETED/deletedAt, revoke all AuthSession, invalidate realtime issuance/identity, increment active membership credentialVersion and write REVOKE_IDENTITY. Failure to verify any persistence step will roll back the whole
- [x] 5.5 Reuse the existing room host. Leave the rule convergence and delete the account the user's activity room. It will only take over once when there are qualified members. It will end reliably when there are no members. LiveKit commands can be retried if they fail, and the old token/API can never regain qualifications.
- [x] 5.6 Cancel the cancellation of future reservation rooms and personal reservations hosted by the user, verify repeated cancellation/maintenance scan idempotent, other rooms will not be affected, and the history of ended rooms will not be overwritten.
- [x] 5.7 Terminate pending friend requests and room invitations for deleted user and clear presence visibility, verify friend/available/invited/public profile lists immediately hide the user and security cases, restrictions and audit facts remain intact
- [x] 5.8 adds a account deletion test for users who are restricted, have reports/cases/grievances, have private notes/vocabularies and historical memberships, and verify that deleting the account does not lift penalties, does not delete evidence or user content, and the original mobile phone number/OAuth identity is still occupied and does not provide recovery
- [x] 5.9 adds account deletion runtime tests under Redis, LiveKit and runner failures to verify that database access is blocked first, durable commands can converge after restarting, external failures are not rolled back to ACTIVE, and there are no partially visible relationships

## 6. Restricted backend query for canceled accounts

- [x] 6.1 Add ACCOUNT_RESTRICTED_RECORD_READ to the backoffice policy and grant only PLATFORM_ADMIN/SAFETY_OFFICER, verify that ordinary users, only OPERATIONS_ANALYST, only AUDITOR and old tokens after role revocation are rejected
- [x] 6.2 implements the minimum query repository/application API for canceled accounts. The verification only returns userId, status/time, method category, minimum data snapshot and case/restriction/appeal reference. It does not return mobile phone number/hash, provider subject/token, verification code, private notes or content data.
- [x] 6.3 Added `GET /v1/backoffice/accounts/{userId}/restricted-record` to verify the existence, absence and unauthorized targets using stable non-disclosure contracts and queries cannot restore accounts, unbind identities or modify security facts
- [x] 6.4 Write minimal BackofficeAuditEvent for successful and rejected queries, verify that it contains actor, current role, target, requestId, time, result/reason, do not copy response private fields and repeated reads are individually traceable

## 7. API, privacy, maintenance and structure

- [x] 7.1 Complete stable business error and exception mapping for OTP, identity binding, step-up, account deletion and background query. The verification response does not contain stack, SQL, complete number, verification code, grant, provider body or other account existence clues.
- [x] 7.2 Extended structured log/trace desensitization and prohibited content key/value rules, verify that phone/e164/otp/code/grant/provider payload, OAuth code/token, pepper/secret are not visible in success, failure, timeout and exception paths
- [x] 7.3 Update module public entrance and dependency-cruiser rules to verify that auth, account-lifecycle, profiles, rooms, social, backoffice, audit and voice only interact through the public application/domain port and have no circular dependencies
- [x] 7.4 implements account command technical records and retention cleanup of orphaned OTP Redis keys, verifying that PhoneIdentity/OAuthIdentity, DELETED status, cases, penalties, appeals, audits, room history, summary, private notes or vocabulary will not be deleted
- [x] 7.5 Regenerate `openapi/openapi.yaml` and run drift check to verify that the default values, enumerations, errors, time and sensitive fields of mobile phone number challenge/exchange, login method, binding, account deletion and restricted query are consistent with the runtime

## 8. Verification and acceptance

- [x] 8.1 Complete the unit tests of number normalization, OTP atomic consumption, rate limiting, provider adapter, unique account, binding conflict, step-up, idempotent account deletion and desensitization, and verify that all target tests pass
- [x] 8.2 Complete historical migration, unique constraints, concurrent exchange/link, account deletion transaction rollback, outbox restart recovery and temporary key cleanup integration/runtime tests on real PostgreSQL and Redis, and record the database and Redis versions and results
- [x] 8.3 Complete OTP registration/login, three login methods to share data, disable/account deletion rejection, account deletion across rooms/appointments/social convergence and background RBAC/audited HTTP E2E, verify that direct requests cannot bypass the server boundary
- [x] 8.4 Run format, Prisma validate/generate, OpenAPI drift, dependency boundaries, build, full unit/integration/e2e/runtime, `git diff --check` and OpenSpec strict validation, and log commands, quantities and results in a final affected-scope validation
- [x] 8.5 Write `docs/acceptance/implement-account-access-lifecycle-backend.md` to record local implementation, privacy check, migration/rollback, provider/region configuration, real environment proof and all BLOCKED items respectively
- [ ] 8.6 Use a real international mobile phone number and a qualified SMS provider to complete the request, delivery, error code, cooling, current limit and cost smoke, and use the real Google/WeChat configuration to verify the first login, binding, conflict and account deletion and reject it; if any necessary credentials/policy evidence is missing, BLOCKED will be recorded, this task will remain incomplete and will not be archived change
