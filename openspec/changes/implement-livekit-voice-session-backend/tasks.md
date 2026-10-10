## 1. Dependencies, configuration and module boundaries

- [x] 1.1 Activate `.nvmrc`'s Node and check engines, fix LiveKit SDK, ioredis, BullMQ, update lockfile/toolchain; verify dependencies can be reproduced through frozen-lockfile installation and package inventory verification
- [x] 1.2 Added REALTIME_ENABLED, LiveKit URL/key/secret, 60–600 seconds TTL and REDIS_URL condition checks, updated environment examples/fixtures; verified through bootstrap test that missing/illegal configuration refuses to start when enabled, and existing control plane can be started when closed
- [x] 1.3 Configure log desensitization for token, Authorization, provider credential and webhook raw body; verify that the original values do not appear in the output through log unit testing
- [x] 1.4 Establish voice to rooms, expose application API, provider-neutral ports and infrastructure wiring, replace the empty skeleton corresponding to real responsibilities; verify through `pnpm deps:check` that there is no Controller direct connection to SDK, cross-module deep import or circular dependency

## 2. PostgreSQL real-time status and persistent compensation

- [x] 2.1 Added Room ENDING/version/ended field, membership opaque identity/credential version/presence/session water level, historical identity revocation record and RoomEvent/RealtimeCommand; verified the unique key/index through Prisma validate and constraint testing, and did not introduce room host management exclusive lifecycle/deadline
- [x] 2.2 Create additive migration, retain membership, joinOrder and foreign keys; use `pnpm --filter @slogan/api db:test:migrate` to verify the recovery path of upgrade and retained fields for empty libraries and existing room data fixtures
- [x] 2.3 implements RoomEvent/inbox and outbox repository, saves business status and commands in the transaction, supports idempotent, claim/lease, crash retrieval and status update; verifies repeated writing, concurrent claim, rollback and original payload/token are not dropped in the database through real PostgreSQL test
- [x] 2.4 Expand the authorization snapshot, presence update and public end transaction API of rooms, and make join/token reject ENDING and endsAt; pass the row lock/version competition test to verify that the issuance and end concurrency does not return invalid authorization, and disconnection does not release membership capacity

## 3. Provider adapter, credentials and Webhook

- [x] 3.1 Implement idempotent to ensure minimum provider room, short-term token and grants; verify room/opaque identity/TTL through SDK claims test, only allow microphone publish/subscribe and no data/metadata/admin/video/screen/PII
- [x] 3.2 Implement provider list, remove/revoke, delete adapter, verify the explicit cutoff, offline identity and not-found semantics of the selected SDK; verify error mapping/retry and revocation evidence through SDK contract testing, and failure shall not be considered successful if revocation is not confirmed
- [x] 3.3 Configure NestJS raw body and WebhookReceiver, verify provider Authorization and application/webhook+json; verify the signature and original validation through valid/missing/tampered signature and ordinary JSON endpoint tests without regression
- [x] 3.4 Implement persistent processing from inbox to standardized presence/room-finished, and de-duplicate and prevent reverse order by event ID, current identity/session/time water level; verify through PostgreSQL test that old session left, unknown room, duplicate events and room-finished do not overwrite the current instance by mistake

## 4. Redis/BullMQ, expiration and recovery

- [x] 4.1 Expand test compose and Redis infrastructure, establish queue/worker life cycle, legal certainty job ID, limited backoff and failure record in the existing API process; verify deduplication, retry, closed connection and non-retry of business conflicts through real Redis test
- [x] 4.2 Implement public end path and room-expiry: enter ENDING after determining endsAt/version in the lock, revoke all unrevoced identities and then DeleteRoom, and then ENDED after completion; verify through frozen clock/database test that no grace, late job will not release the issuance, repeated end and cleanup idempotent
- [x] 4.3 Implement outbox dispatcher's first try after submission, pending retry and stale/completed no-op; use provider failure/recovery and process interruption integration tests to verify that authorization is turned off first, the command is not lost, and no false reports of disconnection are successful
- [x] 4.4 implements startup/period rescheduling expiry/pending command and provider presence reconciliation; by deleting Redis job, losing all webhooks, old identity and worker restart test to verify state convergence and provider does not create membership

## 5. HTTP and the only OpenAPI

- [x] 5.1 implements two authentication endpoints, realtime-credentials and members; verifies account/room/membership/expiration authorization through HTTP E2E, response minimum fields, member order and birth/region/provider SID are not leaked
- [x] 5.2 implements webhooks/livekit endpoint and stable error mapping; verifies legal/duplicate events 2xx, illegal signature 401, user Bearer does not replace signature, REALTIME_PROVIDER_UNAVAILABLE does not expose keys through HTTP E2E
- [x] 5.3 updates NestJS Swagger DTO/decorator and generates unique `openapi/openapi.yaml`; uses Swagger parser and `pnpm --filter @slogan/api openapi:check` to verify three new endpoints, authentication differences and existing join expiration behavior without drift, and no management endpoint is generated

## 6. Dependence on delivery and acceptance

- [ ] 6.1 Execute opt-in smoke in the isolated LiveKit Cloud environment, verify the two-identity connection, minimum grants, old token rejection after online/offline identity revocation, DeleteRoom disconnection and signature webhook; write the real results to the acceptance record, record BLOCKED when there is no certificate and leave this item unfinished
- [x] 6.2 Record in `docs/acceptance/implement-livekit-voice-session-backend.md` the actual public API/transaction, event field, audit/outbox, identity history, queue and end entry for reuse by host-controls, and check them one by one by linking to the implementation and directed tests; clarify the pre-Cloud restrictions and host-controls/front-end/device acceptance, and the release state does not pretend to have been deployed
- [x] 6.3 After completing all implementations of this change, run `pnpm verify:api`, `pnpm format:check` and `pnpm deps:check` once, record Node, command and PASS/FAIL/BLOCKED; compare current voice-session/basic-safety-reporting with this delta to establish a scope matrix, management scenarios are classified under the next change, and unrun items are not marked PASS
