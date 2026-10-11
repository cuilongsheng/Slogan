# Guarded Phase-one release

The implementation batch introduces private conversations, two-party calls, avatars, shared authentication throttles, and managed maintenance. This document describes the required configuration; it does not establish that a deployment or restore has succeeded.

## Release sequence

1. PR: run `Phase-one verification`, create Vercel/Pages previews, and build an Android artifact. Previews never migrate production. A PR APK currently uses the production API and cannot prove unpublished contracts.
2. Main: verification must pass before the `Guarded production API` job reads the production database. The job verifies the approved database fingerprint and current main SHA, creates an encrypted consistent backup, restores it to an isolated database, applies the candidate migrations there, and checks data invariants.
3. Only after those steps succeed: migrate production, deploy the Vercel API through the CLI, and verify the response commit and authentication capability shape. `apps/api/vercel.json` disables automatic main Git deployment so it cannot race the migration; PR Git previews remain enabled.
4. Pages deploy independently through their Git integrations. Android publication requires both Pages checks, both live Pages release descriptors, the live API commit, and the two Phase-one checks to match main. A failed or obsolete release never replaces the public APK.

The three provider deployments are not atomic. Schema changes must support both the previous and candidate application during promotion. Native testing remains owner-operated.

## GitHub production environment

Configure these only in the protected `production` environment. PR verification jobs cannot read them.

| Kind     | Name                              | Purpose                                                                                     |
| -------- | --------------------------------- | ------------------------------------------------------------------------------------------- |
| Secret   | `PRODUCTION_DATABASE_URL`         | Explicit production PostgreSQL target                                                       |
| Secret   | `BACKUP_ENCRYPTION_KEY_BASE64`    | Canonical base64 encoding of 32 random bytes for AES-256-GCM                                |
| Secret   | `VERCEL_TOKEN`                    | Deploy the existing API project                                                             |
| Variable | `PRODUCTION_DATABASE_FINGERPRINT` | SHA-256 of the canonical hostname, port and database identity computed by the backup module |
| Variable | `BACKUP_ENCRYPTION_KEY_ID`        | Operator identifier for the encryption key; never the key itself                            |
| Variable | `VERCEL_ORG_ID`                   | Existing Vercel team/account ID                                                             |
| Variable | `VERCEL_API_PROJECT_ID`           | Existing `slogan-api` project ID                                                            |

Retain the encryption key in owner-controlled recovery storage independently of Actions. Losing the key makes backups unrecoverable. Never print the connection string or key when calculating configuration. No production secret belongs in a PR artifact, frontend bundle, or repository file.

## Backup and restore

`database-recovery.yml` runs daily and can be dispatched manually. It snapshots production, encrypts locally before upload, authenticates the encrypted envelope, restores to an isolated PostgreSQL service with providers disabled, applies compatible migrations, and checks invariants. It cannot deploy the API or migrate production. The shared production concurrency group serializes it with release migration.

The policy is 14-day encrypted artifact retention, a 24-hour RPO target and a one-hour RTO target. These are configured targets until timed recovery evidence exists. The upload contains only ciphertext. Plaintext restore files live in a private temporary directory, are authenticated before `pg_restore`, and are removed on success or failure. Restoring into the current production database is rejected.

A failed GitHub workflow is a failed recovery/release signal. Configure repository workflow notifications and record a successful run plus an intentional failure delivery before claiming operational alert acceptance. Application alert delivery also requires a configured operations sink; a scheduled scan alone is not proof of notification delivery.

## Vercel maintenance

Deploy the `slogan-maintenance` queue consumer and set a private `CRON_SECRET`. The daily protected seed route restarts the minute continuation chain; successful API requests also seed it. Each delivery publishes its continuation before acknowledging, then claims a fenced database lease. Work covers direct-call expiry/cleanup, safety recovery, enabled operations, realtime recovery, and enabled assistance retention. Preview consumers cannot process production work.

Keep `ASSISTANCE_ENABLED`, room speech processing, email registration and WeChat disabled. Operations run only when explicitly configured; enabling retention or alert destinations is a separate configuration decision. Continuous audio workers require a long-lived runtime and are outside this managed invocation.

Authentication exchange/refresh quotas are atomic in Redis across API instances and fail closed with 503 when shared storage is unavailable. Vercel supplies the overwritten trusted source-IP header. Through Pages, this identifies the forwarding proxy rather than an individual visitor, so visitors sharing that proxy share a source quota. Arbitrary visitor headers are not trusted as authentication identities.

## Rollback and acceptance

Retain additive tables and private content. If new functionality fails, deploy the preceding compatible API/client and stop exposing its entrances; do not drop message, call, avatar or report tables to roll back. Investigate failed migrations before rerunning rather than resetting migration history.

Record: candidate and main SHA, verification/production/recovery runs, encrypted backup receipt, isolated upgrade evidence, all live commit descriptors, Google onboarding, Redis failure behavior, queued cleanup reaching its terminal state, alert delivery, and APK hash/signing identity. Keep device keyboard, permission, audio isolation and interruption checks separate from browser evidence.
