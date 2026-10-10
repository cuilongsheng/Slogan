## Context

See `proposal.md` for motivation and confirmation scope. This change is authentication/authorization Level 2. It only completes planning and does not connect to any actual database.

Read code display:

- `EmailAuthService.login()` verifies user name and password, consumes Redis quota, establishes session through normal `SessionService`, and does not send email. `EMAIL_PASSWORD_AUTH_ENABLED` of `environment.ts` requires SMTP, AES/HMAC keyring, trusted email links, and Redis; this switch is also shared by email requests, quota instances, and workers.
- `EmailCredential.verifiedAt` is not empty. For normal registration, the official User/credential will only be created after email confirmation. `EmailCredentialView` and session issuance need to identify the source of the credentials simultaneously. Unverified credentials cannot be released just because there is a row in the database.
- `verifiedAt` of `/v1/me/login-methods` is currently not empty, and the controller calls `toISOString()`; therefore, when adding a source and making the experience account verification time empty, domain, repository, DTO, OpenAPI and generated client must be linked.
- Both web applications already have `/v1/auth/web/password/exchange` and Google logins; the backend `SignInView` already has a password form, and the real-time role is verified through `/v1/backoffice/me` after logging in. There is no conflict with "backend only Google".
- Web passwords, Google, refresh and exit all go through `BrowserAuthController.requireOrigin()`; the existing implementation requires the source to match both `GOOGLE_OAUTH_REDIRECT_URIS` and `CORS_ALLOWED_ORIGINS`, and cannot only claim that the password session is available after CORS is configured.
- The four administrative roles are `PLATFORM_ADMIN`, `SAFETY_OFFICER`, `OPERATIONS_ANALYST`, and `AUDITOR`; this change only uses the first two. The administrator does not automatically have safety disposal rights, and the safety officer does not automatically have role management rights.
- Currently bootstrap grants both administrator and safety officer to the first ACTIVE user, and only supports retrying with the same target when there are still two roles in the end. Role grant/revoke is an existing capability with reason, request UUID, audit, latest permission review and last administrator protection.
- `seedAdult()`, etc. are only isolation test fixtures; the related cleanup contains full table deletion and cannot be used as an actual environment seed/cleaning tool. Existing API scripts do not have common experience account commands.
- active email/mobile/admin changes are not fully synced yet; the release preparation document mentions wider emailless registration/recovery, but it is not a current requirement authorization. This change is only a limited trial mode, the email verification requirements for ordinary users remain unchanged, and new Google users will continue to have existing onboarding.

## Goals / Non-Goals

**Goals:**

Uses existing authentication and persistent RBAC to provide five independent accounts with clear provisioning sources and environment bindings; email shutdown can operate safely, and account creation, role initialization and cleanup can be verified and restored. All executable database, credential and environmental operations are placed in the post-audit implementation/operation and maintenance phase.

**Non-Goals:**

Does not introduce a new authentication system, public seed API, global room host role, permanent demo room or no-email account recovery service; does not modify the backend permission matrix, does not automatically merge Google and password identities, and does not use current source code/CLI verification as public network, SMTP or physical device proof.

## Decisions

### 1. Configure password and email independently to maintain compatibility with old configurations

Added mail process switch `EMAIL_AUTH_MAIL_ENABLED`. The old deployment deduces as `EMAIL_PASSWORD_AUTH_ENABLED` when not explicitly set to maintain existing mail mode; this trial must be explicitly set to false. The old password switch is retained to control normal password login, Redis/HMAC quota, password account deletion proof and session boundary; if the email is true but the password is false, it is an illegal combination and the startup fails.

Added `PREVIEW_ACCOUNTS_ENABLED` (default false), `PREVIEW_ENVIRONMENT_ID` (explicit environment binding, no default actual database), the initialization command also requires the operator to explicitly provide the target connection and the same environment identification. The public trial still uses the Cookie/TLS security behavior of `NODE_ENV=production`, and does not relax the verification by `NODE_ENV=test` or `LOCAL_TEST`.

