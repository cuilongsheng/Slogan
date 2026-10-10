## 1. Data model and migration

- [x] 1.1 Add a sensitiveSpeechDetectionEnabled field that is turned off by default and is immutable after creation for Room, and verify that all old rows are false through a migration test containing historical room data
- [x] 1.2 Add Prisma enumerations for ROOM_SAFETY_DETECTION consent purpose, risk category, severity, delivery status, degraded component and event status, and validate schema can be generated via Prisma validate/generate
- [x] 1.3 Added RoomSpeechRiskEvent, RoomSpeechAlertDelivery and SafetyCapabilityIncident models and necessary unique constraints, foreign keys and keyset indexes, and verified them through empty library migration and structural integration testing
- [x] 1.4 Add the retention/cleaning repository operation of risk, reminder and downgrade facts, verify that the cleaning test only deletes data that exceeds the policy period and does not touch the case and audit facts
- [x] 1.5 Write migration rollback instructions and emergency steps to retain newly added compatible columns/tables, and verify that the document contains the order of stopping workers, releasing streams, and prohibiting emergency deletion evidence

## 2. Room contract and ability switch

- [x] 2.1 Extend instant room and reservation room creation DTO, domain entity and repository mapping, verify that the creation result is false when the switch is not submitted, and persistence is true when explicitly enabled
- [x] 2.2 Return sensitive speech recognition status in instant list, details, sharing parsing, appointment details and presenter, and verify the API response of closing and enabling rooms
- [x] 2.3 Added the server-side capability switch and aggregated readiness access control that allow creation of rooms, reject true when verification is turned off or the dependency is unhealthy, and still allow false
- [x] 2.4 Prevent any update path from modifying this switch after creation, verify that neither direct DTO requests nor concurrent updates to the repository can change the persistent value
- [x] 2.5 Regenerate openapi/openapi.yaml, verify that the room request is compatible by default, the response required fields and the reservation/instant contract are consistent with the code

## 3. Target-level agreement and join convergence

- [x] 3.1 Change the consent repository and status query to isolate them by purpose and noticeVersion, and verify that AI_EXPRESSION_AUDIO and ROOM_SAFETY_DETECTION do not authorize each other
- [x] 3.2 Add room security consent acceptance/withdrawal API, UUID idempotent and stable error semantics, verify that the same retry returns the original result, and changes the payload conflict
- [x] 3.3 Verify current consent before enabling room joining and realtime token renewal, do not create new membership/issuance when validation is missing, expired or withdrawn
- [x] 3.4 Implement issuance invalidation and realtime command/outbox within the withdraw transaction, verify that active members are disconnected with CONSENT_WITHDRAWN and do not generate reports, cases or restrictions
- [x] 3.5 Add consent generation verification for withdrawing and sending audio windows, discard the memory window and stop the provider stream after verifying the generation change
- [x] 3.6 update consent and joining OpenAPI, the verification status set contains two purposes, room security command path and ROOM_SPEECH_CONSENT_REQUIRED

## 4. Independent media workers and leases

- [x] 4.1 Add independent room-speech worker bootstrap, configuration and startup scripts in apps/api to verify that API and worker can be started separately and API readiness does not depend on worker
- [x] 4.2 Define room media source, streaming STT session, risk rules, lease and reminder publishing port, verify dependency rules prohibit domain layer from importing LiveKit/provider implementation
- [x] 4.3 implements open room scanning and Redis fencing lease, verifies that concurrent workers have only one valid holder, and old tokens cannot submit events.
- [x] 4.4 Implement the joining, audio track subscription, leaving and minimum permissions of LiveKit service participants, verify that it does not create membership, does not count capacity, and cannot publish microphones or perform room host management
- [x] 4.5 Implement the cancellation/cleanup sequence of room end, member departure, withdrawal, lease expiration and shutdown, and verify that the provider stream, buffer and media connection are all released
- [x] 4.6 adds worker live/ready health check and fail-closed behavior when there are no dependencies, and does not obtain new leases when verifying that Redis, PostgreSQL, LiveKit or provider is unhealthy.

## 5. Streaming STT and memory data boundaries

