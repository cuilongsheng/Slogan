## Context

See motivation for [proposal.md](./proposal.md). This repository currently consists of a NestJS modular monolith, PostgreSQL, Redis/BullMQ, and LiveKit control plane; the existing livekit-server-sdk adapter is responsible for room, token, and room host management, but the API process does not subscribe to audio tracks. The archived AI/STT foundation only handles short audios actively uploaded by users, and has established destination-level consent, provider policies, no content logs, and intra-request temporary processing boundaries.

This change also affects room creation/joining, real-time media, STT, security evidence and background query, and is a Level 2 security and architecture change. openapi/openapi.yaml continues to be the only public contract, and follows the code-first process of submitting the file after the NestJS decorator is generated. Real LiveKit Cloud and streaming STT acceptance rely on external credentials, local avatars cannot be used as proof of production connectivity.

## Goals / Non-Goals

**Goals:**

- Continuously subscribe to agreed member tracks for explicitly enabled rooms without blocking the API request thread.
- Let consent, join, token issuance, media subscription and withdrawal converge to the same privacy boundary under failure and concurrency.
- Only convert temporary transcription into versioned and deduplicated minimum risk facts, and only remind the current room host when sending.
- Let worker, provider or coordination failures safely degrade human speech while exposing the contentless degradation fact to authorized administrative roles.
- Maintain the existing modular monolith, single database and single OpenAPI contract, and do not add new external microservices.

**Non-Goals:**

- Train or evaluate a general content review model, save corpus, review verbatim or provide room transcription.
- Allow media workers to have case handling, restriction, account disabling or room host management rights.
- Use this change to complete the client UI, backend UI, post-meeting keywords or personal vocabulary book.

## Decisions

### 1. Add an independent media worker entry in apps/api

Added worker bootstrap and combination root, reused the domain contracts of voice, rooms, and safety and the same Prisma schema, but deployed and expanded in independent processes. The API process only handles HTTP, persistent commands, and public contracts, and does not receive persistent audio. The worker joins the LiveKit room as a service participant, uses the minimum permissions that cannot publish the microphone, cannot perform room host management, and only subscribes to audio; the service participant does not create application membership, does not count room capacity, and does not appear in the product member list.

The worker periodically scans "open and enabled" rooms and uses Redis to obtain room leases with fencing tokens. There is only one active worker in the same room at any time; the old worker whose lease has expired must close the provider stream and leave the room. The session will be cleared when the room ends, the switch is closed (this design does not allow closing after creation), there are no members or the process stops. No new processing will be started when Redis is unavailable. Sessions that cannot be safely renewed will be stopped and downgraded. Human voice will continue.

**Alternative:**

- Subscribing to audio tracks within the HTTP API process: deployment, memory and restart lifecycles affect each other, rejected.
- Creating a new independent repository or a microservice with an independent database will introduce a second set of permissions and data consistency boundaries, which are not required at the current scale and are rejected.
- Putting audio chunks into BullMQ: will persist the original content in Redis/queue, violates the specification, rejects.

### 2. Isolate provider by media source and streaming STT port

The domain layer defines room media sources, streaming STT sessions, risk rules, and alert publishing ports. The LiveKit adapter only outputs the short PCM/encoding window in memory; the STT adapter only receives the current window, language prompts, short-term non-reversible identity associated identifiers, and controlled parameters. The provider configuration reuses the existing area, purpose, deletion capability and maximum seven-day retention policy, and adds "support streaming/short window" and security endpoint health check; when any policy field is missing, worker fail closed and room voice fail open.

provider implementation is replaceable, domain and public API do not expose provider name, only controlled categories. The audio window, complete transcription and hit fragment only exist in the worker memory scope, and any exception paths are cleaned up in finally; logs, spans, exceptions, queues and database DTOs all use contentless types to prevent mis-serialization.

**Alternative:**

- Multiplexing short audio HTTP upload adapter to emulate streaming: delay, backpressure and cancellation semantics mismatch, rejected.
- Handle complete transcription to subsequent asynchronous rule tasks: content must be persisted or passed between processes, rejected.

### 3. The room switch is set when it is created and is turned off by default.

