## 1. Schema, configuration and migration

- [x] 1.1 Add Prisma enumerations for `POST_ROOM_KEYWORDS` consent purpose, summary/entry/task status and wordbook entry types, and verify that the schema can be generated through Prisma validate/generate
- [x] 1.2 Add the default false `postRoomKeywordsEnabled` to Room, add RoomKeywordSummary, RoomKeywordSummaryItem, RoomKeywordSummaryJob, VocabularyItem and VocabularyCommand models and unique constraints/indexes, and verify the relationship and keyset index through structural integration testing
- [x] 1.3 Write forward-only migration and room switch immutable triggers, use the migration test with historical Room to verify that all old rows are false, and direct SQL updates after creation are also rejected
- [x] 1.4 Added keywords feature flag, notice/extractor version, candidate upper limit, TTL, job lease/deadline configuration, and verified that the old API/worker can be started when shut down, started when enabled but with missing dependencies, or readiness fails safely without exposing configuration values
- [x] 1.5 Define domain entities/ports for summary, candidate, vocabulary, job and destination level processing, run dependency boundary checks to verify domain does not import Prisma, Redis, LiveKit, NestJS or transport DTO
- [x] 1.6 Write the deployment and rollback sequence in the acceptance document. The verification includes first closing the new creation, converging the job, stopping the consumer, retaining the newly added table/user content and cleaning up the temporary keys.

## 2. Room switch agrees with destination level

- [x] 2.1 Expand instant and appointment creation DTO, domain entity and Prisma mapping, persist false when verifying that the post-meeting keyword field is not submitted, persist true when explicitly enabled
- [x] 2.2 Return `postRoomKeywordsEnabled` in instant list, details, share parsing, appointment details and presenter, verify the response of closing and enabling the room without changing the existing paging/visibility
- [x] 2.3 Reuse the shared worker readiness and add the keyword feature gate. When verifying that the dependency is unhealthy, the creation of enabled rooms is refused but the creation of disabled rooms is still allowed.
- [x] 2.4 Added `POST_ROOM_KEYWORDS` consent status and accept/withdraw command to verify that the three purposes do not authorize each other, the notice version update is invalid, the same UUID retries idempotent and the change payload conflicts
- [x] 2.5 Change join, reserve/confirm and realtime token renewal to calculate the required purpose set of the room, verify the consent matrix of only security, only keywords, both on and all off
- [x] 2.6 Implement issuance invalidation, membership convergence and reliable `REVOKE_IDENTITY` command for keyword consent withdrawal, verify that subsequent processing stops and no reports, cases, restrictions or account status changes are generated

## 3. Neutral room voice processing arrangement

- [x] 3.1 Establish room-speech-processing application boundaries and migrate media discovery, STT session, purpose context and cleanup responsibilities, verify that existing APIs and independent workers can still be started separately
- [x] 3.2 Change the active room discovery to OPEN room that enables the voice purpose of any room, and verify that only one media session is created for security-only, keyword-only, and dual-open rooms.
- [x] 3.3 Implement each short window to only call STT once and synchronously fan out to the enabled consumer. Verify that the double-open room will not generate a second hidden participant or a second provider call.
- [x] 3.4 Verify the consent generation of all required purposes before and after STT. If any purpose withdrawal or version change is verified, the window will be discarded, the session will be canceled, and the consumer result will not be submitted.
- [x] 3.5 Failure to isolate safety and post-room consumer, failure to verify risk rules does not block qualified keyword candidates, failure to extract candidates does not block existing risk events and room host reminders
- [x] 3.6 covers member departure, withdrawal, room end, lease loss, provider failure and shutdown cleanup sequence, verify that audio buffer, full transcription and provider session are not readable in each path
- [x] 3.7 Run the existing speech-safety unit/integration/e2e/runtime regression to verify that risk deduplication, current room host reminders, downgrades and evidence package behavior remain unchanged

## 4. Anonymous candidate extraction and temporary aggregation

- [x] 4.1 Implement versioned English keyword and short expression extraction policy, verify stable results of case/Unicode/punctuation normalization, stop words, token/character upper limit and fixed fixtures
- [x] 4.2 Implement double filtering of contact information, over-long original sentences and content that cannot be safely separated from the context, and verify that candidates, logs, exceptions and test snapshots do not contain rejected original texts
- [x] 4.3 Implement candidate consumers that do not receive member IDs, verify that their input/output types and persistence calls contain only roomId, type, normalized text, count, and extractor version
- [x] 4.4 Implement fencing, counting and stable namespace of Redis candidate aggregation, verify that old tokens cannot be appended, read the final snapshot or delete new holder data
- [x] 4.5 implements TTL per window/per type/per room upper limit and coverage of the end retry window. Only low-priority candidates will be discarded if the verification exceeds the limit. Expired content will automatically disappear without affecting the real voice.
- [x] 4.6 Stop new keyword processing and log destination-level downgrade without content when Redis or candidate extraction is unavailable, verify safety consumer and LiveKit sessions still continue

## 5. Summary and reliable tasks after the end