| Mode                  | Password switch | Email switch | Experience switch | Required configuration for startup                                                       |
| --------------------- | --------------- | ------------ | ----------------- | ---------------------------------------------------------------------------------------- |
| Fully closed          | false           | false        | false             | Original API basic configuration                                                         |
| Ordinary mailbox mode | true            | true         | false             | Redis, HMAC/AES, SMTP, fixed trusted authentication/reset URL                            |
| This trial            | true            | false        | true              | Redis, HMAC, clear experience environment identification; no SMTP/AES/email URL required |

The basic configuration continues to include PostgreSQL, JWT signature/issuer/audience, refresh pepper, CORS and original room configuration; Google uses independent `GOOGLE_OAUTH_ENABLED`, client ID/secret, redirect whitelist and both-end front-end client ID. Keep the Google configuration during trial and do not reconstruct the origin mechanism. Real three-person voice requires LiveKit, Redis, HTTPS and public webhook, which cannot be claimed by initializing the account.

The alternative "fill in the false SMTP configuration but do not start the worker" still opens the mailbox application and recycling backlog, which cannot satisfy the mail deactivation; turning off the existing main switch will also turn off the password, so it is not used.

### 2. Single password credential model, source and verification facts separated

Extend the existing `EmailCredential`, add `origin` (`EMAIL_VERIFIED` / `PREVIEW_PROVISIONED`), allow `verifiedAt` to be null; add a controlled initialization record for the environment/account slot, associate the existing User and credentials, and use the unique `(environmentId, slot)` and the unique userId to ensure five independent identities. The record contains creation/completion/retirement time, initialization batch and role stage command ID, but does not contain password, hash snapshot, token, full email or real database URL.

- Backfill the existing credentials `EMAIL_VERIFIED`, retain the original `verifiedAt`, and do not change the password hash/version or session.
- The new experience credentials are `PREVIEW_PROVISIONED` and `verifiedAt=null`, and the real provision time is in the dedicated record. Creation is from controlled commands only; registration/validation API does not accept origin, environment, slot or role input.
- Since the existing email field and unique index are still required, the experience credential uses an independent non-deliverable internal placeholder address generated by the command (retaining the `.invalid` domain). It does not impersonate a third-party mailbox and does not represent any mailbox ownership. The actual mapping does not write Git/log, and the ordinary API is still desensitized.
- Login allows normal authenticated ACTIVE credentials, or ACTIVE experience credentials with the switch on, environment matching, and controlled logging valid. The preset exception only applies to five registered identities; pending registration, forged sources, missing initialization records, account deletion/disabled, and cross-environment accounts are all rejected. Source judgment covers session issuance, refresh and access verification, and old tokens cannot be used to bypass environment/experience shutdown.
- Login method projection adds source; experience method `verifiedAt=null`, provision time cannot be mapped to email verification time. The normal mobile phone/Google/email identity time remains the same. All existing consumers process available time. The front end only displays necessary sources and does not expose placeholder addresses.

Filling in a false `verifiedAt` as an alternative will confuse the audit facts; a separate second set of password tables will repeat hash/version/session rules and expand username cross-table conflicts, so choose the smallest and clearest source extension.

### 3. Five-slot creation and role authorization restored in stages

| slot                 | Final admin role      | Move room behavior                                                |
| -------------------- | --------------------- | ----------------------------------------------------------------- |
| Admin administrator  | `PLATFORM_ADMIN` only | Not a room test participant in this round                         |
| Admin safety officer | `SAFETY_OFFICER` only | Not a room test participant in this round                         |
| Move A               | None                  | The room is created normally and becomes the room host this time. |
| Move B               | None                  | Join normally                                                     |
| Move C               | None                  | Join normally                                                     |

CLI is initialized through the application API and repository transactions owned by auth, and does not deeply import the authentication repository from the controller or other modules; profiles use public service/policy to verify adult information. The new script/command does not write the public network operation and maintenance endpoint, and does not reuse the test fixture.

Preflight explicit targets and environments; actual connection credentials are only passed in from the secret environment, disabling default fallback to the native database. Initial creation requires five unique usernames, five independent secret inputs and legitimate data, rejects username/email/User/slot conflicts, duplicate identities, weak passwords and accidental existing administrators (explicit existing-admin mode retains their permissions and waits for real session authorization). Five accounts and data/initialization mapping are created in one transaction, the password is calculated outside the transaction, and the uniqueness and target are rechecked within the transaction; failure does not leave half a set of accounts. Repeated execution only checks the existing accurate mapping and valid credentials. It cannot overwrite passwords/data, restore revoked roles, or revive DELETED accounts.

