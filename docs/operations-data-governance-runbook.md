# Operations data governance rollout and recovery

This runbook applies to `implement-operations-data-governance-backend`. PostgreSQL is the persistent source of truth. Redis, worker timers, and alert delivery leases are disposable coordination.

## Rollout order

1. Deploy the additive Prisma migration with `OPERATIONS_GOVERNANCE_ENABLED=false`. Confirm the existing account, room, appointment, safety, audit, assistance, speech, and command APIs still pass their regression suites.
2. Start the operations worker with the flag still disabled. It must not claim metric, alert, or retention work.
3. Enable the feature for platform administrators and generate closed UTC daily windows. Check metric definition version, sample suppression, data watermark, query plans, and snapshot freshness before granting `OPERATIONS_ANALYST`.
4. Enable incident probes and internal incident reads. Configure the HTTPS alert sink only after its token is present and run a delivery/retry smoke.
5. Create retention policy drafts only for purgeable categories. Activate one policy at a time, run and review a short-lived dry-run, then execute a small batch. Protected identity, private content, safety, appeal, and audit categories remain retained in code.
6. Run a local or staging backup and isolated restore before scheduling target-environment recovery drills. External providers must remain disabled or fake during a restore.

## Configuration gates

- Alert sink URL and token are an all-or-nothing pair. The URL must be HTTPS outside tests and cannot contain credentials, query parameters, or fragments.
- Backup environment ID, encryption key ID, retention count, RPO, and RTO are an all-or-nothing policy set.
- `backup-postgres.mjs` also requires an explicit output path.
- `restore-postgres.mjs` requires `RESTORE_ISOLATED=true`, `PROVIDERS_DISABLED=true`, a target database name containing `restore`, `isolated`, or `recovery`, and a target different from `DATABASE_URL`.

## Recovery procedure

1. Select a backup by deployment policy without copying its location or secret into the application database.
2. Create a new isolated PostgreSQL database with no application traffic.
3. Set all provider and notification integrations to disabled or fake.
4. Run `pnpm --filter @slogan/api restore:postgres` with the guarded restore environment.
5. Run `pnpm --filter @slogan/api recovery:check`. A successful result covers migrations, identity ownership, rooms/memberships, reservations, safety references, role ownership, private content ownership, persistent commands, and governance references.
6. Record only the environment label, backup SHA-256 digest, tool/schema versions, observed RPO/RTO, check summary, and result through the recovery-drill API.
7. Destroy the isolated database after evidence is recorded.

## Rollback

Disable the operations worker and governance write endpoints first, then roll back the application. Keep all new metric, incident, policy, run, deletion-evidence, and recovery-drill tables. Do not run a destructive down migration. Content already deleted by a committed retention batch cannot be recreated by rollback, so rollback never depends on restoring deleted content.
