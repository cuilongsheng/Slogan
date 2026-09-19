# implement-post-room-keywords-vocabulary-backend acceptance

## Baseline and result

- Date: 2026-09-17. The implementation and verification are local and are not deployed.
- Revision: `2687b1a30c90ee1b4abe5a768e28822153922b04` on `develop`. The checkout already contains other uncommitted OpenSpec deliveries, so this revision is only the implementation baseline.
- Runtime: Node.js 24.21.0 and pnpm 12.3.4.
- The local implementation covers the immutable room flag, independent purpose consent, one-STT multi-purpose processing, anonymous Redis candidates, durable summary jobs, member-only summary reads, private vocabulary CRUD, cleanup and generated OpenAPI.

## Room, consent and shared speech processing

- `postRoomKeywordsEnabled` defaults to `false`, is accepted only during instant or appointment creation, and is returned by list, detail, share and appointment responses. A PostgreSQL trigger rejects later changes even through direct SQL.
- Creating an enabled room requires `POST_ROOM_KEYWORDS_ENABLED=true`, a healthy shared room-speech worker heartbeat and current `POST_ROOM_KEYWORDS` consent. Join, appointment reservation and realtime credential reserve/confirm repeat the complete purpose set check.
- `AI_EXPRESSION_AUDIO`, `ROOM_SAFETY_DETECTION` and `POST_ROOM_KEYWORDS` use separate consent events and notice versions. A notice change invalidates only that purpose. Reusing the same command UUID with changed content conflicts.
- Post-room consent withdrawal increments the membership credential generation, moves active membership out of the room, revokes issued identities and writes durable `REVOKE_IDENTITY` commands. Integration evidence proves it creates no report, safety case, restriction or account penalty.
- `room-speech-processing` owns room discovery, provider sessions and pre/post consent-generation checks. A room with safety only, keywords only or both enabled receives one media subscription and one STT call per window. The transcript is synchronously fanned out in process memory; either consumer may fail without cancelling the other.
- Audio buffers and WAV copies are zeroed on completion, failure and shutdown. Complete transcripts are not written to PostgreSQL, Redis, BullMQ or logs.

## Anonymous candidates and durable summaries

- The versioned local extractor applies NFKC/case/punctuation normalization, English stop words, token and character limits, deterministic ordering and contact/URL filtering. Candidate input has no user, membership, participant, timestamp or sentence-order field.
- Redis stores only room-scoped candidate kind, normalized/display text, count and extractor version under a bounded TTL. Per-kind limits retain the highest-count candidates. Lua checks the current room lease before append, snapshot and delete; runtime tests prove a stale token cannot mutate, read or delete a replacement lease's data.
- Candidate extraction and Redis write failures open separate `KEYWORD_CANDIDATE_EXTRACTION` or `KEYWORD_CANDIDATE_STORE` capability incidents containing only room, component and normalized error metadata. The consumer backs off for at least one speech window, never replays skipped audio, and marks the matching incident recovered after a successful attempt.
- Enabled room creation atomically creates one `COLLECTING` summary. The same transaction that moves a room to `ENDING` or `ENDED` advances it to `PENDING` and upserts one durable job.
- PostgreSQL job claiming uses row locking with `FOR UPDATE SKIP LOCKED`, opaque lease IDs and `lockedUntil`. Stale leases cannot complete. Finalization applies a second privacy filter, deterministic score/order and bounded truncation, then writes items, marks `READY` and completes the job in one transaction.
- Missing or expired candidates and repeated dependency failure converge to `UNAVAILABLE` by the configured deadline. `READY` and `UNAVAILABLE` are terminal and idempotent. Candidate deletion happens after terminal commit; maintenance removes terminal job records, expired commands and orphaned Redis worksets without deleting READY summaries or vocabulary.

## Summary and private vocabulary APIs

