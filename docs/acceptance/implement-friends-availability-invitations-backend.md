# implement-friends-availability-invitations-backend acceptance

## Baseline and result

- Date: 2026-09-15. The implementation is local and is not deployed.
- Revision: `2687b1a30c90ee1b4abe5a768e28822153922b04` on `develop`. The checkout already contains other uncommitted OpenSpec deliveries, so this revision is only the implementation baseline.
- Runtime: Node.js 24.21.0 and pnpm 12.3.4. Final API verification passed: unit 20 suites / 138 tests, integration 21 suites / 140 tests, HTTP E2E 11 suites / 63 tests; 52 suites / 341 tests total. Lint, typecheck, build, migration deploy and OpenAPI drift checks also passed.

## Friend relationships and blocking

- `POST /v1/friend-requests` creates an actor-scoped, idempotent request. The recipient may accept or reject it, and the requester may withdraw it. A friendship becomes active only after acceptance.
- Friend requests and friend lists use opaque keyset cursors. Responses expose only the minimum social profile and caller-owned relationship state; they do not expose birth date, provider identity, credentials or room membership details.
- Directional blocking produces symmetric social isolation. Creating a block atomically ends the friendship and cancels pending friend requests and ordinary room invitations for the pair.
- Unblocking permits new interaction but does not restore an ended friendship, cancelled request or cancelled invitation.
- PostgreSQL advisory pair locks and unique constraints make concurrent opposite-direction requests converge to one pending relationship. `SocialCommand` stores the actor, request id, command kind and payload digest so an identical retry replays while changed content conflicts.

## Availability

- `POST /v1/me/presence/heartbeat` writes only `social:presence:<userId>` with a server-controlled TTL. The default is 90 seconds and the accepted configuration range is 30–300 seconds. Clients cannot provide a user id or timestamp.
- Availability combines a PostgreSQL eligibility projection with batched Redis `MGET`. It excludes blocked pairs, active room members, incomplete or underage profiles, disabled or deleted accounts and users with an effective safety restriction.
- `GET /v1/people/available` and friend projections never use Redis key scans. Redis does not own relationship, room, capacity or membership facts.
- The real Redis runtime smoke passed 1 suite / 2 tests. It verified refresh, batch lookup, TTL expiry and fail-closed behavior. A read failure returns no online users; a heartbeat failure returns `SOCIAL_PRESENCE_UNAVAILABLE` without changing the room flow.

## Ordinary room invitations

- Only the current host can create an ordinary invitation. The target must be an eligible friend or currently available user and must not already have an active or removed membership.
- `GET /v1/me/room-invitations` and the decline route are scoped to the invitee. The response contains a minimal room projection and excludes password digests, LiveKit identities, tokens and other members' profiles.
- The join request accepts an optional `invitationId` for backward compatibility. The locked room transaction revalidates the invitation and consumes it only after membership creation succeeds. A failed password or other join check leaves it pending.
- An invitation never reserves capacity. Concurrent invited users competing for one remaining place produced one successful membership, and the room remained within capacity.
- Existing join policy remains authoritative for password, reservation, rules acceptance, age, account state, safety restrictions, blocking and capacity. An ordinary invitation cannot restore a `REMOVED` membership; that remains owned by the host-controls reinvitation flow.

## Migration, contract and privacy

- Migration `20260915010000_social_availability_invitations` adds `FriendRequest`, `Friendship`, `UserBlock`, `SocialCommand` and `RoomInvitation` with normalized-pair checks, foreign keys, indexes and partial unique constraints.
- The isolated migration test passed against both an empty historical chain and a chain containing existing users. The migration is additive; existing user, room, reservation, safety, history-note and restriction tables are not rewritten.
- `openapi/openapi.yaml` remains the sole generated API contract. It includes the social, block, presence, availability and ordinary invitation routes plus the optional join `invitationId`; `openapi:check` passed.
- Stable public errors disclose no existence or relationship detail across blocked or unauthorized boundaries. Request ids support safe command retries without exposing stored payloads.

## Commands and scope boundary

- `pnpm verify:api` — PASS, 52 suites / 341 tests.
- Real Redis runtime smoke for `test/runtime/social-presence-redis.smoke.spec.ts` — PASS, 1 suite / 2 tests.
- `pnpm deps:check` — PASS; dependency-cruiser checked 274 modules / 1044 dependencies with zero violations.
- `/Users/cls/.nvm/versions/node/v25.9.0/bin/openspec validate implement-friends-availability-invitations-backend --strict` — PASS.
- `pnpm format:check` — PASS.
- This change does not provide push notifications, private messages, public room discovery filtering by block state or cross-device durable presence history.

## Rollback

- Disable the new social, presence and ordinary invitation routes and stop clients from sending `invitationId` before rolling application instances back.
- Redis presence keys expire automatically. Keep the additive PostgreSQL enums, tables and command facts during a forward fix; do not destructively remove accepted friendships, blocks or consumed invitations.
