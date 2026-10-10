# Room experience changes: Vercel Queues deployment

Applies to OpenSpec change `simplify-room-and-mobile-experience`. Historical status: the production database was backed up and four migrations succeeded on 2026-10-07. Commit fc7bbf8 was deployed on 2026-10-08, but the real cloud cleanup check failed. The request-scoped recovery-seeding patch described below passed the complete local API checks and awaits deployment and cloud verification.

## Problem and solution

The old leave endpoint continued waiting for LiveKit after the database transaction committed. A provider failure could therefore report an already-committed departure as a 503. The new endpoint returns the member's LEFT state, the room's business state, and PENDING cleanup status. Cleanup commands remain durable in PostgreSQL. The client immediately starts muting and disconnecting; if departure confirmation fails, it retries with the original membership generation.

A normal Nest/BullMQ worker needs a persistent process. Vercel can instead use a platform-managed Queues consumer function without an additional persistent server. This consumer handles short tasks; it does not replace a room-speech worker that continuously subscribes to audio.

## Topology and recovery

- Public Nest API: `apps/api/src/main.ts`. In Vercel mode, it seeds recovery-scan messages within the request context. Platform `waitUntil` tracks publication without blocking the HTTP response.
- Private consumer: `apps/api/api/realtime.ts`. `apps/api/vercel.json` binds `queue/v2beta` to topic `slogan-realtime`. A separate function matters because a queue-triggered function is not a public HTTP API on Vercel.
- Adapter: `RealtimeQueue` publishes managed queue messages when `VERCEL=1` and does not start a BullMQ Worker. Other environments continue using Redis/BullMQ.
- The consumer reads durable PostgreSQL commands and performs identity revocation, room deletion, expiry, and appointment tasks. Database failures or failures to publish the next scan are thrown to the SDK for redelivery with backoff.
- The next scan is delayed by 30 seconds while cleanup commands or active rooms remain, and by 300 seconds when idle. Messages contain only task types and identifiers, never message content, audio, or credentials.
- Concurrent HTTP requests share one in-flight seed operation. The five-minute cooldown starts only after publication succeeds; failure allows the next request to retry. Later requests can reseed interrupted scan chains. Startup does not publish recovery messages because request OIDC context would be missing.
- Even when publication of one command fails, the scan rereads PostgreSQL. Existing transactions, command generations, and state checks absorb duplicate delivery. Departed members' business state is never rolled back.

Vercel Queues is in beta with usage limits and per-operation billing. This implementation does not promise unlimited free usage or immediate revocation regardless of service failures. SDK retention is set to 7 days; expired messages cannot be recovered indefinitely. If initial seeding fails, the scan chain stops, or downtime exceeds retention, inspect logs, restore the database/queue, and reseed through an HTTP request after deployment or cooldown expiry. Tasks are rebuilt from the database; queue expiry does not delete their durable commands. Verify recovery before release; local SDK mocks cannot establish cloud recovery.

## Release order

1. Confirm and back up the target database, then apply incremental Prisma migrations: `20261007100000_room_level_ranges`, `20261007100100_room_text_messages`, `20261007100200_room_level_range_upper_bound`, and `20261007100300_room_message_foreign_keys`. Do not overwrite previously published migrations.
2. Keep the Vercel API root at `apps/api` with the NestJS build. Publish both the API and standalone consumer, then confirm that the console shows the `slogan-realtime` consumer. Vercel supplies `VERCEL` automatically; do not set it manually in persistent-process environments.
3. Reuse the approved database, LiveKit, and `REALTIME_ENABLED` configuration and confirm that the consumer can access it too. This change does not alter providers, secrets, Google login, or remote environment variables.
4. Verify business success for ordinary departures and departures during LiveKit failure. After stopping all clients and HTTP requests, consumer execution must still be recorded and PostgreSQL commands must move from PENDING to COMPLETED. Verify reauthentication, redelivery, consumer restart, provider recovery, and rejection of old identities.
5. Publish admin/mobile Pages and Android packages after the API contract is ready. If the old production API lacks new message/proficiency fields, network failures in the new APK do not establish feature acceptance.

## Rollback

Retain the new fields and message table; older single-level requests remain compatible. Host-successor selection is a client compatibility change, and the combination of an old APK with new behavior cannot be called accepted. After disabling new frontend entry points, the frontend version may be rolled back. Do not revert LEFT, ENDING, or ENDED states or delete pending commands. Before removing queue functions or triggers, drain commands or confirm that another consumer has taken over. Preserve topics and the database during consumer rollback so scan-based reconstruction remains possible.

## Existing evidence and release gate

Local `vercel build` produced public `index.func` and standalone `api/realtime.func`; the latter contains the `queue/v2beta` / `slogan-realtime` trigger configuration. Managed-runner and queue-adapter tests covered processing after response, failed redelivery, scan reconstruction, delays, and seed deduplication. PostgreSQL integration tests covered provider failure and recovery.

Four migrations were applied successfully to the confirmed Neon main/neondb on 2026-10-07, with 25 completed migrations and 0 failures. Existing 5 users and 4 rooms were retained; proficiency fields and message foreign keys were inspected. See [migration evidence](../acceptance/simplify-room-and-mobile-experience/production-migrations.json). Actual cloud queue triggering still requires post-release verification, so OpenSpec task 5.3 remains unfinished.

References: [Vercel Queues](https://vercel.com/docs/queues), [SDK](https://vercel.com/docs/queues/sdk). These sources establish platform capabilities, not this project's deployment success.

The actual production check on 2026-10-08 found that cleanup commands did not execute for six minutes. Request-scoped seeding and safe log classification were verified locally. Task 5.3 remains unchecked until cloud triggering passes; the specific failure still needs comparison with production logs.