Database creation and legal role authorization are not disguised as single transactions:

1. After the five-account data transaction is completed, the first background account for this batch of administrators is established through the existing `BackofficeBootstrapCommand`, which generates the original SYSTEM_BOOTSTRAP audit and temporarily holds dual roles.
2. The operator logs in through a normal session with the administrator's real username and password, uses the existing role interface to grant `SAFETY_OFFICER` to the safety officer slot, and then revokes the administrator's `SAFETY_OFFICER`. Use stable UUID, reason and authenticated identity for each command; disable CLI from just taking actorUserId from manifest to pretend to be authenticated administrator or insert role table directly.
3. After verifying that the two roles are finally separated and the mobile user has no role, the role marking stage is completed. The command can output non-secret stage/slot status and operation instructions, but does not output password, hash, token or complete email address.

Check against durable stage records and real-time roles during recovery: bootstrap can only be used when an administrator has not yet been created; bootstrap cannot be re-invoked after the final administrator has only a single role. If the original command response is lost, the original UUID will be used first for replay verification; the successful audit will not be repeated in the completed stage. Unknown administrators, additional roles, subsequent legal role revocation, or user bans all report conflicts for the operator to handle and do not automatically "fix" and reauthorize permissions. The success of this command is defined as the completion of five identities and the final role verification; when only the data is completed, it is clearly pending role authorization, and the overall success cannot be reported.

### 4. Complete information and normal room procedures

Move three slots to verify the current `ProfilePolicy` and save the avatar URL that can actually be loaded, different nicknames, legal gender, country or city, 1–10 legal interests, legal CEFR, clear adult birth date and `completedAt`; you cannot just write the completion time to bypass the verification. Use fictional experience data and do not introduce personal information of real visitors.

`GET /v1/me` should return `ELIGIBLE` after logging in. The room test consists of A normally creating a room with a capacity of at least 3 in the UI, and B/C using an independent session to join and accept the existing room rules; after the end, it can be created by changing people. The seed does not add room, membership or fixed HOST permissions, and does not bypass capacity, consent, ban, microphone and LiveKit qualifications.

### 5. Separate mail stopping and deadline cleaning

When the email switch is false, registration, resending, confirmation, password recovery request/submission, email binding, and binding-specific OAuth/phone proof all return the existing `EMAIL_AUTH_UNAVAILABLE` (503) before generating persistent applications, quota sending side effects, or calling external providers. Valid old tokens cannot be consumed and cannot return 202 pretending to be "sent". Normal Google exchange with normal password login/password account deletion proof reserved.

The worker is changed to cleanup-only. The clock is independent of the delivery switch: cleanup without decryption can be performed without email configuration; email is closed without claim/send, and no row is recorded as DELIVERED. When the deployment is closed, first stop/drain the delivery process, then cancel the unfinished delivery through explicit deactivation maintenance actions, clear the encrypted payload and temporary application restoreable information, invalidate the challenge/proof, and increment generation fencing to avoid sending old backlogs after reopening emails. Keep existing audit and official account facts. Cleaning can only overwrite the temporary data of the mail process, and does not cancel the ACCOUNT_DELETE proof that still needs to be used; expired proofs will still be cleaned.

There is no guarantee that emails submitted to SMTP will be withdrawn. The runbook needs to explain the switching sequence and this boundary. New experience: idempotent no-op when DB has no delivery backlog; isolation testing must construct another old PENDING/RUNNING record for verification. Just shutting down the worker will delay the cleanup of old applications/loads, so it is not used.

### 6. Web entrance and visual boundary

Provides minimal, non-sensitive authentication capability query (recommended `GET /v1/auth/capabilities`), only outputs the password/Google/Boolean value available for the mail process, and does not output the five slots, mailboxes, environment IDs or provider secrets; when errors/unknowns occur, the mail entry is closed. In this way, the UI and backend deployment status are consistent, and the second contract is not added. In normal email mode, the original page entrance can be retained; this trial login page hides the email registration/retrieval entrance, and keeps the password and Google.

