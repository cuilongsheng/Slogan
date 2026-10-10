## Why

Live rooms already provide authentication, admission, capacity, and persistent membership, but not LiveKit credentials, trusted presence, and resumable real-time cleanup capabilities. First establish a real-time foundation, and then use independent `implement-host-controls-backend` to access member life cycle and room host management to facilitate separate review and verification.

## What Changes

- Issues short-lived, room-limited and opaque identity LiveKit Cloud tokens to eligible existing members, allowing subscription and microphone publishing only.
- Provides current member query and presence projection, receives the LiveKit webhook after signature verification, and prevents repeated and late events from overwriting the current authorization facts.
- Build LiveKit token, room, participant, webhook adapter, as well as PostgreSQL auditing, event idempotent and durable command/outbox.
- Introduce Redis/BullMQ's retry, expiration scheduling and startup/period reconciliation; when the room reaches `endsAt`, it is immediately prohibited from joining/issuing certificates, and the cleanup is completed by revoking the identity and deleting the provider room, without setting a grace.
- Provides reusable end/cancellation basic capabilities for subsequent room host management calls; the end trigger of this change comes from the expired or verified provider room-finished.

### Confirmed Scope

- Implement the backend real-time foundation and expiration end of current `voice-session`, as well as real-time credentials, connection event auditing and corresponding server permissions in `basic-safety-reporting`.
- Using LiveKit Cloud; opaque identity does not contain personal data. Cloud's cancellation behavior follows the original design goal and must be verified with real provider smoke.
- PostgreSQL saves authorization, presence observations, events and commands to be executed; Redis only does task coordination. NestJS code-first generates unique `openapi/openapi.yaml`.
- This change only adds three new endpoints: realtime-credentials, members, and webhooks/livekit. The qualification/capacity rules of the existing join are retained and the access expiration status is consistent.
- The follow-up `implement-host-controls-backend` relies on the public application API, provider adapter, queue, audit/outbox and end state machine of this change. Room host management and front-end/equipment acceptance are required before the complete voice room is released; this basic stage is only for controlled integration verification.

### Non-goals

- Members' active leave/rejoin, REMOVED/INVITED status, kicked out and re-invited, room host exit handover, 60-second room host disconnection window, new joins suspended within the window, and host end endpoint are all handed over to `implement-host-controls-backend`.
- Does not implement mobile LiveKit client, default silent UI, selectors, device permissions, Figma or generated frontend client.
- Do not implement recording, complete transcription, STT, public playback, reporting or safety officer punishment; do not perform production deployment and console configuration.
- Revocation semantics for self-hosted providers without separate validation are not supported.

### Future Roadmap

- The next step is to implement `implement-host-controls-backend` according to independent change, and then promote `implement-safety-reporting-backend`.
- Front-end and real dual-device acceptance, release environment smoke and deployment records follow the subsequent delivery work respectively.

### Unresolved Decisions

- There are currently no product decisions blocking this split. The originally confirmed room will be retained here without grace upon expiration; the requirement text for ordinary members to re-enter the last position and room host disconnection window behavior will be moved into the room host management change as a whole, and these decisions will not be revoked.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `voice-session`: End immediately when the specified room reaches the specified `endsAt`, disconnect and reject the old voucher without setting a grace period. delta retains the existing "room host ends the room" scenario; its active trigger entry is implemented by subsequent room host management, and only the reuse basis and expiration triggers are delivered here.

## Impact

- Impacted delivery stages: Architecture、Backend / API、Test / Acceptance。
- Affects `apps/api/src/modules/voice`, `rooms` public application API, `infrastructure/livekit`, Redis/BullMQ, Prisma models/migrations and API testing.
- Added `livekit-server-sdk`, `ioredis`, `bullmq` and conditional environment configuration; only retain the fields, status and migration required for real-time basis, room host deadline and member departure/removal lifecycle are migrated separately by the next change.
- The original 34 mixed tasks were re-split according to the ownership of the two changes, and the unexecuted tasks continue to remain unfinished; the current main specs and historical PRD will not be rewritten in this split.
