## 1. Data and security basics

- [x] 1.1 Add EmailCredential, EmailEnrollment, EmailChallenge, EmailAuthProof, EmailDelivery model, unique constraints and additive migration, run Prisma validate/generate, and use empty library with real PostgreSQL history fixture with OAuth/mobile number/session/account deletion account to verify that there is no automatic identity association or old data changes
- [x] 1.2 implements username/email normalization, password length and common password policies, asynchronous versioned hashing and dummy verification, unit tests cover upper and lower case, plus/dot, Unicode, no clipping, independent salt and wrong passwords, records local hashing time consumption and concurrent memory boundaries
- [x] 1.3 Added default shutdown switch, SMTP/TLS, trusted link, HMAC/AES keyId and quota configuration and domain ports, started the test to verify that the missing configuration security fails, does not echo the secret, and the existing authentication works as usual after closing
- [x] 1.4 implements Redis source/target summary/global quota and retransmission cooling, uses dual-instance Redis test to verify atomic count, unknown identity also limits the flow, and Redis fails to reject new attempts.

## 2. Mail delivery and registration verification

- [x] 2.1 Implement the collection/lease/fencing/retry of transaction mail outbox, encrypted payload, SMTP adapter and auth-mail worker, and use the local SMTP capture service to verify successful verification, rejection, timeout uncertainty and restart. Repeated delivery does not increase the number of credential usage.
- [x] 2.2 implements registration to be verified, management of credentials and reissue, PostgreSQL test verification per target application limit, no User/session, repeated application without changing the old password, 60 second cooling and 24-hour fixed expiration boundary
- [x] 2.3 Implement registration verification, one-time consumption and email identity creation, use concurrent testing to verify username/email unique competition, same token replay, expired/wrong purpose/old generation rejection and GET non-consumption
- [x] 2.4 implements completion, replacement and expired email payload cleaning and enrollment/challenge/proof metadata cleaning, runtime verification 24-hour content cleaning, 7-day technical metadata cleaning, worker restart convergence without deleting formal identities

## 3. Login, retrieval and session consistency

- [x] 3.1 Implement username and password login and existing session issuance adaptation, directed HTTP test to verify correct/error/unverified/disabled/account deletion branches, unified credential errors and information/adult/backend role boundaries
- [x] 3.2 Achieve unified retrieval, acceptance and reset of emails, use HTTP and SMTP tests to verify that known/unknown/non-ACTIVE mailbox responses are consistent, only qualified accounts receive emails, and rate limiting does not leak the existence
- [x] 3.3 implements reset atomic updates, credentialVersion and all platform session revocation, real PostgreSQL concurrency testing to verify new password login recovery after old password login late arrival, refresh competition, double consumption and response loss

## 4. Binding and canceling existing accounts

- [x] 4.1 Add LINK_EMAIL proof for current account OAuth/mobile phone number re-authentication, use directed integration testing to verify identity ownership, user/session/command binding, 5-minute expiration and account deletion proof is not interchangeable
- [x] 4.2 Implement binding application and email confirmation, command replay conflicts and EMAIL_PASSWORD desensitized login method, HTTP/PostgreSQL test to verify original userId retention, cross-account conflicts, original session revocation and repeated binding rejection
- [x] 4.3 Add password account deletion proof and access existing account deletion transactions, test and verify incorrect password/expired proof rejection, password reset to invalidate old proof, replay security, credential invalidation and identity occupation retention after account deletion, return to original OAuth/mobile phone number account deletion

## 5. Contract and final acceptance

- [x] 5.1 Complete DTOs, stable errors, OpenAPI decorators and masking rules, generate unique OpenAPI and run drift and directed E2E, verify that direct requests cannot bypass confirmation, purpose, quota or RBAC boundaries and logs do not contain credentials/email/body
- [x] 5.2 Execute the final affected-scope once after all implementations are completed: format, Prisma validate/generate, lint/typecheck, dependency boundary, build, OpenAPI drift, complete API unit/integration/e2e/runtime, git diff --check and OpenSpec strict; record the actual commands/number, if failed, only repair the minimum scope first and then rerun the final check
- [x] 5.3 Write Chinese acceptance and operation instructions, record local SMTP/database/Redis version, migration/shutdown rollback, credential cleaning, uncertain email resending, prototype conflict handling and external BLOCKED; check the evidence of each spec scenario, and cannot just rely on the test to check the all-green check and not perform the acceptance
- [ ] 5.4 Perform registered delivery, verification, cool-down resend, reset and old session rejection smoke on the isolated real SMTP/domain name and controlled receiving mailbox, record desensitization evidence; keep BLOCKED when configuration is missing, this item is not completed and will not be archived, and will not be replaced by local capture of emails or HTTP fixtures