Room adds a non-empty Boolean field sensitiveSpeechDetectionEnabled, which defaults to false. Both instant room and reservation room creation contracts can be submitted explicitly; the client side of history rows and unsubmitted fields are both false. List, details, sharing analysis and reservation details return this field so that users can determine the processing conditions before joining. Update the room interface not to expose this field to prevent the processing purpose from changing without the knowledge of the members who have joined.

In the first stage, it is not allowed to set true during creation until database migration, worker, provider policy configuration and access control are all deployed and pass the health check; then the service configuration is gradually increased. This operation and maintenance switch does not change the persistent intention of the room, but only controls whether to accept new enabled rooms.

**Alternative:**

- The room host switches on and off at any time during the meeting: all members need to re-confirm and reconnect. The boundaries are complex and it is easy to bypass consent and rejection.
- Enabled by default: Breaks existing client compatibility and explicit consent, Deny.

### 4. Add independent room security voice consent purpose

Add ROOM_SAFETY_DETECTION to the existing SpeechProcessingPurpose, and use different description versions and provider categories with AI_EXPRESSION_AUDIO. Existing status query returns two purposes; new PUT /v1/me/speech-processing-consents/room-safety to accept or withdraw, following UUID idempotent command and minimal audit fact. The status of one destination cannot authorize another destination.

Enable room joining transactions to read the currently valid consent before creating membership and issuing real-time credentials; token renewal is also verified repeatedly. Revoke saves the consent event in the same database transaction, invalidates the user's valid realtime issuance in the enabled room, and writes the existing realtime command/outbox. The runner disconnects users from these rooms and converges membership with CONSENT_WITHDRAWN; this reason does not enter security case, restriction, or penalty statistics. The worker reads the consent again before subscribing to a new track and receives a withdrawal notification for the active track; even if the runner is delayed, it first stops sending subsequent windows to the provider.

**Alternative:**

- Hide the join button only on the client side: can be bypassed, rejected.
- Allow members to continue speaking but not processing after withdrawing: Enabling the room will result in participants who do not meet the conditions for joint processing and are rejected.
- Record disconnect as room host removal or security penalty: distorted audit semantics, rejected.

### 5. Use versioned deterministic rules to generate minimal risk events

Temporary segments for STT are normalized in memory before being handed over to the versioned ruleset. The first version of the rule categories is aligned with the security business: HARASSMENT_ABUSE, HATE_DISCRIMINATION, SEXUAL_CONTENT, THREAT_VIOLENCE, SPAM_ADVERTISING and OTHER_SAFETY_RISK; only the severity levels LOW, MEDIUM and HIGH are used. The ruleset is published with an immutable version identifier, and rollback is accomplished by switching the active version.

Redis uses roomId, subjectUserId, category, ruleSetVersion and bucket summary keys for short window deduplication and token bucket frequency limiting; the keys do not contain text. PostgreSQL's RoomSpeechRiskEvent only saves the room, principal user, category, severity, rule version, first/last time, number of aggregations, irreversible association summary, and lifetime time. There is no sentence-by-sentence "miss" record; the original hit text, complete transcription, confidence original vector, and provider original response are not saved. Stop new judgments and log downgrades when Redis is unavailable, instead of bypassing post-deduplication flooding reminders.

Risk events are only viewable facts and do not invoke cases, restrictions, accounts or host-control commands. Room host will be subsequently removed or reported and the existing independent API, permissions and auditing will continue.

**Alternative:**

- Directly save the hit phrase for room host to judge: it will still form a searchable corpus and exceed the minimum boundary, so it is rejected.
- Automatically kick out high-severity members: False positives will directly result in penalties, violate manual decision boundaries, and are rejected.

### 6. Use persistent minimum outbox and LiveKit directed packets to remind the current room host

The risk event was written in the same transaction as RoomSpeechAlertDelivery. delivery only references the event and saves the status, number of attempts, next attempt time, lease and expiration time, and does not copy the voice content. The delivery runner reads the current room host and its current realtime identity from PostgreSQL before sending each time, and then sends the directed data packet through the server LiveKit; the room host cached when creating the event is never trusted. The old target lease expired after takeover.

