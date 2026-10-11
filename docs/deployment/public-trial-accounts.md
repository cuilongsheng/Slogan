# Public trial accounts

The dedicated identities are `demo_s1`, `demo_s2` (ordinary mobile users) and `demo_m1` (public read-only viewer). They are separate from the existing five private preview slots. Only the dedicated operator command accepts the owner-selected public password; ordinary password policy is unchanged.

## Operator commands

Build the API first. Load the named target environment from an owner-only file, supply `PREVIEW_DATABASE_URL` explicitly, and set `PREVIEW_ENVIRONMENT_ID` to the same target. Never paste a connection string or password into command history. The input JSON must be a regular, owner-owned file with mode 0600, with a single `password` property.

```sh
pnpm --filter @slogan/api build
pnpm --filter @slogan/api public-trial:accounts --environment slogan-preview --action dry-run --input /absolute/private/input.json
pnpm --filter @slogan/api public-trial:accounts --environment slogan-preview --action provision --input /absolute/private/input.json
pnpm --filter @slogan/api public-trial:accounts --environment slogan-preview --action status
```

Creation is atomic and idempotent. A collision with an unrelated identity or a disabled trial set fails without resetting credentials. Existing private users are not renamed, overwritten or assigned new roles.

## Read boundary

The viewer can authenticate, refresh/logout its own session, read its own identity and current role, and read `/v1/backoffice/public-rooms`. The endpoint includes only public OPEN/SCHEDULED room summaries: topic, proficiency range, type, capacity/counts and timestamps. It excludes host/member identities, private rooms, access passwords, share tokens, reports, evidence and audits. The viewer's authenticated requests to other product or admin routes are denied by the server. Its navigation contains only the room summary view and logout.

Trial identities cannot link credentials, reset/change their public password, or be granted private backoffice roles. Existing account status, rate limits, adult eligibility and safety checks still apply. Shared mobile accounts can expose their activity to other visitors; do not enter private information.

## Rollback and migration

Before migration, back up the explicitly named database. Apply `20261011043000_optional_profile_details` , `20261011043100_public_trial_accounts` and `20261011043200_public_trial_constraints` before the compatible API/client. They retain existing values, add nullable fields and trial metadata, and do not backfill invented birth dates or assertions. Do not roll back to readers that assume birth fields are always present after nullable profiles exist.

To withdraw public access, run:

```sh
pnpm --filter @slogan/api public-trial:accounts --environment slogan-preview --action disable
```

This disables only registered public users and revokes their sessions/roles. Remove README credentials, retain additive schema, and publish a compatible application rollback if needed. Do not drop enum values or reset the five private accounts. A disabled trial set cannot be silently revived by provision.

## Evidence

Automated suites are unexecuted under the owner instruction. Compilation and contract generation are separate evidence. Deployment/account runtime results are recorded in `docs/acceptance/public-trial-accounts/README.md`; public credentials must not be advertised before successful deployed login and boundary verification.
