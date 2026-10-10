## Context

See [proposal.md](./proposal.md) for motivation. Currently `rooms` has implemented create/list/detail/join, the repository uses PostgreSQL room row lock, membership is unique `(roomId,userId)` and saves `joinOrder`. Room only has `OPEN/ENDED`; voice and LiveKit are still empty skeletons, and the current API dependencies do not have LiveKit, Redis or BullMQ.

The original mixed proposal is split based on user confirmation. This article and this change tasks only have real-time foundations; [Room host management design](../implement-host-controls-backend/design.md) consumes these foundations and cannot reversely become the implementation dependency of this change. Current product requirements have not been reduced, and phased delivery does not mean that the complete product has been accepted.

## Goals / Non-Goals

**Goals:** establishes authorization, minimum permission token, trusted presence, expiration, audit/outbox and provider compensation closed loop, and provides the real boundary for the next change call.

**Non-Goals:** does not implement room host permission changes, member active leave/re-entry, removal/invitation status, room host 60-second timer or management endpoint in advance; does not regard front-end/device acceptance as back-end test results.

## Decisions

### 1. Module boundaries and dependency delivery

`rooms` owns room, membership, capacity, joinOrder, Room status and all database transactions. `voice` has credentials, webhook orchestration, task handler and provider reconciliation, working through rooms' public application API. LiveKit SDK only enters the infrastructure adapter, domain and controller do not depend on the SDK.

Do not create `rooms <-> voice` circular import: rooms only submit business facts and provider-neutral outbox, voice dispatcher consumption; do not build a general event platform or hypothetical multi-provider abstraction. The next change reuses the following table, and cannot create another base with the same name:

| This change is delivered                                                                             | How to use subsequent room host management                                          |
| ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Current member/room authorization snapshot and intra-lock transaction API                            | Extended leave/remove/invite/transfer policy, reuse capacity and version protection |
| Signature verification, idempotent, presence update normalized by identity/session and provider time | Access room host disconnection/recovery rules in the same persistent transaction    |
| RoomEvent, RealtimeCommand, identity history and compensation dispatcher                             | Added business producers for management events and revoke command                   |
| `OPEN -> ENDING -> ENDED` and end transaction entry                                                  | host end, no successor and timeout calling the same entry                           |
| provider revoke/list/delete, BullMQ, due tasks and reconciliation                                    | Add host-timeout handler/deadline, do not copy queue or adapter                     |

The delivery record needs to write down the actual public entry, parameters, transaction ownership, event fields and verification evidence, and cannot only retain placeholder interfaces.

### 2. Real-time data and status

Room adds `ENDING`, `stateVersion`, `endedReason/endedAt`. membership adds random `participantIdentity`, `credentialVersion`, presence status and provider session identifier/time water level; the initial identity uses a random UUID and does not include user ID, nickname and other information. Keep the historical authorized identity and revocation status to overwrite the old token at the end; do not save JWT.

Existing memberships continue to represent valid and capacity-based qualifications. presence only describes connection observations, and disconnection cannot delete membership or release capacity. LEFT/REMOVED/INVITED, departure time, re-entry joinOrder and memberCount lifecycle filtering are all added in the room host management change; this time, the unavailable management status will not be established in advance.

Room final state and expiration checks must constrain join, credential, and member queries at the same time. `ENDING` immediately rejects the new join/token. After the provider cleanup is completed, it becomes `ENDED`. The status cannot be reversed. Authorization is refused when `endsAt` reaches the point, and the worker's qualification cannot be extended due to delay.

### 3. Token, provider and revocation boundary

`POST /v1/rooms/{roomId}/realtime-credentials` Verify account qualification, membership, Room status and expiration time from access identity. Response contains only `serverUrl`, `participantToken`, `expiresAt`, opaque `participantIdentity` and `roomId`. The provider room name uses the non-reused `room-<UUID>`. Before issuing for the first time, idempotent ensures that the provider room exists and sets a defensive upper limit based on business capacity.

TTL defaults to 5 minutes and can be configured from 60–600 seconds; grant only has the target room’s join, subscription, and microphone publish, and explicitly disables data and metadata self-modification, as well as admin/create/record/video/screen permissions. Do not put PII into identity, room name, or metadata, nor log token/secret/raw webhooks. Default mute is future client behavior.

Follow the original proposal's LiveKit Cloud revocation target: the adapter's remove/revoke uses explicit cutoff at each execution to overwrite the offline identity; the completion of cleanup must mean that the old token cannot be reconnected. Specific SDK parameters, offline return semantics, clock tolerances, and concurrent certification races must be verified at implementation time; receipt of not-found alone cannot be regarded as evidence of revocation. Do not replace undo with short TTL, do not silently change to self-hosted.

Validate the room and credential version before and after issuance. If room termination races with credential issuance, never return stale authorization. Execute provider side effects outside the transaction. Keep traceable revocation records for old identities that have been issued or may be exposed. If the provider cannot prove the target, stop the relevant acceptance and report without lowering the security target.

### 4. Webhook and presence reconciliation

`POST /v1/webhooks/livekit` only uses provider signature for authentication; NestJS retains raw body, accepts `application/webhook+json`, and verifies Authorization and original content by SDK `WebhookReceiver`. Signature verification failed 401, no business mutation; user Bearer token cannot replace signature.

Provider event ID is uniquely persisted. Verify room/current identity, provider session and time water level, handle joined, left, connection-aborted, room-finished; late old session left cannot mark new connections as disconnected, repeated events return 2xx and do not repeat side effects. Unknown or old identity does not create membership, log minimum diagnostic fields and revoke confirmed stale identity. Reconnection only updates the presence and does not transfer the room host.