The delivery period defaults to ten minutes and does not exceed the room end time. If failed, press bounded backoff to retry. After expiration, it will be recorded as undelivered; it will not be broadcast to other members. To handle offline and data packet non-persistent semantics, add GET /v1/rooms/{roomId}/safety-alerts. Only the current room host can read the minimum alerts still within the retention period by cursor. The alert retention time is consistent with the security risk fact policy, but the response still contains no content.

**Alternative:**

- Only data packets are sent: offline or reconnected, they will be silently lost and rejected.
- Broadcast to all members: Violation of "only remind room host", rejected.
- Fixed the original room host during delivery: leaked and rejected after taking over.

### 7. Merge continuous degradation events and provide background read-only query

SafetyCapabilityIncident Saves component, normalized error category, provider category, optional rooms, start/last observation/recovery time, number of impact windows and status. The component values ​​are MEDIA_SUBSCRIPTION, STREAMING_STT, RISK_RULES, COORDINATION, HOST_ALERT_DELIVERY. Consecutive failures for the same component, room, and error class are merged by a unique active key, and the event is closed on recovery; the exception text, provider response, or any speech content is not saved.

Added GET /v1/backoffice/safety-capability-incidents, allowing the current SAFETY_OFFICER, PLATFORM_ADMIN and AUDITOR to be queried with the keyset cursor with filter conditions. It is diagnostic and case context and does not provide disposition actions. OPERATIONS_ANALYST If you do not hold the above roles at the same time, you cannot read room-by-room events; in the future, anonymous statistics can only be viewed through independently approved aggregated indicator capabilities.

The case evidence repository adds risk events, degradation events or clear unavailability marks according to reporting rooms and controlled time windows. Query failure cannot be disguised as an empty collection; the evidence package returns signalAvailability to enable the safety officer to distinguish between "no hit", "capability degradation" and "not yet enabled".

### 8. Lifecycle, resources and backpressure boundaries

Set maximum concurrency window, window bytes/duration, silence timeout and total buffer cap per room, participant and provider session. Discard the oldest unsent window and log aggregate degradation when the limit is exceeded, without passing pressure back to the LiveKit audio publishing link. Room end, member leaving, consent withdrawal, worker fencing failure or shutdown signal must first cancel the provider stream, then release the buffer and leave the media room.

Worker health is divided into live and ready: the process is alive but not ready when Redis, PostgreSQL, LiveKit or provider policy does not meet the requirements and will not accept new leases. API readiness does not rely on workers or STT to ensure that real-person voice and other services are available; creating and enabling rooms is also subject to independent capability switches.

### 9. OpenAPI and wrong contracts

Continue to generate unique openapi/openapi.yaml by NestJS DTO/controller decorator. Public changes include:

- sensitiveSpeechDetectionEnabled for instant/reservation room creation requests, and fields of the same name for room list, details, sharing and reservation responses;
- Add ROOM_SAFETY_DETECTION to the consent status set, and add the room security consent command path;
- Did not agree to join or renew the use of stable ROOM_SPEECH_CONSENT_REQUIRED;
- Current room host minimum reminder query;
- Backend security capability downgrade query and filtering/cursor contract.

LiveKit data packet uses a versioned internal envelope and does not become a second HTTP API. Unknown envelope version ignored by client. After generation, it must be verified that the operationId, enumeration, required fields, error codes and sensitive fields are consistent with the implementation.

## Risks / Trade-offs

