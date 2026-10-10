## Why

The current front-end already has temporary room voice processing and private post-meeting notes, but there is still no automatic keyword summary without member attribution after the room is over, and there is no closed loop that allows users to precipitate valuable vocabulary into personal learning materials. V1 needs to complete the back-end capabilities of "Post-meeting summary → Opt-in → Personal maintenance" without saving recordings, complete transcriptions, or other members' private expressions.

## What Changes

- Add a post-meeting keyword switch that is clearly selected when creating and is immutable after creation for instant rooms and reserved rooms; the existing client remains closed when it is not submitted, and the status is displayed in the list, details, sharing analysis and pre-joining information.
- Add independent post-meeting keyword voice processing consent purpose and version verification. Enabling a room only allows members with current consent to join or renew; withdrawing will stop the member's subsequent processing and restrict his real-time access, but will not result in reporting, restrictions or penalties.
- Expand the independent room voice worker so that a temporary STT window can press the room switch to enter security rules and anonymous keyword candidate extraction respectively; security risk events cannot be reversely restored or reused as learning content.
- Only temporarily maintain keyword/short expression candidates with no membership, no word order, and an upper limit during the session; generate a persistent room-level summary after the room ends, and immediately delete the temporary audio, full transcription, and candidate working sets.
- Add participant summary query after meeting. The response only contains the room theme, generation status, keywords and common expressions; users who only make reservations, have not actually checked into the room, or have no relationship cannot read it.
- Add a personal vocabulary book: users can add entries from the room summary that can be read by themselves, view, edit, delete and collect them in pages; personal entries are only owned by the current user and are not disclosed to the room host or other members.
- When STT, candidate extraction, Redis temporary aggregation or post-end generation fails, the aggregation will be converged to a stable and unavailable state, without blocking the end room, not affecting the real person's voice, and not reprocessing the audio during the failure.
- Extended OpenAPI, PostgreSQL migrations, ad-hoc data cleaning, log masking, and local acceptance evidence; the real LiveKit Cloud and STT provider processes remain as acceptance items that must be performed separately.

### Confirmed Scope

- The target language is fixed to English; the final summary contains room themes, keywords after deduplication, and short expressions, but does not include members, speaking time, sentence-by-sentence order, or complete original sentences.
- The room host decides whether to enable post-meeting keywords when creating the room. The selection will be immutable after creation. Rooms that are not enabled do not subscribe to audio for this purpose and do not require consent for this purpose.
- Intra-session candidates only exist as a temporary working set with a limited TTL and do not carry userId, membershipId, participant identity, or sequence information that can restore the complete conversation; PostgreSQL only saves the final summary, generation status, and personally saved wordbook entries.
- Only users who have actually participated and the room has ended can read the shared summary and add words from it; actual members who have been removed or left early still retain the ability to read after the meeting, and only making an appointment does not count as participation.
- This word entry is copied from the room summary and becomes the user's private content; subsequent editing, collection or deletion will not modify the shared room summary, nor will it affect other users.

### Non-goals

- Does not save, playback, search, or export full room recordings, full transcriptions, line-by-line subtitles, or expressive recordings with member attributions.
- Do not generate learning content from security risk incidents, reports, case evidence or room host reminders, nor summarize keywords for punishment, user portraits or public rankings.
- Users' manual addition of room-level summaries is not implemented; this behavior is still pending in the frozen PRD, and the personal vocabulary book only accepts summary selections and subsequent personal editing.
- Does not implement automatic definition, example sentence generation, spaced repetition, quizzes, cross-user sharing, dictionary search or wordbook export.
- Do not develop mobile pages, automatic jumps after meetings, or front-end interactions in this change.

### Roadmap Items

- Automatic paraphrasing, example sentences, review plans, import and export, and more complete post-session reviews require independent OpenSpec approval.
- Operational metrics, generation cost aggregation, production alerts, and cross-environment retention proofs are the responsibility of subsequent data governance changes.

### Unresolved Decisions

- The final production of STT providers, regions, cross-border transfers and deletion certificates still rely on platform configuration and privacy review. This change reuses the existing replaceable provider boundaries and retains the real environment smoke. It does not count fake providers or local tests as production proof.

## Capabilities

### New Capabilities

- `post-room-keyword-summaries`: Defines enable on room creation, independent consent, anonymous temporary candidates, generation after end, participant query, failure degradation, and privacy boundaries.
- `personal-vocabulary`: Define the user's behavior of adding, paging, editing, deleting and collecting private wordbook content from the user's readable summary.

### Modified Capabilities

- `instant-room-discovery`: Room creation, list, details and sharing information have been added with post-meeting keyword switches that are turned off by default and are immutable after creation.
- `temporary-speech-processing`: Add independent post-meeting keyword processing purpose, and extend temporary data, provider policy, failure isolation and withdrawal boundaries to anonymous post-meeting summary.
- `voice-session`: Allow explicitly enabled and consented rooms to temporarily process short audio windows for post-meeting rollups while continuing to disable recording and full transcription.

## Impacted delivery stages

- Architecture
- Backend / API
- Test / Acceptance

## Impact

- `apps/api/prisma/`: Room switches, post-meeting summary status/entries, personal wordbook, consent purposes, idempotent commands and index migration.
- `apps/api/src/modules/rooms/`, the new post-meeting summary/wordbook business module: creating and joining access control, participation qualifications, summary reading, personal entry commands and ownership verification.
- `apps/api/src/workers/room-speech/` and `speech-safety/`: Extend existing single-purpose processing orchestration into temporary windows distributed on purpose, maintaining persistent factual isolation of security rules and learning content.
- `apps/api/src/infrastructure/stt/`, `redis/`: reuse the streaming STT adapter, add bounded temporary candidate aggregation without member ownership, fencing, TTL and failure cleanup.
- `openapi/openapi.yaml`: Room switch, post-meeting summary, agreement status and personal words of this contract.
- External dependencies: PostgreSQL, Redis, LiveKit Cloud, and streaming STT provider that meet the maximum seven-day policy.
- Dependency boundary: This change relies on the local worker/STT foundation that `implement-room-sensitive-speech-detection-backend` has completed; its real Cloud/provider smoke has not yet been completed, so the similar real-life experimental acceptance of this change must also remain independent and unfinished, which cannot prevent local development but will prevent archiving.
