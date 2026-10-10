# Email password authentication backend acceptance

Status: Local implementation and verification completed (17/18 items); real email acceptance BLOCKED, project acceptance not completed, not deployed, not archived.

## Data and Password Basics

- 2026-09-23: Prisma validate/generate passed. The incremental migration was successfully executed on the local PostgreSQL 17.6 test library.
- `email-auth-migration.spec.ts`: 2/2 passed; the empty database and the OAuth/mobile phone number/session/account deletion user history fixtures are verified, the old row remains unchanged, no mailbox identity is automatically created, and the account deletion identity is uniquely occupied and valid.
- `email-password.policy.spec.ts`: 4/4 Pass; uppercase and lowercase, plus/dot, Unicode codepoints, raw password bytes, independent salt, dummy check, and queue limit.
- Node 24.21.0 local scrypt sampling: two parallel N=32768/r=8/p=1, a total of 66ms, the maximum RSS of the process is 114784 KiB. This is a local sampling, not a production capacity commitment.
- The working memory of each hash core is about 32MiB, maxmem=64MiB; each process can perform up to 2 calculations and 20 queues, and will return unavailable if exceeded; multi-process resources must be budgeted according to the number of processes.

## External acceptance

2026-09-23 The user confirms that real SMTP/verified sending domain name/controlled receiving mailbox has not been configured. Task 5.4 remains BLOCKED, unchecked, and unarchived; may not be replaced by local capture of mail. See the table below for local evidence.

## Scene evidence mapping

The following is local evidence. The path `test/` is relative to `apps/api/`.

| OpenSpec scenario                            | Evidence                                                                                                                                                          | Status  |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| New registration and occupied identity       | integration/email-auth: pending cap, old application password remains unchanged; e2e/email-auth: occupation rejected                                              | PASS    |
| Concurrent verification of the same identity | integration/email-auth: Concurrent verification only submitted by one user, failed transaction rollback                                                           | PASS    |
| Verification completed                       | e2e/email-auth: POST confirms no session, password login enters PROFILE_REQUIRED                                                                                  | PASS    |
| Expired, duplicate or wrong purpose          | integration/email-auth: wrong purpose, deadline, duplicate confirmation rejected                                                                                  | PASS    |
| Resend and preemption protection             | integration/email-auth: manage digest lookup, 60 seconds, old generation, fixed expiration                                                                        | PASS    |
| Successful login and permission boundaries   | e2e/email-auth: PROFILE_REQUIRED, AGE_RESTRICTED, no role rejection in the background                                                                             | PASS    |
| Disabled, deleted and invalid passwords      | e2e/email-auth: unified credentials error, non-ACTIVE rejection                                                                                                   | PASS    |
| Password reset successful                    | e2e/email-auth: SMTP capture, old access/refresh/password invalidation, new password recovery                                                                     | PASS    |
| Concurrent login and refresh of old password | integration/email-auth: true PostgreSQL reset/refresh/login concurrency, late arrival and old version rejection                                                   | PASS    |
| Replay and account enumeration               | e2e/email-auth and integration/email-auth: known/unknown responses are consistent, only qualified accounts are delivered, double consumption is only once         | PASS    |
| Binding successful                           | e2e/email-auth: OAuth and mobile phone number re-authentication, original userId and original identity retained                                                   | PASS    |
| Identity conflict or session invalidation    | e2e/email-auth: cross-account identity conflict, duplicate credentials, original session revocation; integration/email-auth: proof command/session/purpose/period | PASS    |
| delete the account and then re-enter         | e2e/email-auth and integration/email-auth: password clearing, occupation retention, old reset/proof rejection, command replay                                     | PASS    |
| Delivery failure and uncertain result        | runtime/auth-mail.smoke: true local SMTP reception/rejection/timeout, 5-time limit, lease recovery/fencing/single consumption of duplicate emails                 | PASS    |
| Link security and logs                       | runtime/auth-mail.smoke: fixed HTTPS fragment; e2e/email-auth: GET does not consume/reject redirect; unit/log-redaction                                           | PASS    |
| Quota and dependency failure                 | integration/email-quota: dual instance Redis source/target/global quota, cooldown, unknown target, failure rejection; e2e: proxy header cannot be bypassed        | PASS    |
| Real email acceptance is missing             | The user confirmed that there is no configuration yet, 5.4 has not been executed and will not be archived.                                                        | BLOCKED |

Run and rollback instructions: `docs/email-password-auth-runbook.md`. The mobile terminal/management terminal UI has not been modified, and the production release has not been executed.

## final affected-scope

2026-09-23 The final complete check all exit codes are 0. Environment: Node 24.21.0, PostgreSQL 17.6, Redis 7.4.11; SMTP capture uses smtp-server 3.19.13, and sending uses nodemailer 10.0.10.

| Check                          | actual command                                                                                                                                             | Result                     |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| Test dependencies              | `pnpm --filter @slogan/api db:test:up`                                                                                                                     | PASS                       |
| format                         | `pnpm exec prettier --check 'apps/api/**/*.{ts,js,cjs,json}' docs/email-password-auth-runbook.md docs/acceptance/implement-email-password-auth-backend.md` | PASS                       |
| Prisma                         | `pnpm --filter @slogan/api exec prisma validate`、`pnpm --filter @slogan/api db:generate`                                                                  | PASS                       |
| Static check                   | `pnpm --filter @slogan/api lint`、`pnpm --filter @slogan/api typecheck`、`pnpm deps:check`                                                                 | PASS                       |
| Build and Contract             | `pnpm --filter @slogan/api build`、`pnpm --filter @slogan/api exec node dist/scripts/generate-openapi.js --check`                                          | PASS                       |
| Unit testing                   | `pnpm --filter @slogan/api test:unit`                                                                                                                      | 37 suites / 209 tests PASS |
| Integration testing            | `pnpm --filter @slogan/api test:integration`                                                                                                               | 36 suites / 196 tests PASS |
| HTTP E2E                       | `pnpm --filter @slogan/api test:e2e`                                                                                                                       | 16 suites / 82 tests PASS  |
| Runtime                        | `pnpm --filter @slogan/api test:runtime`                                                                                                                   | 8 suites / 15 tests PASS   |
| Differences and specifications | `git diff --check`、`openspec validate implement-email-password-auth-backend --strict`                                                                     | PASS                       |

A total of 97 test suites, 502 tests passed; this is the number of complete API tests in the current workspace, including existing functions, and does not mean that all are newly added this time. The generated OpenAPI is subject to the generator drift check, and no additional manual formatting is required.

Runtime evidence contains real auth-mail worker child process: SMTP force termination after reception, persistent RUNNING lease, restart recovery and duplicate mail token can only be consumed once. The test manually advances the lease expiration time without waiting for the full production lease cycle. The actual external delivery, domain name configuration and inbox performance have not yet been verified.

See the run instructions for the isolation environment coverage of the test shell; the local credentials file has not been modified. Jest had prompted exit delays and Node experimental VM warnings, and eventually the process exited normally with exit code 0.
