# implement-room-discovery-time-extension-backend acceptance

## Baseline and result

- Date: 2026-09-15. Implementation is local and archived; it is not deployed.
- Revision: `2687b1a30c90ee1b4abe5a768e28822153922b04` on `develop`. The checkout already contains other uncommitted OpenSpec deliveries, so this revision is only the implementation baseline.
- Runtime: Node.js 24.21.0 and pnpm 12.3.4 for application verification. OpenSpec validation uses the installed executable explicitly. Final affected-scope verification passed: unit 19 suites / 134 tests, integration 19 suites / 129 tests, HTTP E2E 10 suites / 59 tests; 48 suites / 322 tests total. Build, lint, typecheck, migration deploy, OpenAPI drift check, workspace audit and dependency-cruiser also passed.

## Discovery, visibility and sharing

- Instant and appointment creation persist `PUBLIC | LINK_ONLY` and independent random UUID share codes in the same creation transaction. Omitted visibility remains `PUBLIC`; password rules remain independent.
- Both public lists exclude `LINK_ONLY`, apply exact CEFR plus trimmed case-insensitive topic matching, and bind the opaque cursor to room kind and normalized filters. Legacy unfiltered cursors remain accepted only without filters.
- `GET /v1/room-links/{shareCode}` is public and returns a dedicated field whitelist. It exposes room identity, type, state, visibility, topic, CEFR, capacity projection, time, host display name and password presence only. It does not create reservations, memberships, realtime identities or credentials.
- Unknown share codes return `ROOM_SHARE_NOT_FOUND` with 404. Cancelled, ending, ended and expired rooms return `ROOM_SHARE_UNAVAILABLE` with 410. Authenticated join, reservation and realtime routes keep their existing profile, age, safety, rules, password, capacity and membership checks.
- Share URLs use the validated `ROOM_SHARE_BASE_URL`. Production requires HTTPS; test mode permits localhost HTTP. Credentials, query strings and fragments in the configured base are rejected.

## Extension transaction and concurrency

- `POST /v1/rooms/{roomId}/extensions` accepts an actor-scoped UUID request id and 1–60 integer minutes. Only the current eligible host may extend an `OPEN` room before PostgreSQL `clock_timestamp()` reaches its current `endsAt`.
- Each success adds time to the locked persistent `endsAt`, increments `extensionCount` and `stateVersion`, inserts one immutable `RoomTimeExtension`, appends one minimal `room_time_extended` event and creates one durable `SYNC_ROOM_TIME` command in the same transaction.
- Replaying the same actor/request/room/minutes returns the original result. Reusing the request id for different content returns `ROOM_EXTENSION_REQUEST_CONFLICT`. Concurrent contenders for the third extension commit at most one success.
- Repository tests cover instant rooms, scheduled and opened appointments, current host checks, expiry boundaries, invalid minutes, three-use limit, idempotency and concurrent last-use serialization. Existing host-transfer tests prove the persisted current host changes atomically; extension authorization reads that same locked field.

## Expiry, metadata and recovery

- The response returns the committed previous/new end times, used/remaining counts, state version and `COMPLETED | PENDING | UNAVAILABLE` provider status. Redis or provider failure never rolls back the database result.
- Expiry scheduling uses the new `endsAt`. Every expiry execution locks and re-reads PostgreSQL; a stale job at the old time leaves the room and identities open. Recovery scans rebuild the job from the current database time.
- LiveKit metadata is stable JSON containing only `schemaVersion`, `stateVersion`, `endsAt` and `extensionCount`. New remote rooms receive it during `ensureRoom`; existing rooms receive an update. A missing remote room completes locally because the next creation reads the latest database snapshot.
- `SYNC_ROOM_TIME` uses existing durable command leases, failure backoff and recovery. The dispatcher reads the latest room snapshot before provider I/O and reads it again afterward; a version change during the call triggers another update so the remote value converges rather than regresses.
- Redis recovery smoke stopped `redis-test`, extended a room, crossed its original end, invoked the stale expiry path, restarted Redis and ran `test/runtime/room-extension-redis-recovery.smoke.spec.ts`. Result: PASS in 9.0 seconds. The room stayed `OPEN`, recovery scheduled the new delayed expiry, metadata reached the extended end/version, and provider status became `COMPLETED`.

## Contract, privacy and verification

- `openapi/openapi.yaml` remains the sole generated contract. It contains visibility and share URL fields, both list filters, the unauthenticated resolver with no bearer security, and the authenticated extension request/response.
- Request bodies and responses are redacted from HTTP logs. Authorization, passwords, tokens, provider secrets, share codes and room-link URLs are also redacted or normalized. Public errors contain stable codes and no password digest, SQL, stack or provider message.
- Migration `20260915000000_room_discovery_time_extension` passed isolated fresh and historical-schema tests. It backfills `PUBLIC`, random unique share codes and zero extension counts, retains existing rooms, adds range/foreign-key/unique constraints and creates the immutable extension fact table.
- Local provider boundary tests cover metadata on create/update, missing remote room and provider failure. Integration tests cover `PENDING`, `UNAVAILABLE`, retry and a newer extension committed during an older provider call.

## LiveKit Cloud boundary

- **BLOCKED — not PASS:** `LIVEKIT_URL`, `LIVEKIT_API_KEY` and `LIVEKIT_API_SECRET` are absent from the process and local API environment file. The required real two-member Cloud metadata event smoke was not executed. No production connectivity, delivery latency or client event proof is claimed.

## Commands

- `pnpm --filter @slogan/api openapi:check` — PASS.
- Redis restart smoke described above — PASS, 1 suite / 1 test.
- `pnpm verify:api && pnpm deps:check` — PASS; dependency-cruiser checked 249 modules / 934 dependencies with zero violations.
- `/Users/cls/.nvm/versions/node/v25.9.0/bin/openspec validate implement-room-discovery-time-extension-backend --strict` — PASS.
- `git diff --check` — PASS.

## Rollback

- Disable the new resolver and extension routes and stop producing new sync commands before rolling back application instances. Deploy only workers that understand `SYNC_ROOM_TIME` while those commands can exist.
- Keep the additive columns, enum label, share codes, extension facts and durable commands during a forward fix. Do not destructively migrate away committed `endsAt` or idempotency facts.
