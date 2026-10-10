# LiveKit real-time backend delivery record

## Status and scope

- Change：`implement-livekit-voice-session-backend`。
- Date: 2026-09-12; Node.js 24.21.0, pnpm 12.3.4.
- Delivery scope: real-time credentials, current member query, signed webhooks, persistent presence/identity history, auditing/outbox, expiration end and recoverable queue.
- Local verification: The final complete verification results are shown in the table below; it does not represent CI, Cloud or device acceptance.
- **Cloud smoke: BLOCKED / not executed**。 LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET are not configured locally. The product owner has chosen to complete local verification first and the Cloud item remains outstanding.
- Release status: **not deployed**; public network Webhook is not configured, production room is not created, and change is not archived.
- Room host leave/transfer/remove/reinvite/end and 60-second window are implemented by subsequent `implement-host-controls-backend`; this change does not declare that the entire voice room product has been completed.

## Local verification

| Check                                            | Result                                                                                                                    |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| `pnpm install --frozen-lockfile`                 | PASS; locked livekit-server-sdk 2.19.0, BullMQ 6.3.4, ioredis 6.0.0                                                       |
| `pnpm --filter @slogan/api exec prisma validate` | PASS; Prisma multi-file schema                                                                                            |
| `pnpm --filter @slogan/api db:test:migrate`      | PASS; two new additive migrations, old migrations not overwritten                                                         |
| Final `pnpm verify:api`                          | PASS; 74 unit tests, 31 PostgreSQL/Redis integration tests, 18 HTTP E2E; lint, typecheck, build, OpenAPI drift all passed |
| `pnpm format:check`                              | PASS                                                                                                                      |
| `pnpm deps:check`                                | PASS; API-specific dependencies and module boundary checks                                                                |
| OpenSpec strict verification                     | PASS                                                                                                                      |

Using local isolation PostgreSQL 17.6 and Redis 7.4 test containers. The new real-time HTTP E2E uses real PostgreSQL and authentication services, only replacing the LiveKit provider and turning off the background runner to get deterministic HTTP evidence; the queue and recovery tests use real Redis separately. The above test does not connect to the real Cloud.

The build script for the native optional dependency `msgpackr-extract` is explicitly disabled with a JavaScript fallback; freeze installation and real Redis testing verify that this configuration works.

## Subsequent room host management reusable boundaries

| Ability                  | Actual Entry and Responsibilities                                                                                                                                                                                                                                                                                 |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Credential authorization | [RoomRealtimeService](../../apps/api/src/modules/rooms/application/services/room-realtime.service.ts)'s reserveCredential / confirmCredential / finishCredential: re-verify qualifications, current identity/version and room status; independent certification protection record for each request                |
| Member query             | members of the same service: restrict access to current members, only project membershipId, nickname, CEFR, role, position, presence, opaque identity                                                                                                                                                             |
| Room affairs             | [RoomRealtimeRepository](../../apps/api/src/modules/rooms/domain/ports/room-realtime.repository.ts)'s withRoom; [Prisma implementation](../../apps/api/src/modules/rooms/infrastructure/prisma-room-realtime.repository.ts) uses Room row lock and database clock, atomic submission status, events and commands  |
| Presence                 | RoomRealtimeService.applySignal: normalized id / roomId / roomSid / type / identity / sessionSid / occurredAt / source; event ID deduplication, current session and time water level verification, written within the transaction                                                                                 |
| End of entry             | RoomRealtimeService.endRoom: OPEN → ENDING; records the reason and creates undo and delete commands. ENDED is set only after the provider is deleted, and authorization is immediately rejected from ENDING or endsAt                                                                                             |
| External execution       | [VoiceService](../../apps/api/src/modules/voice/application/services/voice.service.ts)’s dispatch / dispatchPending / expire / reconcile; the first trial of Webhook only processes the pending command of the target room                                                                                        |
| Provider                 | [RealtimeProvider port](../../apps/api/src/modules/voice/domain/ports/realtime-provider.port.ts) and [LiveKit adapter](../../apps/api/src/infrastructure/livekit/livekit.adapter.ts): token, ensureRoom, participants, revoke, deleteRoom, verifyWebhook                                                          |
| Delay and recovery       | [RealtimeQueue](../../apps/api/src/infrastructure/redis/realtime-queue.service.ts), [RealtimeRunner](../../apps/api/src/modules/voice/infrastructure/realtime-runner.service.ts): Run within the existing API process, start and reconcile every 15 seconds, restore expired and pending commands in the database |

