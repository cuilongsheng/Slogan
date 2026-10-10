## 1. Data model and domain boundaries

- [x] 1.1 Added expression requests, voice consent events, usage ledgers and necessary enumerations to the Prisma multi-file schema, including actor-scoped idempotent, state transition, lease, output expiration and usage unique constraints, and ran `pnpm --filter @slogan/api db:generate` to verify the schema.
- [x] 1.2 adds forward-only migration and indexing, using isolated schema integration testing to verify that the empty database and the complete historical migration chain containing existing users, rooms, appointments, security, historical notes and social data are upgraded and the old data remains unchanged.
- [x] 1.3 Implement pure domain policies for text length, audio boundaries, provider output, request status transitions, input summaries and result expiration, and use unit tests to cover boundary values, illegal conversions and invalid structures.
- [x] 1.4 Add a read-only assistance context in the public application boundary of rooms, uniformly return server room status, valid membership, topic, CEFR and account/age/security qualifications, and use integration tests to verify that non-member, leave, remove, final room and new restrictions cannot be bypassed.
- [x] 1.5 Implement append events and current projection rules for purpose/versioned voice consent, and verify acceptance, withdrawal, version invalidation, others' forgery and command idempotent with unit tests.

## 2. Provider, configuration and privacy basics

- [x] 2.1 Added Zod environment configurations for assistance, AI, STT, quota, timeout, retention, region, no-training/deletion mode and notice version; use the configuration test to verify that the default shutdown, production HTTPS, enabled dependencies and more than seven days policy all fail fast without leaking configuration values.
- [x] 2.2 Define the `ExpressionGenerator` port and implement the OpenAI-compatible HTTP adapter, AbortSignal timeouts, provider idempotent keys, strict structure parsing and stable error normalization, using fake HTTP contract tests to cover success, timeouts, HTTP errors, malformed JSON, out-of-bounds output and keys without errors.
- [x] 2.3 Define `SpeechTranscriber` port and implement OpenAI-compatible multipart adapter, source language, actual duration/usage return, timeout and stable error normalization, use fake HTTP contract tests to verify that only allowed fields are sent and no identity, room or LiveKit sensitive information is sent.
- [x] 2.4 adds disabled/fake provider wiring, so that local automation does not require real credentials and the enablement status is clear; use bootstrap testing to verify that the disabled entry fails stably, only text is enabled without requiring STT, and both STT and Redis are required when enabling audio.
- [x] 2.5 extends HTTP and structured log desensitization, covering multipart metadata, original text, input summary, structured expression, provider body/URL/key and transcript; use log unit testing to prove that the above content does not enter the output but status, stage, time-consuming and normalization errors can still be diagnosed.

## 3. Agree, idempotent, limit and processing status

- [x] 3.1 Implement Prisma assistance repository and `RESERVED -> STT_RUNNING -> AI_RUNNING -> SUCCEEDED | FAILED | UNCERTAIN` state machine, commit stage results under PostgreSQL database time, advisory lock and lease token; use integration tests to verify that late responses cannot cover new leases.
- [x] 3.2 Implement `(userId, clientRequestId)` input summary and replay rules, use integration tests to verify successful result replay within the retention period, change input/room/mode conflicts, failed replay, return during processing, and do not re-call the provider after the text expires.
- [x] 3.3 Implement consent query and ACCEPT/REVOKE application service, use PostgreSQL integration test to verify that current projection, notice upgrade, withdrawal only affect future requests and same/different idempotent command behavior.
- [x] 3.4 Implement `AiUsageLedger`’s user UTC daily quota, audio seconds, platform budget reservation and actual usage settlement. Use concurrent integration testing to verify that the last quota is only allowed to be reserved once, no deduction is allowed for pre-emptive rejection, no repeated deduction is allowed for replay, and unknown provider costs are protected by the reservation upper limit.
- [x] 3.5 Implementing Redis atomic minute frequency and concurrency limits, using real Redis runtime tests to verify cross-instance count, `retryAfterSeconds`, lease expiration and AI/STT fail closed when Redis fails while room processes continue to be available.

## 4. Text and short voice expression process

- [x] 4.1 Implement text expression application process: qualification context, request reservation, quota, provider call, strict output verification, success/failure submission and private result replay; use fake provider integration test to verify that CEFR/topic comes from the server and the original text does not enter the database.
- [x] 4.2 Implement short voice application process: valid consent, confirmation of this notice, audio summary, temporary STT, 30-second check, temporary transcript delivery and expression generation; use fake provider integration test to verify that transcript is not persisted, does not return, and does not call AI if STT fails.
- [x] 4.3 implements 5 MiB single file in-memory upload, MIME allowlist, one file and controlled field validation, using HTTP e2e tests to verify empty files, multiple files, unknown MIME, out-of-bounds size, fake topic/CEFR/userId and missing notice rejects before provider.
- [x] 4.4 Verification text/audio timeouts, provider unavailability, invalid results, platform budget shutdown, and Redis failures all return only stable expression auxiliary errors; use integration tests to prove that room status, membership, room host, location, and existing realtime credentials do not change.
- [x] 4.5 Verify that expression results belong only to the requesting user and do not enter other members, room events, private notes, or public content; use integration with e2e negative testing to check for others reading by result/request ID, log scans, and database content boundaries.

## 5. Cleanup, HTTP contract and migration evidence

- [x] 5.1 implements independent assistance maintenance queue, `EXPIRE_AI_OUTPUT` content-less tasks and database condition cleaning; uses real Redis/PostgreSQL runtime test to verify that expired reads immediately expire, text is blanked, duplicate tasks idempotent and lost tasks are recovered after restarting the scan.
- [x] 5.2 adds consent, text expression and multipart audio controller/DTO/error mapping, and uses e2e testing to complete the "Accept consent → Audio assistance → Withdraw → Audio rejection but text is still available" and the current member text assistance process.
- [x] 5.3 Use e2e negative testing to verify authentication, identity boundaries, room eligibility, current security restrictions, consent, 429/Retry-After, 503 downgrade, result privacy, and responses that do not contain original input, transcript, provider, token, or other member data.
- [x] 5.4 Regenerate `openapi/openapi.yaml` via NestJS code-first, run `pnpm --filter @slogan/api openapi:check` to verify JSON/multipart, file boundaries, consent, unified results and stable error contract without drift.

## 6. Acceptance and external boundaries

- [x] 6.1 Execute assistance-related domain, provider contract, PostgreSQL integration, HTTP e2e, real Redis frequency/cleaning and historical migration tests, record the number of packages and idempotent, quota concurrency, privacy and cleaning results.
- [x] 6.2 Execute configured real AI/STT provider smoke using synthesized text and short audio containing no personal information, logging model/region category, latency, output structure, duration and failed degradation; missing credentials or proof of vendor data policy are explicitly marked as BLOCKED, fake testing may not be used in place of PASS. **Result: BLOCKED, neither the repository nor the process has a real Provider configuration, see the acceptance document for details.**
- [x] 6.3 Run `pnpm verify:api`, `pnpm deps:check`, OpenSpec strict validation, format check and `git diff --check` once to fix the failures introduced by this change and save the final number.
- [x] Added `docs/acceptance/implement-ai-expression-stt-foundation-backend.md` in 6.4, which records contracts, migrations, automation, real Redis/provider runtime, consents, credits, data minimization, cleanup, undeployed status and all external BLOCKED evidence.
