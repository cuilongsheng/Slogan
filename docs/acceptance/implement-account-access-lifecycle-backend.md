# Account access lifecycle backend acceptance

Date: 2026-09-18

## Local implementation

- Added additive PostgreSQL facts for `User.deletedAt`, versioned `PhoneIdentity` lookup hashes and idempotent `AccountLifecycleCommand` results. Existing OAuth identities remain unchanged and gain a per-user/provider uniqueness boundary.
- Added international phone parsing, supported-region checks, versioned HMAC lookup, minimal `+calling-code••last-two` display masks and Redis OTP challenges. Redis stores only hashes, purpose, attempt counters and short-lived grants; it never stores the full E.164 number or plaintext code.
- Added multi-dimensional send limits, resend cooldown, atomic attempt decrement/single consumption, purpose/user/request-bound verification grants and an HTTP SMS adapter with normalized failure, timeout and uncertain outcomes.
- Added phone challenge/exchange, login-method listing, authenticated phone/OAuth linking and phone/OAuth account-deletion step-up endpoints. OAuth login remains independent of the SMS provider.
- All OAuth, phone, session issue, refresh and access-token paths read the current PostgreSQL account status. `DISABLED` and `DELETED` identities stay occupied and cannot create a replacement account or session.
- Added a serializable, idempotent soft-deletion transaction. It sets `DELETED/deletedAt`, revokes sessions and realtime identities, increments active membership generations, writes durable LiveKit revoke commands, transfers or ends hosted rooms, cancels future hosted rooms/reservations/invitations, ends pending social relationships and leaves safety/history/content facts intact.
- Added `ACCOUNT_RESTRICTED_RECORD_READ` only for `PLATFORM_ADMIN` and `SAFETY_OFFICER`. The restricted endpoint returns status/times, method categories, a minimal profile snapshot and safety-reference IDs. Successful and rejected reads write content-free audit events.
- Added `PHONE_AUTH_ENABLED` and `ACCOUNT_LIFECYCLE_ENABLED`, both disabled by default. Phone auth requires secure SMS configuration, independent peppers, supported regions and Redis. Account deletion requires Redis for short-lived step-up proofs.

## Privacy checks

- PostgreSQL contains no full phone number. `PhoneIdentity` contains only hash version, HMAC lookup hash, calling code and last two digits.
- Redis challenge/grant tests inspected stored values and confirmed no plaintext OTP or E.164 number. Temporary keys use TTLs; maintenance removes only orphan temporary keys.
- SMS requests contain only destination, code, template, sender, locale and an opaque correlation ID.
- Structured logging redacts phone/e164/OTP/code/proof/grant/hash/provider payload, OAuth code/token and secret/pepper keys. API errors contain stable codes without provider bodies, SQL, stacks, full numbers or codes.
- Soft deletion retains identity occupancy, reports/cases, restrictions/appeals, audits, room history, private notes and saved learning content. No restore, unlink-after-deletion, identity reuse or physical-delete route was added.

## Migration, rollout and rollback

1. Deploy the additive migration while `PHONE_AUTH_ENABLED=false` and `ACCOUNT_LIFECYCLE_ENABLED=false`.
2. Configure Redis, `PHONE_IDENTITY_HASH_VERSION`, independent 32+ character peppers, SMS provider URL/key/sender/template, supported ISO regions and operational limits. Run readiness plus provider smoke before enabling phone auth.
3. Enable phone challenge/exchange and linking first. Enable account deletion only after realtime command recovery and backoffice restricted-read checks pass in the target environment.
4. Roll back by disabling the two feature flags and deploying the prior compatible binary. Keep the new tables/columns, `DELETED` states, identity occupancy, commands and audits. Do not change deleted users back to `ACTIVE` and do not delete retained evidence during emergency rollback.

## Local verification evidence

- Runtime: Node.js 24.21.0, PostgreSQL 17.6 and Redis 7.4.11.
- `prisma validate` and `prisma generate` passed. The isolated historical migration ran with and without existing users; identity uniqueness and additive defaults passed.
- Unit/bootstrap: 31 suites, 181 tests passed, including normalization, SMS adapter outcomes, configuration gates, RBAC and log redaction.
- Integration: 30 suites, 173 tests passed. Account-specific coverage includes Redis atomic consumption, purpose isolation, attempts/cooldown, concurrency, phone/OAuth uniqueness and conflicts, status gates, deletion rollback, idempotency, retained facts, restricted reads/audits and technical cleanup.
- HTTP E2E: 14 suites, 71 tests passed. The account flow registered by OTP, linked Google and WeChat to the same user, returned only masked login methods, completed step-up deletion, rejected old access/OAuth login and allowed an audited admin restricted read.
- Runtime: 7 suites/9 tests passed against real PostgreSQL/Redis. The account-specific restart smoke proved that a provider failure leaves the user blocked in PostgreSQL, preserves the revoke command and completes participant revocation after a new process starts.
- `pnpm deps:check`, API lint/typecheck/build, OpenAPI generation/check and `git diff --check` passed. `openapi/openapi.yaml` contains every new phone, linking, step-up, deletion and restricted-record route.

## External evidence still blocked

- **BLOCKED:** no approved production/sandbox SMS account, sender/template policy, cost threshold or real international test numbers are available. Request delivery, carrier error mapping, cooldown/limit behavior under billed sends and provider dashboard evidence were not executed.
- **BLOCKED:** real Google and WeChat application credentials/provider approval are unavailable. First login, authenticated link, cross-account conflict and post-deletion rejection were verified with local adapters, but not against the real providers.
- These blocks leave OpenSpec task 8.6 unchecked. The change must remain active and must not be archived until both provider smoke groups have evidence.