The public module entries are `modules/rooms/index.ts` and `modules/voice/index.ts`. The subsequent room host manages the extended rooms' own domain transactions, accesses the disconnection window in the same presence transaction, does not copy the adapter, event table, queue or end process, and does not rely on the Controller call sequence to ensure atomicity.

## Persistent facts and recovery rules

- Room saves ENDING, stateVersion, providerRoomSid, end time/reason; RoomMembership saves opaque identity, credentialVersion, presence and provider session/time water level.
- [RealtimeIdentity](../../apps/api/prisma/models/realtime-identity.prisma) retains the actual authorized identity and revocation status, but does not save the JWT.
- [RealtimeIssuance](../../apps/api/prisma/models/realtime-issuance.prisma) maintains an independent, up to 30 second protection record for each certification request. The request is released immediately after the provider operation is successfully completed. The normal room cannot be completed and waits for a fixed window; concurrent requests are released separately and the idempotent is released repeatedly. When the process crashes or the provider call result is unknown, the cleanup sequence is protected with a bounded period, and expired records are cleaned up by the recovery process.
- Local signature precedes provider network operation; 5 second single provider timeout, closes zone failover, and refuses to start network operation if insufficient protection time remains. Final confirmation checks the room/credential version again and does not return authorizations that have expired before confirmation.
- [RoomEvent](../../apps/api/prisma/models/room-event.prisma) saves normalized events and results; only the smallest IGNORED record is recorded for unknown room events. raw webhook, token, secret are not stored in the library.
- [RealtimeCommand](../../apps/api/prisma/models/realtime-command.prisma) uses the type / room / identity / stateVersion business key to deduplicate; the execution has leaseId/lockedUntil, and the claim can be re-claimed after a crash. The old lease cannot be overwritten with the new claim.
- Room deletion must wait for the completion of a valid certification request and be executed after all identity revocation commands are completed; not-found is not considered as evidence of explicit revocation success. Leave ENDING/pending on failure, client and log do not receive provider original error or key.
- Command executed up to 8 times with exponential backoff and FAILED / lastError retained. The Redis task has 5 backoffs; the final failure of Redis will not permanently occupy the recovery entry of the database task with the same name.
- Redis or provider failure can delay the actual disconnect; endsAt and database ENDING still close authorization immediately, and no additional joins will be granted due to queue failure. There is currently no production alarm system, and operation and maintenance needs to monitor FAILED, ENDING and queue delay.

When operation and maintenance restore FAILED, first verify that the provider/configuration has been restored, then set the status to PENDING for the confirmed command ID, reset the attempts/nextAttemptAt/lease field, and let the existing recovery process retry. You cannot bypass the old credential restrictions by reopening the Room, deleting identity history, or deleting failed commands; this change does not add a new public operation and maintenance endpoint.

## Only HTTP Contract

[openapi/openapi.yaml](../../openapi/openapi.yaml) is generated by NestJS DTO/decorator. Only three endpoints are added this time:

| Endpoint                                     | Authentication and results                                                                                                   |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| POST /v1/rooms/{roomId}/realtime-credentials | User Bearer + Qualification/Member/Room Verification; 200 minimum credential response                                        |
| GET /v1/rooms/{roomId}/members               | User Bearer + current member; 200 current member array                                                                       |
| POST /v1/webhooks/livekit                    | provider signature is the same as the original application/webhook+json; 204 successful reception, repeated event idempotent |

The default TTL of the certificate is 300 seconds, configurable 60–600 seconds, only the specified room, identity and microphone publish/subscribe are allowed; data, metadata update, admin/create/record/video/screen are not authorized. New errors include ROOM_MEMBERSHIP_REQUIRED (403), REALTIME_WEBHOOK_INVALID (401), REALTIME_PROVIDER_UNAVAILABLE (503); ENDING/expiration reuse ROOM_ENDED (409).

REALTIME_ENABLED defaults to false. At this time, the real-time user interface returns stable 503, and the original control plane can still be started. Require full Cloud/Redis configuration and start workers only when enabled; build OpenAPI and existing offline bootstrap validation explicitly turns off realtime.

## Requirements and Evidence Matrix