- [x] 5.1 Extend the STT provider policy configuration to declare streaming capabilities, regions, usage, deletion/no retention and up to seven days of retention. When verification is missing or exceeds the limit, the worker will reject ready and the key will not be exposed.
- [x] 5.2 implements a replaceable streaming STT adapter with a short-lived anonymous association identifier, verifying that provider requests do not include names, contact information, room passwords, other member information, or LiveKit credentials
- [x] 5.3 Implement the upper limit of windows, buffering, concurrency and mute for each room/member/session. If the limit is exceeded, only the pending window will be discarded and aggregate degradation will occur, without back-pressure of real voice.
- [x] 5.4 Audit all audio/transcription data paths and types, verify that PostgreSQL, Redis, BullMQ, object storage, logs, spans, exceptions and fixture output cannot recover content
- [x] 5.5 Write temporary content cleanup tests for success, failure, timeout, cancellation and process shutdown, verify that there is no audio/full transcript that can be read or restored after each path

## 6. Risk rules, deduplication and minimum facts

- [x] 6.1 Implement immutable version identification risk rule sets, controlled categories and LOW/MEDIUM/HIGH severity mapping, and verify that the classification and version results of fixed fixtures are stable
- [x] 6.2 Implement normalized, irreversible summary and risk event creation without text, verify that database records only contain room, subject, category, gear, rule version, time and aggregate count
- [x] 6.3 Implement Redis deduplication window and token bucket frequency limiting to verify that repeated hits in the same room/member/category are aggregated and that different subjects or categories do not contaminate each other.
- [x] 6.4 Stop new risk judgments and create merged downgrades when Redis deduplication is unavailable, and verify that frequency limiting or automatic triggering of disposals will not be bypassed
- [x] 6.5 adds unit and integration tests that prohibit risk events from calling host control, case conclusion, restriction or account status modification, and verifies that HIGH signals only generate minimal facts and reminders

## 7. Current room host reminder and takeover isolation

- [x] 7.1 Write the minimum reminder outbox in the risk event transaction, verify that the retry does not repeat the risk event and the delivery does not copy the voice or transcribe the content
- [x] 7.2 implements the LiveKit directed data packet adapter that parses the current room host and realtime identity before each sending, and verifies that ordinary members and previous room hosts cannot receive reminders
- [x] 7.3 Achieve bounded backoff, lease and expiration convergence of ten minutes and no more than the room end time, and verify the stable results of offline retry, repeated runner and permanent failure
- [x] 7.4 Add the current room host safety-alerts keyset query API to verify that only the new room host can read the minimum reminder that is still in the retention period after taking over.
- [x] 7.5 Write room host takeover and reminder concurrent tests to verify that the old target delivery fails and the latest room host receives at most one identifiable reminder and no broadcast

## 8. Downgrade, background inquiry and case evidence

- [x] 8.1 Implement SafetyCapabilityIncident that is merged by room, component and error category to open/update/restore the state machine to verify that continuous faults are not flooded and the recovery time can be queried
- [x] 8.2 Access to normalized downgrade reporting of media subscriptions, streaming STT, rules, coordination and reminder delivery, verify that events do not contain abnormal original text, provider response or voice content
- [x] 8.3 adds background degradation event filtering and keyset query API, verifies that SAFETY_OFFICER, PLATFORM_ADMIN, and AUDITOR are readable, and ordinary users and individual OPERATIONS_ANALYST are rejected
- [x] 8.4 Expand the risk and degradation facts of the relevant time window of the case evidence package combination, verify and distinguish between no hits, capability degradation and not enabled, and do not return the original hit text
- [x] 8.5 updates OpenAPI’s room host reminder and backend downgrade contract to verify that the role description, filter conditions, cursor, enumeration and minimum response fields are accurate

## 9. Testing, operational evidence and acceptance

- [x] 9.1 Complete unit/integration/e2e tests for room switches, consent access, withdrawal, lease, stream cleanup, rules, reminders, takeover, demotion and evidence, and verify that all target tests pass
- [x] 9.2 Run API and independent worker runtime tests on real PostgreSQL and Redis to verify fencing, restart recovery, shutdown, cleanup and database/log empty content
- [x] 9.3 Run format, Prisma validate/generate, OpenAPI generate diff, dependency boundary, complete unit/integration/e2e/runtime and openspec validate --strict, and log commands, quantities and results
- [x] 9.4 Write docs/acceptance/implement-room-sensitive-speech-detection-backend.md and verify that local implementation, real environment proof, privacy check, migration/rollback and all BLOCKED items are recorded respectively
- [ ] 9.5 Use real LiveKit Cloud and qualified streaming STT provider to perform double smoke, verify hidden workers, real voice is not interrupted, only remind the current room host, take over isolation, withdraw stop and provider failure downgrade; record BLOCKED when credentials are missing and keep this task unfinished
- [ ] 9.6 Agree, room host reminder, reconnection and takeover acceptance before the supported physical device completes the joining, and verify that it is consistent with OpenAPI/internal envelope; record BLOCKED when the client has not yet connected and keep this task unfinished
