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

For a Neon pooled URL, backup and migration tools use the same endpoint's documented direct hostname (remove the endpoint's `-pooler` suffix). Approval and encrypted backup identity remain bound to the original configured URL; credentials, database and TLS options are preserved. API traffic continues using its configured pool. Other providers and isolated local targets are unchanged. This avoids session-lock reuse through a transaction pooler.

The pinned Vercel CLI runs through `pnpm dlx --allow-build=esbuild vercel@63.1.2`. pnpm 12 requires explicit approval inside the isolated dlx cache; workspace build approvals do not approve this separate installation. Only the CLI's required esbuild script is allowed. Migration and deployment failures expose recognized pnpm, Prisma or Vercel error codes while retaining provider output privately in bounded memory.

## Backup and restore

`database-recovery.yml` runs daily and can be dispatched manually. It snapshots production, encrypts locally before upload, authenticates the encrypted envelope, restores to an isolated PostgreSQL service with providers disabled, applies compatible migrations, and checks invariants. It cannot deploy the API or migrate production. The shared production concurrency group serializes it with release migration.

The policy is 14-day encrypted artifact retention, a 24-hour RPO target and a one-hour RTO target. These are configured targets until timed recovery evidence exists. The upload contains only ciphertext. Plaintext restore files live in a private temporary directory, are authenticated before `pg_restore`, and are removed on success or failure. Restoring into the current production database is rejected.

A failed GitHub workflow is a failed recovery/release signal. Configure repository workflow notifications and record a successful run plus an intentional failure delivery before claiming operational alert acceptance. Application alert delivery also requires a configured operations sink; a scheduled scan alone is not proof of notification delivery.

## Vercel maintenance

Deploy the `slogan-maintenance` queue consumer and set a private `CRON_SECRET`. The daily protected seed route restarts the minute continuation chain; successful API requests also seed it. Each delivery publishes its continuation before acknowledging, then claims a fenced database lease. Work covers direct-call expiry/cleanup, safety recovery, enabled operations, realtime recovery, and enabled assistance retention. Preview consumers cannot process production work.

Keep `ASSISTANCE_ENABLED`, room speech processing, email registration and WeChat disabled. Operations run only when explicitly configured; enabling retention or alert destinations is a separate configuration decision. Continuous audio workers require a long-lived runtime and are outside this managed invocation.

Authentication exchange/refresh quotas are atomic in Redis across API instances and fail closed with 503 when shared storage is unavailable. Vercel supplies the overwritten trusted source-IP header. Through Pages, this identifies the forwarding proxy rather than an individual visitor, so visitors sharing that proxy share a source quota. Arbitrary visitor headers are not trusted as authentication identities.

## Outbox upgrades and retained queue consumers

[Vercel Queue push topics are partitioned by deployment ID](https://vercel.com/docs/queues#deployments-and-versioning). A previous deployment can continue consuming its own delayed jobs after promotion. The minute maintenance and realtime recovery continuations do not naturally drain while they keep scheduling successors. Their database leases prevent overlapping claims; they do not select a compatible application version.

Before accepting an outbox-envelope upgrade, inspect bounded production runtime logs for old maintenance/realtime deployment IDs. Verify each source revision against the schema/envelope it can publish. An old dispatcher that selects only scope/owner can consume and delete a newer resource/kind row while discarding those fields. A successful new API deployment alone does not retire that worker.

Retire only explicitly identified incompatible, superseded deployments using deployment IDs and `vercel remove --safe`; preserve the active alias and a schema-compatible rollback deployment. Record IDs, source commits, observation window and outcome. Do not delete queue/business data, purge Redis or disable permission checks. Rerun the guarded owned-fixture stream probe, including host transfer and the removed actor's terminal membership event, before APK publication. Subsequent rollback must use a publisher compatible with every retained outbox envelope. See [the 2026-10-17 retirement receipt](../acceptance/unified-mobile-events/legacy-worker-retirement.json).

## Rollback and acceptance

Retain additive tables and private content. If new functionality fails, deploy the preceding compatible API/client and stop exposing its entrances; do not drop message, call, avatar or report tables to roll back. Investigate failed migrations before rerunning rather than resetting migration history.

Record: candidate and main SHA, verification/production/recovery runs, encrypted backup receipt, isolated upgrade evidence, all live commit descriptors, Google onboarding, Redis failure behavior, queued cleanup reaching its terminal state, alert delivery, and APK hash/signing identity. Keep device keyboard, permission, audio isolation and interruption checks separate from browser evidence.

## Client monitoring release configuration

Protected main Android builds require `SENTRY_MOBILE_DSN` and `SENTRY_MOBILE_AUTH_TOKEN` in the existing GitHub Production environment. The upload credential is used only by main build/verification steps; it is never written to GITHUB_ENV, APK metadata or a public artifact. Pull-request and branch builds do not receive it. Android monitoring uses the existing slogan-mobile project, production environment, commit-bound release/build and0.1 tracing. Logs, profiling, replay, NDK dumps and arbitrary attachments remain disabled. The upload gate deliberately fails closed if the configuration is missing.

The existing API-only `SENTRY_AUTH_TOKEN` and `SENTRY_API_DSN` authorization is not silently reused as a new client secret grant. Configure the two mobile entries through the approved private credential channel before merging the monitored workflow. Actual source-map upload and native device canaries have separate acceptance records; compilation alone is not symbolication evidence.

## Shared monitoring pause

After migration20261017080000_observability_monitor_control, gate-aware monitor workers also check the environment-scoped CONTROL row. Use the private `apps/api/scripts/monitor-control.mjs status|pause|resume` CLI with `DATABASE_URL`, `OBSERVABILITY_CONTROL_ENVIRONMENT` and the approved `EXPECTED_DATABASE_FINGERPRINT`. Mutations additionally require `CONFIRM_MONITOR_CONTROL` matching the environment. Never print the connection string. Resume requires the existing authenticated seed path to restart the continuation chain.

Pause stops monitor probes, continuation scheduling and completion heartbeats; it does not disable realtime cleanup, delete incident/outbox facts or alter business queues. Already acquired scans can finish their durable result. Older binaries ignore the new shared gate: retire only identified superseded monitor consumers after preserving the active deployment and a gate-aware rollback. Until that retirement and a target pause/reseed observation succeed, do not claim that all production monitoring has stopped.