| Requirements                                                                                 | Local Evidence and Boundaries                                                                                                                                                                                      |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| voice-session: real-time voice communication                                                 | token claims and minimum member field PASS; real audio publishing/subscription, dual devices have not yet been verified                                                                                            |
| voice-session: mute by default                                                               | Subsequent mobile terminal/device acceptance, the backend does not claim coverage                                                                                                                                  |
| voice-session: Network reconnection feedback                                                 | presence and session prevent reverse order and loss webhook reconciliation PASS; client feedback and room host window return to subsequent changes                                                                 |
| voice-session delta: room expires and ends, no grace                                         | endsAt rejects joining/certification, ENDING, revocation before deletion, certification competition and successful request to immediately release PASS; actual Cloud disconnection/old token rejects pending smoke |
| voice-session: room host end room                                                            | Public termination mechanism provided; active room host entry is covered by host-controls                                                                                                                          |
| voice-session: room audio not processed                                                      | No recording, STT, transcription or playback capabilities introduced; token does not grant recording permissions                                                                                                   |
| basic-safety-reporting: Limit real-time credentials                                          | room/identity/TTL/minimum grant, non-member and expired accounts reject PASS; Cloud's actual revocation has not yet been verified                                                                                  |
| basic-safety-reporting: real-time event auditing                                             | Signature verification, unique event ID, old session, disconnection in the same second, unknown room minimum audit, transaction rollback PASS                                                                      |
| basic-safety-reporting: Server permissions                                                   | Real authentication HTTP 401/403, expired 409, Webhook cannot use user token instead of provider signature PASS; management/reporting permissions belong to subsequent changes                                     |
| host-controls: removal, reinvitation, transfer, 60-second window and wheat position re-entry | Not implemented in this change, subsequent changes will be independently verified; its Cloud dependency inherits the unfinished status                                                                             |

Evidence documents:

- [LiveKit adapter unit test](../../apps/api/test/unit/livekit.adapter.spec.ts): Real SDK signatures/claims, tamper detection, cutoff parameters, not-found and error desensitization.
- [PostgreSQL status/recovery testing](../../apps/api/test/integration/room-realtime.spec.ts): permissions, identity, presence, transaction rollback, concurrency end, claim/lease, provider recovery, missing Redis job, no additional certificate issuance waiting.
- [Migration test](../../apps/api/test/integration/realtime-migration.spec.ts): Complete upgrade of independent schema hollow library and upgrade including old rooms/members; check backfill, old field retention and new tables.
- [Redis test](../../apps/api/test/integration/realtime-queue.spec.ts): Deterministic ID, delay, retry, worker restart and final state failure rescheduling.
- [HTTP E2E](../../apps/api/test/e2e/voice.e2e.spec.ts): Actual Bearer, member permissions, minimum response, signature raw body, idempotent, original JSON endpoint, error mapping.
- [Log test](../../apps/api/test/unit/log-redaction.spec.ts) and [bootstrap test](../../apps/api/test/bootstrap.spec.ts): token/secret/raw payload desensitization, structured logs are not serialized first, conditional configuration and offline startup.

## Migration and rollback boundaries

Added `20260912020000_livekit_realtime` and `20260912030000_realtime_issuance_leases`. Old Room/RoomMembership ID, joinOrder, foreign keys and historical data are retained; there is membership backfill with random opaque identity, and the initial presence is DISCONNECTED. The upgrade test was executed in an isolated schema, without using the production database.

The application rollback first stops the issuance of certificates, then retains the still-working revocation/cleanup process to process the authorized identity, and confirms that the active provider session has ended before returning to the old version. Keep authorization closed when provider is unavailable, retain outbox and compensation processes, do not treat shutdown switch as broken. The database uses reserved additive fields and forward fix, and does not perform destructive down migration. Local verified field retention and failure compensation; real Cloud cleanup and full release rollback drills have not yet been performed.

## Cloud subsequent acceptance

After configuring the isolated Cloud project and the public network signed Webhook, you still need to use two temporary test identities to verify the connection/microphone permissions, reject the old token reconnection of the online and offline identities, DeleteRoom disconnection and the real signed Webhook. Existing fake providers or parameter checks cannot replace these evidences. The credentials only write the local environment configuration and do not enter the chat, repository or logs.

Refer to the current official boundaries: [Participant management](https://docs.livekit.io/intro/basics/rooms-participants-tracks/participants/), [Tokens and grants](https://docs.livekit.io/frontends/reference/tokens-grants/), [RemoveParticipantOptions](https://docs.livekit.io/reference/server-sdk-js/types/RemoveParticipantOptions.html). Implementation uses explicit undo cutoff and covers same-second nbf boundaries; Cloud behavior and clock premises must still be verified in practice.