When directly opening the registration, verification, retrieval, reset, and binding pages, a unified "This function is not available for the current trial" is displayed, and a return login is provided without triggering a webmail request; when reading the old token from the link, the address bar fragment is still cleared and is not automatically confirmed. The page does not display the "Sent" success status. The login method page can display the experience source that has not been verified by email. Chinese and English copywriting uses existing i18n and reuses the current layout/components; no new page visual system is created.

UI application project `figma-to-frontend` skill. The repository evidence target is the authentication V2 of Figma file `56nIowZmvBhb0QJvOlDQdU`. Log in `118:2970`, register `118:3001`, verify `118:3063`, and retrieve `118:3186` (390×844); from `docs/acceptance/implement-mobile-email-password-auth.md`, there is no real-time verification in this round. Desktop Bridge status is inactive transport/not connected, cloud/REST/browser fallback is disabled. Before implementing the UI, you must restore Bridge, check the actual page/frame, and confirm the deactivation comment/status on the original page; this plan does not authorize editing of the original manuscript. There is a password/Google form in the background to keep the original view, and only use the existing status for permission acceptance.

### 7. The only contract and evidence

Still use NestJS code-first to generate `openapi/openapi.yaml`, add capabilities and nullable source projection and update `packages/api-client` to generate results and all consumers, without handwriting the second DTO. Static generation and openapi check only prove that the contract is consistent.

Minimum implementation checks cover configuration combinations, preservation of existing verification paths, source/environment gating, identical errors for wrong passwords and unknown users, Redis fail-closed behavior, idempotency/concurrent uniqueness, disabled-email HTTP calls without side effects, cleanup-only workers, role matrices/last-administrator protection, revocation of old sessions and provisioned sources after account deletion, and cleanup that never revives identities. Web uses Playwright to verify five account separate sessions, HttpOnly Cookie, background direct-route/direct API rejection, Google mock boundary and Chinese and English disabled status; real Google smoke alone.

The UI needs to compare the Bridge original screenshot with the browser 390×844; the three-person webpage needs runtime evidence of the new room process of real microphone/LiveKit publishing and subscription, ending/changing room host. Web testing does not replace Android/iOS physical device; this round of official launch/SMTP and external tasks of the original changes continue to be BLOCKED/DEFERRED. Only run a complete affected check once after all implementations are completed; rerun only after failure or subsequent changes.

## Risks / Trade-offs

- [Experience source expanded to ordinary registration] → Only controlled CLI writes source/slot mapping, HTTP DTO does not accept these fields; verification of missing mapping, cross-environment, old token and ordinary pending account rejects the path.
- [High-privilege accounts are shared to change roles or dispose of data] → Maintain true server-side permissions, reasons/confirmations/auditing, environment isolation, session revocation and verifiable rollback. It is recommended to limit distribution objects, which has not yet been confirmed by users; do not reduce the authenticity of the experience by secretly deleting permissions.
- [The old version treated null as Date or only sent the session based on hash] → Synchronously publish the backend/both-end clients and complete the contract compatibility check; the old binary cannot be directly rolled back to a state containing experience credentials, and the rolled-back version must have compatibility processing to reject the experience source.
- [The role process is interrupted, leaving the administrator with dual roles] → Clear stage, real administrator authentication, stable command UUID, only verification without automatic re-award, final matrix check; partially completed without reporting and deliverable.
- [Old payload remains for a long time after mail is closed/restarts sending] → Independently cleanup and disable drain/cancel/fencing, verify that expired cleanup and provider are not called; indicate the last delivery and switching time in the release record.
- [Shared mobile accounts modify each other’s data/occupy active rooms] → The five slots have independent identities. The test uses three independent clients and ends the room normally; the shared experience credentials are not used as long-term personal accounts or production user data.
- [The running seed points to the wrong DB or the unknown user is repeatedly modified] → No default target, environment identifier matching, backup/preflight, dry-run, unique mapping, conflict rejection; test full table cleanup is not called.
- [No automatic password retrieval] → The first round of emails has been closed and there is no self-service recovery; there is no email retrieval if you do not join smoothly. Lost credentials must be separately approved for controlled rotation operation, and the password will not be replaced during initial re-run.

## Migration Plan