- `GET /v1/rooms/{roomId}/keyword-summary` requires actual historical membership and an `ENDING` or `ENDED` room. LEFT and REMOVED members retain access; reservations and invitations alone do not. The response exposes only room id, topic, public status, generated time and ranked allowed items.
- The public summary states are `DISABLED`, `PENDING`, `READY` and `UNAVAILABLE`. Only `READY` includes items; internal leases, failure details, identities, speakers, timelines and transcripts are never exposed.
- `POST /v1/me/vocabulary-items` copies one readable READY summary item into the current user's private vocabulary. `(userId, sourceSummaryItemId)` prevents duplicate imports, while `(userId, clientRequestId)` plus a payload hash makes retries stable and rejects changed payloads.
- `GET /v1/me/vocabulary-items` uses `(updatedAt,id)` keyset pagination and binds favorite/kind filters into the opaque cursor. PUT normalizes editable text/note/favorite values and uses `expectedVersion`; DELETE uses the same version boundary and physically removes only the user's copy.
- Cross-user reads and writes return a stable not-found result. Editing or deleting a private item never changes the shared summary or another user's copy, and summary completion never auto-creates vocabulary or private notes.

## Privacy, migration and rollback

- Structured logging redacts audio, transcript, candidate text, final item text, normalized text, personal notes and provider responses. New diagnostics contain only room id, purpose/stage, counts, status, duration and normalized error categories.
- Migration `20260917000000_post_room_keywords_vocabulary` adds the purpose enum value, default-false immutable room flag, summary/item/job tables and vocabulary/command tables. Follow-up migration `20260917001000_post_room_keyword_degradation` adds the two purpose-specific degradation components. Isolated empty/historical migration tests prove prior rooms remain false and direct updates are rejected.
- Deployment order: apply the additive migration; deploy API and worker with `POST_ROOM_KEYWORDS_ENABLED=false`; validate PostgreSQL, Redis, LiveKit/STT readiness and OpenAPI; run the real-provider smoke; then allow new enabled rooms.
- Rollback order: disable creation of enabled rooms; let or force active jobs converge; stop the keyword consumer; roll back API/worker binaries. Keep the additive tables, consent facts, READY summaries and user vocabulary. Redis temporary keys expire or are removed by maintenance. Physical schema/content deletion requires a separate approved migration.

## Local verification

- Prisma schema validation/generation, all 16 migrations and the isolated historical migration passed against PostgreSQL 17.6.
- Final API verification passed: unit 29 suites / 173 tests, integration 27 suites / 162 tests and HTTP E2E 13 suites / 70 tests; 69 suites / 405 tests. Lint, typecheck, build, migration deploy and OpenAPI drift checks also passed.
- HTTP E2E passed: 13 suites / 70 tests. The new contract covers member-only summaries, idempotent imports, private filtering, versioned edit/delete and independent keyword consent.
- The complete local runtime set passed: 6 suites / 8 tests. The shared worker used synthetic in-memory audio and a fake STT adapter, performed one STT call for a dual-purpose room, wrote the existing safety fact and anonymous Redis candidates, fenced a competing worker, zeroed content and recovered after restart.
- `pnpm deps:check` passed with 356 modules / 1449 dependencies and zero dependency violations. Lint, typecheck, build and generated OpenAPI drift checks passed.
- `openapi/openapi.yaml` is generated from NestJS and remains the sole public API contract.
- Strict validation passed for this change and all 21 main OpenSpec specifications.

## External acceptance boundary

- **BLOCKED — LiveKit Cloud and qualified streaming STT provider:** no usable repository credentials or provider-policy evidence are available. The required two-person keyword-only and dual-purpose smoke has not run.
- The external smoke must prove one hidden participant and one STT call, uninterrupted human voice, anonymous end-of-room summary, member authorization, immediate consent-withdrawal stop, Redis/provider degradation and absence of complete transcript retention.
- Local fake media/STT and local Redis/PostgreSQL evidence do not prove Cloud connectivity, provider retention/deletion behavior, production latency or device behavior. OpenSpec task 9.5 remains unchecked and the change must remain active.

## Commands

- `pnpm --filter @slogan/api test:unit` — PASS, 29 suites / 173 tests.
- `pnpm --filter @slogan/api test:integration` — PASS, 27 suites / 162 tests.
- `pnpm --filter @slogan/api test:e2e` — PASS, 13 suites / 70 tests.
- Full runtime Jest command for `test/runtime` — PASS, 6 suites / 8 tests. Jest reported the pre-existing delayed-exit warning after success; no test failed.
- `pnpm deps:check`, `pnpm --filter @slogan/api lint`, `pnpm --filter @slogan/api typecheck`, `pnpm --filter @slogan/api openapi:check` — PASS.
- `pnpm --filter @slogan/api verify` — PASS, 69 suites / 405 tests plus build and OpenAPI drift verification.
