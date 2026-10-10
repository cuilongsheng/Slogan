## Why

The current back-end only supports Google/WeChat OAuth first login and single-session account deletion, and lacks the independent registration of mobile phone numbers required by Freeze V1, the merging of multiple login methods into the same platform account, and the closed loop of account soft account deletion. This gap prevents users from independently creating accounts, securely managing login methods, or ending the account life cycle.

## What Changes

- Added international mobile phone number OTP request and verification login: verify the Atomic Creation Platform account for the first time, and log in to the same account for subsequent verifications; the verification code is one-time, short-term valid, limits the number of attempts, and limits the flow according to the irreversible summary of the mobile phone number, source and device dimensions.
- Add replaceable SMS providers, function switches and startup configuration verification; business databases and logs do not save plain text verification codes, and logs, exceptions, audits and queues do not expose complete mobile phone numbers or provider credentials.
- Add the server process for binding the currently logged in user to Google, WeChat or mobile phone number login method. Binding must re-complete the target method verification; identities that already belong to accounts on other platforms return to stable conflict, and the data of the two existing accounts will not be inferred by email, nickname or mobile phone number and will be automatically merged.
- Maintain the existing Google/WeChat first login compatibility; a platform user can have multiple verified login methods at the same time, bind the same identity idempotent repeatedly, and keep at least one available login method. This change does not provide split platform accounts or cross-account business data migration.
- Add soft account deletion of current user account. The account deletion transaction sets the account to `DELETED`, revokes all sessions and real-time credentials, ends the room/reservation/invitation portal that can continue to be used, and hides public information; reports, penalties, appeals, audits, and historical participation relationships are retained as restricted facts.
- The `DISABLED` or `DELETED` account is prohibited from regaining access through OTP, OAuth, refresh token, old access token or login method binding; identity reuse, self-service recovery and physical deletion after account deletion must wait for the independent retention policy.
- Add platform administrators and safety officers to restrict queries on the necessary status and security associations of canceled accounts. Responses must not include complete mobile phone numbers, provider tokens, verification codes, keys or non-essential private information. All queries are audited.
- Extended OpenAPI, Prisma migration, wrong contracts, rate limiting, desensitization, maintenance cleanup and local acceptance evidence; real SMS, Google and WeChat provider smoke remain as separate and unforgeable external acceptance items.

### Confirmed Scope

- OTP registration and login, resend cooling, expiration, attempt limit, one-time consumption, concurrent idempotent and anti-enumeration response for international E.164 mobile phone numbers.
- Logged-in users are bound to Google, WeChat or mobile phone numbers through re-verification; conflicting identities are not automatically merged across accounts.
- Account soft account deletion, all session/real-time access convergence, public data hiding, security and audit fact retention.
- Administrator/safety officer minimally restricted query and audit.
- PostgreSQL persistent facts, Redis ephemeral OTP/throttle coordination, replaceable SMS adapter, and NestJS code-first OpenAPI.

### Non-goals

- Does not implement email password registration, email verification or password retrieval; the existing `add-email-password-auth` is a Figma prototype change, and the backend behavior is not authorized.
- Do not automatically merge two platform accounts that already have rooms, vocabulary books, cases or other business data respectively, nor use provider email, nickname or avatar as the basis for merging.
- Self-service account recovery, mobile phone number change, login method unbinding, data export or physical deletion are not implemented.
- This change does not determine the final retention period for reports, penalties, appeals, audits, history, and vocabulary; these are subsequent data governance changes.
- Does not develop mobile or PC management interfaces, and does not select or purchase specific SMS provider packages.

### Unresolved Decisions

- Production SMS provider, list of supported countries/regions, sending cost cap, sender identification and real delivery proof are confirmed before deployment; the code only relies on the provider adapter and explicit security configuration.
- The final retention/anonymization/physical deletion period of the canceled account identification and business facts will be determined by subsequent data governance changes and privacy policies; this change only guarantees that they are not publicly accessible after soft cancellation and cannot be restored by themselves.

## Capabilities

### New Capabilities

- `account-access-lifecycle`: Define mobile phone number OTP registration/login, login method binding, identity conflict, account soft account deletion, access convergence, privacy and external provider acceptance boundaries.
- `restricted-account-records`: Define the minimum restricted query, permissions and auditing behavior of administrators and safety officers regarding the necessary status and security association of deleted accounts.

### Modified Capabilities

- `identity-and-profile`: Expand available identity portals, semantics of multiple login methods for one user, and boundaries between unavailable/deleted accounts in authentication and public profiles.
- `backoffice-access-control`: Add necessary record query permissions for canceled accounts to maintain role independence, server-side real-time authorization and audit requirements.

## Impact

- Impacted delivery stages：Architecture、Backend / API、Test / Acceptance、Deployment。
- Public application boundaries for `apps/api/src/modules/auth/`, profiles, rooms, voice, social, backoffice and audit: OTP, identity binding, global credential revocation, account account deletion convergence and restricted queries.
- `apps/api/prisma/`: Only forward migration of mobile phone number identity, OTP/account command, account deletion time and necessary index/unique constraints; existing OAuthIdentity, AuthSession, and User relationships remain compatible.
- `apps/api/src/infrastructure/`, Redis and configuration: SMS adapter, temporary challenge, current limit, provider timeout/failure normalization, readiness and log desensitization.
- `openapi/openapi.yaml`: OTP request/verification, login method binding, current account account deletion and background limited query contract.
- External dependencies: Support SMS providers in target countries/regions, as well as existing Google/WeChat OAuth providers; only local fake/runtime verification is allowed when real credentials are missing, and external smoke must be recorded as BLOCKED.