- [x] 5.1 Atomicly create the `COLLECTING` summary when the enabled room is created, and advance `PENDING` with the upsert job in the room transaction entering ENDING/ENDED, verify that the repeated end event only generates one summary and one task
- [x] 5.2 implements job claim/recovery that supports `FOR UPDATE SKIP LOCKED`, leaseId, lockedUntil and deadline, verifies that the concurrent runner has only one valid holder and the stale lease cannot complete the task
- [x] 5.3 Implement secondary filtering, stable scoring/sorting, deduplication and bounded interception of candidate snapshots, and write items, update READY and complete the job within a PostgreSQL transaction
- [x] 5.4 implements UNAVAILABLE convergence when there are insufficient candidates, expired candidates, persistent dependency failures and retry deadlines are exceeded, verifying that there are no empty contents and there is no need to wait for the end of the room
- [x] 5.5 implements the READY/UNAVAILABLE final state idempotent, and verifies that repeated jobs, process restarts and late end events cannot add entries, change READY content or rollback status
- [x] 5.6 compare-and-delete the temporary working set after the final state is submitted, and add failure retries and maintenance cleanup to verify that cleanup failures do not overwrite the persistent results and that no recoverable candidates remain in the end.

## 6. Summary query after the meeting

- [x] 6.1 Implement `GET /v1/rooms/{roomId}/keyword-summary` and unify `DISABLED/PENDING/READY/UNAVAILABLE` envelope, verify that only READY returns stable sorted keywords/short expressions
- [x] 6.2 Expose the application port through rooms to verify the actual membership and room end status, verify that LEFT/REMOVED historical members are readable, reservation-only/invitation-only/unrelated users are rejected and resource status is not disclosed
- [x] 6.3 Verification summary response only contains subject, status, generation time, and allowed entries, but does not contain userId, membership, participant identity, timeline, complete original sentence, or internal failure details

## 7. Personal vocabulary book

- [x] 7.1 Implement server-side authorization and field copying to create VocabularyItem from readable READY summary item. Verification cannot use unfinished, unreadable or non-existent sources.
- [x] 7.2 Implement VocabularyCommand payload hash and `(userId, sourceSummaryItemId)` constraints, verify that the same UUID/payload returns the original result, changes the payload conflict, and the same source will not be created repeatedly
- [x] 7.3 Implement `(updatedAt,id)` keyset paging and favorite/kind filter binding of `GET /v1/me/vocabulary-items`, verify that the cross-filter cursor is rejected, the personal list is stable and the empty list semantics are correct
- [x] 7.4 implements personal entry editing and field policy with expectedVersion, normalizes text/nullable notes/favorite status verification, allows at most one concurrent old version to succeed, and does not modify the shared summary
- [x] 7.5 implements physical deletion with expectedVersion, verifies that entries immediately disappear from reads/lists, old edit or favorite commands cannot be revived, shared rollups and other user copies are unchanged
- [x] 7.6 Add cross-user override and automatic diffusion tests to verify the guessed item id cannot be read and written, summarized READY does not automatically write to any user's vocabulary book or private notes

## 8. API, privacy and maintenance

- [x] 8.1 Add post-meeting keyword agreement, summary and wordbook DTO/controller/presenter, regenerate `openapi/openapi.yaml` and verify that the request default value, status enumeration, error code, cursor and version fields are consistent with the runtime
- [x] 8.2 Extended log/trace/exception desensitization and prohibited content field rules, verify that audio, transcript, candidate text, final item text, personal note and provider response do not enter diagnostic output
- [x] 8.3 Add maintenance operations for final jobs, expired commands and orphaned temporary keys, and verify that maintenance tasks do not delete READY summaries, personal wordbooks, cases, audits or consent facts
- [x] 8.4 updates the module public entry and dependency rules to verify that rooms, speech-safety, post-room-learning and workers only interact through the public application/domain port and have no circular dependencies.

## 9. Verification and acceptance

- [x] 9.1 Complete unit/integration/e2e tests for switch, purpose consent, single STT fanout, candidate privacy, summary state machine, permissions, idempotent, concurrency and wordbook CRUD, and verify that all target tests pass
- [x] 9.2 Run independent worker runtime tests on real PostgreSQL and Redis to verify dual-purpose single-pass transcription, fencing, restart recovery, consumer isolation, shutdown and content cleanup
- [x] 9.3 Run format, Prisma validate/generate, OpenAPI drift, dependency boundary, build, complete unit/integration/e2e/runtime, `git diff --check` and OpenSpec strict validation, and record the commands, quantities and results
- [x] 9.4 Write `docs/acceptance/implement-post-room-keywords-vocabulary-backend.md`, verify that local implementation, privacy check, migration/rollback, real environment proof and all BLOCKED items are recorded separately
- [ ] 9.5 Use real LiveKit Cloud and qualified streaming STT provider to complete double room smoke, verify keyword-only and double room only perform one STT, anonymous summary after the end, participant permissions, withdrawal stop, provider/Redis failure downgrade and no complete transcription; record BLOCKED when credentials are missing, keep this task incomplete and do not archive change
