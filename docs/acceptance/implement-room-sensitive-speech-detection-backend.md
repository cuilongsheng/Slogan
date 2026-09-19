# implement-room-sensitive-speech-detection-backend acceptance

## Baseline and result

- Date: 2026-09-17. The implementation and verification are local and are not deployed.
- Revision: `2687b1a30c90ee1b4abe5a768e28822153922b04` on `develop`. The checkout already contains other uncommitted OpenSpec deliveries, so this revision is only the implementation baseline.
- Runtime: Node.js 24.21.0 and pnpm 12.3.4.
- Local implementation covers the room contract, purpose-specific consent, worker process, Redis fencing/readiness, temporary short-window STT boundary, deterministic risk rules, current-host alert delivery/query, capability incidents, evidence composition, retention and generated OpenAPI.

## Room, consent and access boundary

- `sensitiveSpeechDetectionEnabled` defaults to `false`, is written only during instant or appointment room creation, and is projected by room list/detail/share and appointment responses. No update route accepts the field.
- Creating an enabled room requires the server capability flag, a fresh worker readiness heartbeat in Redis and current `ROOM_SAFETY_DETECTION` consent. Joining or renewing realtime access repeats the purpose-specific consent check.
- Room safety consent is isolated from `AI_EXPRESSION_AUDIO`. Revocation is append-only and idempotent, invalidates active realtime identities, writes durable revoke commands and disconnects active memberships with `CONSENT_WITHDRAWN`. It does not create a report, case, restriction or account penalty.
- The worker checks consent immediately before provider processing and again after the provider returns. A changed consent generation discards the result. Track unsubscribe/disconnect clears pending participant buffers.

## Worker, privacy and degradation

- `start:room-speech-worker` starts a separate Nest application context. The HTTP API does not subscribe to room audio and its readiness does not depend on the worker.
- The worker uses a hidden, subscribe-only LiveKit service participant. Its token cannot publish audio/data, update metadata, administer rooms, create/list rooms or record. It creates no application membership and does not affect persisted capacity.
- Redis grants one room lease with an opaque fencing token. Renewal and release use compare-and-expire/delete scripts. A stale token cannot renew or release a replacement lease, and the service renews immediately before writing a risk fact.
- Worker readiness checks PostgreSQL discovery, Redis, LiveKit control-plane access and the configured STT model endpoint before accepting leases. A 15-second Redis heartbeat gates creation of new enabled rooms. Dependency failure closes active media sessions, stops new leases and records a content-free degradation while normal room voice remains independent.
- PCM and its generated WAV provider copy exist only in process memory and are zeroed on success, failure and shutdown. Full transcript variables are cleared after classification. Audio, transcript, raw transcript, segments and provider responses are redacted from structured logs. PostgreSQL, Redis and delivery payloads contain no recoverable speech content.
- The provider policy requires `REQUEST_PROCESSING_ONLY`, an explicit no-retention/delete mode, retention no longer than seven days, region and `SHORT_WINDOW` streaming mode. Local tests use a fake provider; they do not prove an external provider's actual retention behavior.

## Risk, alert and evidence behavior

- The versioned deterministic rule set emits controlled category and LOW/MEDIUM/HIGH severity values. PostgreSQL stores room, subject, category, severity, rule version, server times, aggregate count and an HMAC correlation hash only.
- Redis uses content-free hash keys for bounded duplicate suppression. Coordination failure stops new risk decisions and opens or merges a capability incident.
- A risk event and one content-free delivery row commit atomically. Delivery resolves the current host's active realtime identity and sends a reliable targeted LiveKit data packet; it never broadcasts. The current host can also query retained minimal alerts by keyset cursor. Former hosts and ordinary members are rejected.
- Risk signals never call host controls, create or advance cases, create restrictions or alter account state. Existing manual host and safety workflows remain separate.
- Capability incidents merge by room/component/error category, retain affected-window counts and close with a recovery timestamp. Platform administrators, safety officers and auditors can query them; operations analysts and ordinary users cannot.
- Safety evidence distinguishes `NOT_ENABLED`, `DEGRADED` and `AVAILABLE`, and includes only bounded risk and incident facts around the report window. It contains no speech content.

## Migration, retention and rollback

- Migration `20260916010000_room_sensitive_speech_detection` adds the default-false room column, controlled enums, risk events, delivery outbox and capability incidents. Isolated migration tests cover empty and historical schemas and prove old room rows remain disabled.
- Retention removes only expired delivered/expired outbox rows, expired risk facts and recovered incidents. Integration evidence proves current facts, safety cases and backoffice audit events remain intact.
- Rollback order: disable creation of enabled rooms; stop the worker from taking new leases; cancel provider work; zero in-memory buffers; disconnect hidden LiveKit participants; release leases; then roll back API/worker binaries. Keep the additive column, tables, cases and audit evidence for a forward fix. Do not perform destructive evidence deletion during an emergency rollback.

## Local verification

- Prisma generate and the migration chain passed against PostgreSQL 17.6.
- Final API verification passed: unit 26 suites / 161 tests, integration 25 suites / 156 tests, HTTP E2E 12 suites / 68 tests; 63 suites / 385 tests. Lint, typecheck, build, migration deploy and OpenAPI drift checks also passed.
- The complete runtime set passed: 5 suites / 7 tests. Together, local API and runtime verification covered 68 suites / 392 tests. A follow-up `--detectOpenHandles` run traced a native LiveKit FFI handle to eager module loading; the adapter now loads the RTC client only when a real media connection starts, and the dedicated worker runtime exits without an open handle.
- The suites cover default compatibility, consent isolation/revocation, readiness gating, risk classification, content cleanup, duplicate suppression, current-host isolation, role permissions, degradation merge/recovery, evidence composition and retention.
- The dedicated real PostgreSQL/Redis runtime starts the independent worker, rejects a competing worker, processes a synthetic in-memory frame, zeroes both PCM and WAV copies, targets the current host, releases its lease on shutdown and reacquires the room after restart.
- `openapi/openapi.yaml` is generated from the NestJS contract and remains the only public API contract.
- `pnpm deps:check` passed with 331 modules / 1324 dependencies and zero dependency violations.

## External acceptance boundary

- **BLOCKED — LiveKit Cloud and qualified STT provider:** no repository environment contains usable LiveKit Cloud or approved STT provider credentials/policy evidence. The required two-person smoke for hidden participation, uninterrupted human voice, current-host-only alerting, host takeover, immediate consent withdrawal and provider degradation has not run.
- **BLOCKED — supported device:** the mobile client has not integrated the consent and alert envelope, so real-device join, reconnect, host takeover and alert acceptance has not run.
- Local fakes, synthetic audio and control-plane unit tests are not production connectivity, provider deletion, latency or device proof. These two tasks remain unchecked.
