## 1. Data model and domain rules

- [x] 1.1 Add enums and models for friend requests, friendships, user blocks, social commands, and ordinary room invitations to the Prisma multi-file schema. Run `pnpm --filter @slogan/api db:generate` to verify schema generation.
- [x] 1.2 adds forward-only migration and normalized user pairs, non-self-relevance, active relationship uniqueness and necessary query indexes, and uses migration integration testing to verify empty database and existing complete migration chain upgrades.
- [x] 1.3 Implement the pure domain policy of friend request state machine, normalized user pairs, target qualifications, invitation status and cursor verification, and use unit tests to cover self-association, illegal conversion, two-way requests and boundary input.
- [x] 1.4 Implement `(actorUserId, clientRequestId)` social command summary and replay rules, and use unit tests to verify retries of the same command and change target/action conflicts.

## 2. Friends, blocking and idle status

- [x] 2.1 adds the `social` module public boundary and Prisma repository to implement friend request initiation, paging, acceptance, rejection, withdrawal, friend paging and deletion, and uses PostgreSQL integration testing to verify mutual consent, permissions, idempotent and concurrency and mutual convergence.
- [x] 2.2 Implement user blocking, the caller’s block list, and unblocking. Under a normalized user-pair lock, atomically remove friendships, pending requests, and pending invitations. Integration tests verify bidirectional isolation, transaction rollback, and no automatic restoration after unblocking.
- [x] 2.3 Implement database eligibility projections excluding disabled/deleted accounts, incomplete profiles, minors, current safety restrictions, active memberships, and blocks in either direction. Integration tests verify that neither direct queries nor concurrent writes can bypass eligibility.
- [x] 2.4 Implement the Redis presence adapter, a default 90-second TTL, batch reads, and safe degradation. Adapter unit tests and Redis runtime tests verify refresh, expiry, absence of key scans, and connection-failure behavior.
- [x] 2.5 Implement realtime `isAvailable` on the friend list and keyset pagination for invitable users. Integration tests verify minimal profiles, stranger visibility, friend state, blocking isolation, and cursor-context errors.

## 3. Ordinary room invitation and joining affairs

- [x] 3.1 Add the ordinary invitation repository/service to rooms. Validate the current room host, friend or currently idle target, and room/target eligibility. Integration tests verify rejection of non-hosts, existing room members, blocked users, and terminal rooms.
- [x] 3.2 Implement pagination and rejection of the caller’s invitations, convergence for terminal rooms, and command idempotency. Integration tests verify that others cannot read or write on the caller’s behalf, repeated rejection is safe, and only one pending invitation exists per room/target.
- [x] 3.3 Extend the existing join command with an optional invitation identifier. Revalidate it inside the locked room transaction and consume it after membership succeeds. Integration tests verify that failure does not consume invitations and success commits atomically.
- [x] 3.4 Verify that invitations cannot bypass passwords, capacity, appointment quotas, rule confirmation, age, account status, safety restrictions, or blocking in either direction. Cover concurrent invited and ordinary joins competing for the final seat.
- [x] 3.5 Verify that `REMOVED` memberships can only use the existing host-controls re-invitation flow. Ordinary invitations, old tokens, and direct joins must not restore eligibility.

## 4. HTTP Contract and Permissions

- [x] 4.1 Add controllers, DTOs, and error mapping for friend requests, friend lists, blocking, presence, and invitable users. E2E tests verify authentication, caller-only boundaries, stable status codes, and responses without sensitive fields.
- [x] 4.2 Add send/read/reject room-invitation endpoints and extend the join DTO. E2E tests cover “heartbeat → friend acceptance → host invitation → invited join” and invitations to idle strangers.
- [x] 4.3 Use negative E2E tests to verify that both blocked parties disappear from lists, directly forged targets/times fail, non-host invitations fail, and responses do not expose password digests, LiveKit credentials, or other members’ profiles.
- [x] 4.4 Regenerate `openapi/openapi.yaml` through NestJS code-first and run `pnpm --filter @slogan/api openapi:check` to verify that the sole contract has no drift and older clients remain compatible without `invitationId`.

## 5. Evidence of acceptance and delivery

- [x] 5.1 Execute social and room-related units, PostgreSQL integration and HTTP e2e tests, record friend concurrency, screen cleaning, presence expiration, invitation consumption and capacity competition results.
- [x] 5.2 Execute presence TTL, batch query and fault recovery smoke on the local real Redis to confirm that there is no false idle report when Redis is unavailable and that the existing room process continues to be available.
- [x] 5.3 Perform isolation upgrade verification on the complete historical migration chain and record the rollback boundary to confirm that existing users, rooms, reservations, security, historical notes, and restriction data remain unchanged.
- [x] 5.4 Run `pnpm verify:api`, `pnpm deps:check`, OpenSpec strict validation and format check once, fix the failures introduced by this change and save the final quantity.
- [x] Added `docs/acceptance/implement-friends-availability-invitations-backend.md` in 5.5, recording contracts, migrations, automation, Redis runtime, privacy boundaries, undeployed status and scope excluding push/private messages.