room-finished needs to check the current provider room instance; promote the public end path for instances that have been opened and have definitely ended, and reconcile undetermined events first, and subsequent instances cannot be terminated with late signals. Provider presence is not an authorized source. Periodic list reconciliation is required to fill in missing events, clean up stale identity and restore pending commands.

### 5. Expiration, transactions and durable command

Realm state, RoomEvent and RealtimeCommand are saved in the same PostgreSQL transaction; unique `(type, aggregateId, stateVersion)` or equivalent business idempotent keys are deduplicated. The first provider operation is synchronized after submission. Failure is retained in pending and backed off by BullMQ's limited index. The failure record is diagnosable and does not contain sensitive original text. Worker supports safe claim/lease, crash retrieval and repeated execution, and does not wait for provider in database lock.

The expired task uses room ID and endsAt to form a legal deterministic job ID (the implementation must comply with the selected BullMQ ID restrictions); the worker re-locks the room, verifies the version and database time, enters ENDING, revokes all unrevoked identities, and then deletes DeleteRoom. ENDED is only completed after all are successful. DeleteRoom itself does not serve as proof that all old credentials are invalid.

Redis only coordinates tasks; the database saves endsAt, Room status and command status. Start/cycle reconciliation to catch up on missing expiry jobs and pending commands. Redis interrupts delay actual disconnect, but eligibility check is turned off at endsAt without grace; cleanup delay is faithfully logged and infrastructure failure is not reported as immediate provider success.

### 6. HTTP and unique contract

Only the following three endpoints are added:

- `POST /v1/rooms/{roomId}/realtime-credentials`: User authentication and membership verification.
- `GET /v1/rooms/{roomId}/members`: Only returns membership ID, nickname, CEFR, role, position, presence and current opaque identity to currently valid members, but does not return birth, region, provider SID or historical privacy reasons.
- `POST /v1/webhooks/livekit`: provider signature verification, no user Bearer guard.

The existing join keeps idempotent and qualification/password/rule/capacity checks, and adds ENDING and expiration interception. Stable errors include `ROOM_MEMBERSHIP_REQUIRED`, `REALTIME_PROVIDER_UNAVAILABLE`, `REALTIME_WEBHOOK_INVALID` and existing room errors. leave/removals/invitations/end, re-entry and `ROOM_HOST_RECONNECTING` are added in the next change.

Follows NestJS decorator/DTO code-first to deterministically generate unique `openapi/openapi.yaml`; no handwritten copy is maintained.

### 7. Verification and controlled delivery

Local evidence covers real PostgreSQL migration, authorization/certification/end contention, event idempotent and reverse order, real Redis retries and recovery, SDK token claims/signatures, fake provider HTTP E2E, OpenAPI drift, and module boundaries. Real Cloud smoke authenticates connection, minimum permissions, old token rejection after online and offline identity revocation, DeleteRoom disconnection and signature webhook; write BLOCKED when there is no certificate, and fake adapter cannot be used to replace provider PASS.

The acceptance matrix marks the host end trigger, leave/rejoin, remove/invite, room host handover and disconnection windows as being covered by the next change, and cannot declare that the entire current voice-session/host-controls are completed. Front-end mute, two-way audio, reconnection UI, and device permissions are left to subsequent physical device acceptance; only controlled basic integration verification is allowed before room host management is implemented.

## Risks / Trade-offs

- [Risk] There is no room host management on a phased basis → Clarify subsequent dependencies in the delivery record, and host-controls must be completed before the complete product is released; do not mark the removed requirements as PASS.
- [Risk] Webhook lost/reverse order → persistent inbox, session/time water level and provider reconciliation; subsequent room host timer reuses the same event processing.
- [Risk] Provider/Redis fails after database submission → Authorization is closed first, and the durable command is compensated; the status is truthfully maintained as ENDING/pending, and the disconnection completion is not falsely reported.
- [Risk] Revocation is inconsistent with certification concurrency or Cloud behavior → version verification, identity history, real online/offline old token smoke; security boundaries cannot be accepted before proof.
- [Trade-off] Worker and API are in the same process → Reduce deployment units, retain recoverable tasks and failure observations; do not dismantle microservices in advance.

## Migration Plan

1. Fixed SDK, Redis, and BullMQ versions, verify installation according to `.nvmrc`; added `REALTIME_ENABLED`, `LIVEKIT_URL/API_KEY/API_SECRET`, TTL, `REDIS_URL` condition verification and log desensitization.
2. additive migration only adds this change's real-time fields, status, identity history, RoomEvent/RealtimeCommand and indexes, retains existing membership, joinOrder and foreign keys; verifies empty libraries and upgraded libraries containing real-time room fixtures.
3. First migrate the database, deploy Redis and close the realtime application, then enable the adapter, Webhook and worker in the isolation environment, and verify recovery and Cloud smoke. The actual deployment is performed by independent release work, and there is no claim to be online this time.
4. Output dependency evidence for use by host-controls. BLOCKED items must be passed to the next change because the real provider verification is not completed and cannot be eliminated due to task checking or archiving.

To roll back, first stop issuance of new credentials, clean up and revoke the issued identity through the still working provider and delete the active provider room, then stop the worker/return to the old application; maintain isolation and compensation processes when the provider fails, and cannot declare a safe rollback after closing the recovery path. Keep the newly added database fields, events and commands, and use forward fix to not destroy the audit facts.