1. Review the limited exceptions of this proposal and related active changes, and confirm that ordinary registration verification will not be relaxed; confirm the original status before UI implementation. Code implementation/testing and actual environment operation are licensed separately.
2. Add additive migration and constraints of origin, nullable verifiedAt, and initialization records in the isolated test library: the existing origin maintains EMAIL_VERIFIED and has verifiedAt; experience that the verification time of origin is empty and has verifiable mapping. Check that normal accounts, hash/version, sessions/audits are completely retained before and after the upgrade. It is forbidden to change the migration history.
3. Before all real environment operations, the user specifies the database/environment ID, public HTTPS source and secret injection channel; back up and verify dry-run, current administrator set, five-slot conflicts and migration status. The local target and secret local file channel have been specified by the user; the remote target /HTTPS/Publish is still not authorized.
4. Migrate and publish the API/client that can identify the source first, and keep the experience switch turned off; configure Google, CORS, cookie security and email shutdown, drain delivery and perform temporary data deactivation cleanup. Enable environment binding experience capability again, complete five-identity initialization and legal bootstrap/authentication role separation.
5. Check three mobile user ELIGIBLE, background final matrix, incorrect permissions and old credential rejection, and then provide secrets according to the distribution channel decided by the user; only the desensitized execution results are retained in the runbook and run logs. The acceptance of five accounts in the target environment, real Google, three-person LiveKit, and public webhook are all recorded separately; BLOCKED is retained when there is no target, and does not need to be replaced by a local fake PASS.
6. Rollback gives priority to turning off the experience capability and revoking all its platform sessions, ending/exiting the normal test room, retaining Google; retaining tables, source mappings and audits, and not deleting tables/restoring old hashes/recovering account deletion identities. Keep access/refresh denial on experience source.
7. When completely cleaning, first end the room and revoke the safety officer; the administrator can only revoke his or her role after legally transferring the account to the controlled account and verifying at least one valid administrator. Then use the normal password proof/clear account deletion process to destroy the hash, revoke all sessions, retain the unique identity occupation and audit, mark the preset mapping RETIRED; rerun the seed to refuse to retire the identity. If there is no successor administrator, the administrator cleanup remains pending and the last administrator rule is not bypassed.

## Open Questions

- Which independent experience database/environment identifier, HTTPS API/admin/mobile address and backup location should be selected during execution? These decisions change the environment values ​​and do not change the authentication and authorization design.
- When will the actual user names of the five accounts, secret input/delivery channels, and experiencer lists be provided? The distribution scope of high-privilege accounts must be determined by the user.
- Can the disabled status annotation of the existing frame be directly reused after Bridge is restored? Specific visual evidence needs to be verified before UI implementation, and this document cannot be regarded as approved visual design.

### Exception for cleanup of old development accounts on this machine (explicitly authorized by user on 2026-10-03)

In the end, only five ACTIVE accounts were available. When the old identity does not comply with the current environment mapping/credential facts, the controlled `cleanup-local` CLI can first revoke the old development role (including the last administrator), reuse the account-lifecycle repository's account deletion transaction to destroy the hash, cancel the session, release the room/social qualifications, and retain historical audits and foreign keys on a user-by-user basis. This exception is not registered as a provider or HTTP API; must specify `--authorization-mode local-rebuild`, NODE_ENV=development, fixed loopback 127.0.0.1:5432/slogan, environment=local-preview, and check owner-only 0600 PostgreSQL custom-format backup. Reject production/remote/other databases/missing backup/other environment mappings. Rerun only processes old identities that have not been deleted and registered, and will never restore RETIRED identities.

Backup precedes additive migration and cleanup; performed during service stop to avoid concurrent creation. The interruption may leave some old identities deleted or roles revoked. The CLI can be rerun to converge, or the service can be stopped and restored from a safe backup to an independent local database for verification, and then the original database can be restored manually. Cannot directly downgrade old binary read nullable verifiedAt. After the cleanup, the new administrator still completes role separation through the original bootstrap, real password login and normal audit role HTTP command; the last online administrator protection remains unchanged. This exception does not apply to general experience decommissioning/remote environments.

The old role table revokedByUserId foreign key still retains the pairwise constraint; local cleanup creates a DELETED, no-credentials maintenance marker for the revoked role, the revoked FK points to that marker, and the role audit is explicitly SYSTEM_JOB and the markerId is logged. This final state history line does not count against the five available identities and does not forge an authenticated USER operator.
