# Public trial account delivery

Target: `slogan-preview` on the explicitly owner-configured Neon database. The separate trial registry contains only demo_s1, demo_s2 and demo_m1. Existing five-slot private provisioning remains unchanged. No private passwords, connection strings or tokens are published.

## Upgrade evidence

The named target received an authenticated AES-256-GCM PostgreSQL backup in owner-only storage. The optional-profile, trial metadata and credential/revocation constraints migrations completed. Private provisioning records, credential hashes and account status were compared before/after and remained identical. Backup authentication and custom archive header were checked; a recovery restore was not executed.

The first atomic provision attempt was rejected by the legacy credential-origin database check. It rolled back without a partial account set. A separate forward migration extends that check for explicitly registered public credentials and preserves the existing verification cases. It also permits audited system revocation only for the public viewer role, leaving private-role actor pairing intact. Applied migrations were not rewritten.

## Verification boundary

API/mobile type checks, API compilation and generated contract/client completed. Regression examples were added but automated suites were not run under the owner instruction. Deployed login, denial/redaction, browser navigation and public README publication are release gates recorded below when verified. Device checks remain the owner's responsibility.

## Runtime results

Pending compatible production deployment and direct deployed verification.

## Rollback

See the [operator guide](../../deployment/public-trial-accounts.md). Disable only public identities and their sessions, remove public README credentials, and retain additive schema/nullable readers. Do not retire the private five slots.