- **[False alarm causes room host to overreact]** → The reminder is marked for manual verification, the original hit text is not displayed, and automatic operation is not performed; room host behavior continues to be subject to existing permissions and audits.
- **[The withdrawal is concurrent with the audio window, causing it to still be sent after the withdrawal]** → Issue a high-priority stop command to withdraw the transaction. The worker checks the consent generation before sending each window; discards the memory window and closes the stream after the generation changes.
- **[Two workers duplicate subscriptions and reminders]** → Redis lease uses fencing token, database events are written with digest unique constraints, and all submissions verify the current token.
- **[LiveKit hiding participants affects capacity or UI]** → Use independent service identity namespace, do not create membership, list and capacity read-only application persistent state; Cloud smoke authentication client is not visible.
- **[Short-term correlation summaries can still be correlated across events]** → Each room/time bucket uses server-side rotation salt, and events only save irreversible summaries and clean up by retention tasks.
- **[provider statement and actual deletion behavior are inconsistent]** → Only providers approved by configuration are allowed; real smoke records area, mode and delete/retain no evidence, acceptance mark BLOCKED when proof is missing.
- **[Security downgrade event flooding database]** → Continuous fault merging, count aggregation, recovery closure and cleanup by policy.
- **[Enable rooms to be created even when workers are unhealthy]** → Check the capability switch and aggregation readiness when creating; fail open still preserves voice and generates degradation events due to failures during operation.
- **[Reservation room change has not been archived]** → Perform backward-compatible migration of the shared Room field; during implementation, the current reservation creation DTO will also be adapted to avoid missing the contract after waiting for the main spec to be synchronized.
- **[Real media and provider environment missing]** → Locally use contentless synthetic audio fixture to verify the state machine; Cloud/provider smoke single-column evidence, keep the task unfinished or explicitly BLOCKED when credentials are missing, without mocking.

## Migration Plan

1. Added backwards compatible enumerations and tables: Room.sensitiveSpeechDetectionEnabled uses false default value; added risk, delivery and degradation tables and indexes. Execute migration in the test library first, then run Prisma generate and structure/rollback check.
2. Deploy read-only compatible code, consent purposes, and OpenAPI; capability switch remains off. Old client and historical room behavior unchanged.
3. The worker and adapter are deployed, but the lease is not accepted when readiness fails. Authentication without persistent content, lease fencing, backpressure and sanitization using synthesized audio and native LiveKit/Avatars.
4. Deploy join/renewal access control, withdrawal convergence, risk events, current room host reminder, background query and evidence combination. Run complete unit, integration, e2e, runtime, dependencies and OpenSpec verification.
5. Use LiveKit Cloud with a qualified streaming STT provider to perform real smoke in an isolated environment: Hide participants, two people's voices are not affected, only remind the current room host, do not leak to the predecessor after taking over, stop immediately when withdrawing, only downgrade if the provider fails, no recording/complete transcription persistence.
6. After the evidence is passed, enable the configuration of "allow creation of enabled rooms" and gradually increase the volume; monitor worker readiness, event delay, degradation rate and reminder backlog, and do not collect content.

**Rollback：**

1. Turn off the new room enablement switch and stop workers from acquiring new leases.
2. Wait or forcefully cancel the existing provider stream to confirm the release of all memory buffers; the existing enabled room continues live voice and recording capabilities are disabled and downgraded.
3. Roll back API/worker code to compatible version. Database Boolean fields and new tables are retained first to avoid destroying historical rows and old binary reads.
4. Clear the outbox that contains no content to be delivered, and clean up the risk/degradation facts according to the retention policy. After confirming that recovery is not required, perform an independently approved destructive schema rollback in subsequent maintenance windows; evidence or audit facts must not be deleted in an emergency rollback.
5. If the convergence is withdrawn or the privacy boundary is defective, all room audio processing will be stopped first; the live voice service will not be offline accordingly.

## Verification Evidence

- **Contract**: Generate and diff openapi/openapi.yaml, verify compatibility with default values, agreed purpose, room host/background permissions, paging cursor and error code.
- **Migration**: Upgrade test of empty database and containing historical room/consent data, default shutdown, unique constraints, indexing and rollback drills.
- **Unit**: Agree to generation, join access control, rule version, deduplication and frequency limiting, fencing, back pressure, role matrix, log desensitization.
- **Integration**: PostgreSQL atomic writes, Redis lease/failure, withdraw outbox, current room host resolution, tri-state signaling for case evidence.
- **E2E**: Turn off room compatibility, enable room consent, withdraw disconnection, only query the current room host, take over isolation, no automatic punishment, background downgrade access.
- **Runtime**: Run an independent worker under real Redis/PostgreSQL, verify shutdown, recovery, repeated delivery and no content in the database/log.
- **Cloud/provider**: Double smoke of real LiveKit Cloud and qualified streaming STT; logs BLOCKED and missing items when credentials or platform configuration are missing.
- **Device**: Before client access, the supported physical device confirms pre-join consent, room host reminder, takeover and reconnection; this backend change only prepares the contract and cannot claim to have completed device acceptance.
