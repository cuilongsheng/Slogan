## Why

Currently, the live voice room does not have sensitive expression recognition, room host risk reminders or security capability degradation records. The room host can only rely on manual reporting afterwards. V1 needs to provide downgradeable and auditable temporary voice security assistance for rooms that explicitly enable this capability without recording, saving full transcripts, or automatically penalizing them.

## What Changes

- Add a sensitive speech recognition switch for rooms that is explicitly selected at creation and immutable thereafter; existing clients that do not submit this field remain closed.
- Add independent room voice processing consent purpose and version verification for rooms that enable this capability; those who do not agree cannot join. Withdrawing consent will stop its subsequent processing and terminate its real-time access in the room, but it will not cause a security penalty.
- Adds a room voice processing worker that shares the domain model with the API code but runs as a separate process to ad hoc process consented members' audio via replaceable media sources and streaming STT ports.
- Add versioned risk rules, deduplication and frequency limiting, and only send minimal risk reminders to the current room host; reminders do not include original audio or complete transcriptions, and will not automatically kick people, initiate cases, limit or disable accounts.
- Save the allowable minimum risk events and safety capability degradation events for the safety officer to query and reference in the relevant case evidence package; it is clear that missing signals do not equal a safety conclusion.
- Keep LiveKit human voices, room status, and membership available when STT, worker, reminder delivery, or coordination fails, and log downgrade facts without content.
- Extended OpenAPI, PostgreSQL migration, cleanup strategy, observation information and local verification; real LiveKit Cloud and streaming STT provider smoke require corresponding credentials and test environment, which cannot be replaced by local.

### Confirmed Scope

- Both instant rooms and reserved rooms using the same room entity can be enabled or disabled when creating.
- Only handles live microphone audio from currently consenting members in the enabled room.
- Risk events only retain the minimum category, subject, time, rule version, source and processing status, and the original hit text is not saved.

### Non-goals

- Does not record the room and does not provide playback or full transcription.
- Does not perform speech content search, user profiling, model training, sentiment scoring or public risk rankings.
- Do not automatically punish, automatically close cases or automatically remove members based on keywords or model results.
- No front-end interface, client-side audio processing, or new backend management front-end will be developed in this change.

### Roadmap Items

- The multi-language risk model assessment, manual annotation platform and rule operation interface will be constructed after obtaining independent OpenSpec approval.
- Keywords and personal vocabulary after the anonymous meeting are the responsibility of subsequent independent changes, and security risk event restoration content cannot be reused.

### Unresolved Decisions

- None. The specific provider and LiveKit media access package are implemented through port adaptation, but the privacy, retention, and failure boundaries of this change must be met.

## Capabilities

### New Capabilities

- `room-sensitive-speech-detection`: Define the complete behavior of room enablement, room entry consent, temporary streaming identification, room host only risk reminder, minimal events, downgrade query and prohibition of automatic penalties.

### Modified Capabilities

- `instant-room-discovery`: Add sensitive voice recognition switch and consent access control to room creation, list, details and joining qualifications.
- `temporary-speech-processing`: Extend destination-level consent, streaming STT, data minimization, provider policies, and fault isolation to cover room-level ad hoc processing.
- `voice-session`: Allow explicitly enabled rooms to perform temporary sensitive expression recognition while maintaining no recording and no complete transcription.
- `safety-case-management`: The case evidence package can combine relevant minimal risk events and security capability degradation events, while making it clear that these signals can only assist manual review.

## Impact

- `apps/api/prisma/`: Migration required for room switches, voice processing purposes, minimal risk events, degradation events, and reliable alert delivery.
- `apps/api/src/modules/rooms/`, `voice/`, `safety/`, `backoffice/`: creating and joining access control, current room host resolution, risk query, evidence combination and role authorization.
- `apps/api/src/infrastructure/stt/`, `livekit/`, `redis/`: streaming STT, media subscription, deduplication and frequency limiting, worker coordination and downgrade.
- `apps/api/src/workers/`: The room voice processing process is started independently; no external microservices or second API contract are added.
- `openapi/openapi.yaml`: Room configuration/details, consent management and safety officer downgrade query contract.
- External dependencies: LiveKit Cloud media connection, streaming STT provider with maximum seven-day policy, PostgreSQL, and Redis.
- Dependency boundary: This change reuses the archived AI/STT privacy foundation; true end-to-end acceptance relies on `implement-livekit-voice-session-backend`’s Cloud smoke environment.
