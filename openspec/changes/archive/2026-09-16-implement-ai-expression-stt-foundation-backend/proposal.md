## Why

The current front-end and back-end already have live voice rooms, membership and security restrictions, but there is still no expression assistance that can be actively called when the user is stuck, and there is also a lack of unified temporary voice processing boundaries for subsequent sensitive word recognition and post-meeting keywords. First establish the foundation of on-demand AI expression and replaceable STT, which can complete the AI ​​entrance of V1 without recording or blocking real people's voices, and provide reusable consent, quota and data deletion rules for subsequent room-level temporary identification.

## What Changes

- Added on-demand expression assistance in the room: currently active members can submit native language text and receive short English expressions, up to two alternative expressions, and tone descriptions that combine the room theme and their own CEFR.
- Added user-initiated native short voice input: the server receives temporary audio with an upper limit, obtains the text used only for this request through STT, and then calls expression generation; the audio and complete transcription are not written to the persistent storage.
- New voice processing consent record: short voice request requires currently valid processing consent and prompt confirmation for this processing; users can view and withdraw future processing consent, and the withdrawal does not forge the minimum audit fact of deletion that has been completed.
- Added replaceable AI and STT provider boundaries, enablement configuration, and stable failure semantics. When timeout occurs, the supplier is unavailable, the quota is exhausted, or STT fails, a result that can be retried/switched to text input is returned, without affecting existing rooms and real-person voices.
- Added request idempotent, per-user frequency limit, daily quota and platform-level budget gate. Replaying the same completed request by the same user with the same UUID will not deduct the credit or regenerate the results again, and changing the content reuse identifier will conflict; when the external call result is uncertain, the diagnosable state is retained without committing to exactly one execution on the supplier side.
- Only persist request status, input digest, size/duration, provider category, usage, error type, consent version, and short-term private output; do not log original text, original audio, full transcription, provider key, or full provider response. Short-term output is deleted by a resumable cleanup task after expiration.
- Extended NestJS code-first OpenAPI, Prisma migration, log masking, provider contract tests, real provider smoke entry and automated acceptance evidence.

### Confirmed Scope

- V1 expression assistance only serves valid members in the current `OPEN` room, and the target language is fixed to English; the room theme and user CEFR are read by the server and cannot be forged by the client.
- Both text and short voice messages must be initiated by the user. Output is returned only to the requesting user and is not automatically played, sent to other members, or used as live subtitles.
- Short voice calls are uploaded directly with size, type and processing time limit; only the data required to complete this request is transferred between the server and provider, and no room recording or playback objects are created.
- PostgreSQL saves idempotent, consent, usage and minimum status facts; Redis is only used for short-term frequency/concurrency coordination across instances, and Redis or provider failures cannot interrupt existing rooms.
- The default priority is to release audio and transcription immediately after processing is completed; any temporary provider data must not be older than one week. Short-term private output is reserved only for result replay, and has clear expiration time and cleanup evidence.

### Non-goals

- Does not subscribe to or identify room continuous audio streams, does not implement sensitive words, high-risk expression reminders or safety officer degradation events; these enter subsequent room safety identification changes.
- Does not generate post-meeting keywords, room summaries or personal wordbooks, nor does it automatically write the results into private notes.
- Does not implement AI automatic hosting, full-process error correction, real-time subtitles, speech synthesis, automatic playback, speaking on behalf of the user or sharing output with other members.
- Does not implement mobile recording/UI, production deployment, supplier procurement or privacy policy release.
- Does not long-term preserve original input, complete transcriptions, or create browsable AI history by default.

### Future Roadmap

- `implement-room-sensitive-speech-detection-backend` reuses temporary voice processing, consent and STT provider boundaries, and adds room-level risk signals and security capability degradation events that only alert the room host.
- `implement-post-room-keywords-vocabulary-backend` reuses temporary recognition results to generate anonymous room keywords, and adds a closed loop for users to choose to join, edit, delete and collect wordbooks.
- The operation and data governance change summarizes AI/STT costs, quotas, abnormal alarms and production retention/deletion certificates, and does not expand the content preservation scope of this change.

### Unresolved Decisions

- Final production AI/STT supplier, region, cross-border transfer and supplier-side deletion certificates still require platform configuration and privacy review. This change provides replaceable adapters and real smoke entries, but local tests without credentials cannot be counted as real provider acceptance.
- The user daily quota, platform budget and short-term private output retention period of the official public beta still need to be confirmed by operations; this change uses verifiable configuration and conservative default values, and does not write the default values ​​as permanent product commitments.

## Capabilities

### New Capabilities

- `ai-expression-assistance`: On-demand text/short voice expression assistance in the room, membership, private output, idempotent, quota and failure downgrade.
- `temporary-speech-processing`: Temporary audio processing consent, STT provider boundaries, data minimization, deletion deadlines, and fault isolation.

### Modified Capabilities

None.

## Impacted delivery stages

- Architecture
- Backend / API
- Test / Acceptance

## Impact

- `apps/api/prisma/`: Added enumerations, models, constraints, indexes and forward-only migration for expression requests, speech processing consent, usage/amount and cleanup status.
- `apps/api/src/modules/assistance/`: Added expression auxiliary application/domain, HTTP DTO/controller, Prisma repository, idempotent and quota coordination.
- `apps/api/src/infrastructure/ai/` and `apps/api/src/infrastructure/stt/`: Added configurable provider adapter, timeout, error normalization and test double; business module only relies on port.
- `apps/api/src/modules/rooms/`: Read the current room, membership, topic and CEFR context by exposing application boundaries, without changing the existing join or live voice flow.
- `apps/api/src/infrastructure/redis/` with cleanup workers: Increase distributed frequency/concurrency limits and recoverable short-term output cleanup scheduling; PostgreSQL maintains a persistent source of truth.
- `apps/api/src/config/`, log desensitization and `openapi/openapi.yaml`: add enable switch, provider/limit/reservation configuration, multipart contract and stable error code.
- Local automation uses fake provider; real AI/STT smoke relies on user-provided enabling configuration and credentials, and separately records whether to execute.
