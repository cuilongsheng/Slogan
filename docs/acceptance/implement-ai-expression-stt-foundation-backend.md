# implement-ai-expression-stt-foundation-backend acceptance

## Baseline and result

- Date: 2026-09-16. The implementation is local and is not deployed.
- Revision: `2687b1a30c90ee1b4abe5a768e28822153922b04` on `develop`. The checkout contains other uncommitted OpenSpec deliveries, so this revision is only the implementation baseline.
- Runtime: Node.js 24.21.0 and pnpm 12.3.4. Final API verification passed: unit 22 suites / 150 tests, integration 23 suites / 148 tests, HTTP E2E 12 suites / 66 tests; 57 suites / 364 tests. Lint, typecheck, build, migration deploy and OpenAPI drift checks also passed.

## Contract and room boundary

- `POST /v1/rooms/{roomId}/expression-assistance/text` accepts only an actor-scoped UUID and 1–1000 Unicode characters. `POST /v1/rooms/{roomId}/expression-assistance/audio` accepts one allowlisted audio file up to 5 MiB, the current notice version, an explicit per-request confirmation and an optional source language.
- Both routes require the authenticated user to have an active membership in a current `OPEN` room and to remain eligible by profile, age, account and effective safety-restriction rules. Topic and CEFR are loaded through the rooms application boundary; forged topic, CEFR or user identifiers fail validation.
- The private response contains one concise English expression, up to two alternatives, controlled tone values, an accuracy notice and result timestamps. There is no result list/read route, room broadcast, autoplay, room event, private-note write or other-member projection.
- HTTP tests completed the accept → audio assistance → revoke → audio rejection flow and proved that text assistance continues after revocation. Authentication, membership, ended-room, removed-member, safety restriction, malformed multipart, unknown MIME, missing file, multiple files, oversize file, 429 with `Retry-After` and 503 degradation paths passed.

## Consent, idempotency and quota

- `SpeechProcessingConsentEvent` is append-only and scoped by user, purpose and notice version. ACCEPT and REVOKE commands are actor-scoped and idempotent; reusing a request id with changed content conflicts. A notice upgrade makes an older acceptance insufficient.
- `AiExpressionRequest` uses `(userId, clientRequestId)` plus an input digest. Identical success replays without another provider call or ledger row; changed room, mode or input conflicts; in-progress work returns a bounded retry; expired output stays expired and is not regenerated.
- PostgreSQL advisory locks serialize user/day and platform/day reservations. Integration tests ran three concurrent requests against a two-request quota and committed exactly two reservations. Replays do not reserve again, and quota errors report the seconds until the next UTC day.
- Lease tokens guard every state transition. A replacement lease rejected a late commit from the prior worker. Provider timeout and unavailable outcomes use `UNCERTAIN`; deterministic failures remain stable for same-id replay.
- A real Redis runtime test passed cross-instance rate and concurrent limits, retry timing, permit release and fail-closed behavior when Redis is unavailable. The room remains usable because Redis is consulted only for a new assistance request.

## Providers and data minimization

- `ExpressionGenerator` and `SpeechTranscriber` ports isolate the application from OpenAI-compatible HTTP adapters. AI and STT have separate category, base URL, key, model, region, timeout and retention/deletion policy configuration.
- Startup validation defaults both capabilities off. Enabling text requires Redis, a secure AI endpoint, region, `REQUEST_PROCESSING_ONLY` data-use, retention and no-training declarations. Enabling audio additionally requires an STT endpoint, region, the same restricted data-use and no-retention or delete-after-processing mode. Production endpoints must use HTTPS and declared retention cannot exceed seven days.
- Provider contract tests passed success, idempotency headers, timeouts, HTTP failures, malformed responses, strict expression structure, multipart field allowlisting, source language and duration conversion. Provider bodies and secret values are never returned in normalized errors.
- Source text and audio are hashed only for request identity. The database contains no raw text, audio or transcript. The STT transcript exists only between the STT and expression calls and is neither returned nor persisted. The provider payload contains the request input, server topic and CEFR only; it contains no user identity, other member data or LiveKit credential.
- HTTP bodies, multipart metadata, source text, transcript, digests, generated output, prompts, provider body, URL and keys are redacted. Structured assistance logs retain only event, request id, input mode, phase, duration and normalized result code.

## Migration and cleanup

- Migration `20260916000000_ai_expression_stt_foundation` adds the request, usage-ledger and consent-event tables plus enums, checks, foreign keys and indexes. The isolated migration suite passed both an empty schema and the complete historical migration chain with existing user and room rows preserved.
- Successful output receives a configured 5-minute to 7-day expiry. A separate BullMQ maintenance queue carries only the request id. PostgreSQL conditionally clears expired output and records `outputPurgedAt`; repeated cleanup is idempotent and reads treat expired results as unavailable immediately.
- The real Redis/PostgreSQL cleanup runtime passed scheduled deletion, repeated deletion and recovery scanning of an expired row whose job was missing. A queue scheduling failure is logged and does not turn a committed success into a client failure; the database scan converges after worker restart.
- `openapi/openapi.yaml` remains the sole generated contract and includes JSON text, multipart audio, consent commands, common private result DTOs and stable assistance errors. `openapi:check` passed with no drift.

## Real provider boundary

- **BLOCKED — not PASS:** `apps/api/.env` and repository `.env` are absent, so there is no configured AI/STT base URL, model, region, policy declaration or credential. The required synthetic-text and non-personal short-audio smoke against real providers was not executed.
- No production provider connectivity, latency, model behavior, provider-region routing, deletion behavior or no-training proof is claimed. Fake adapters and local HTTP contract tests do not replace this evidence.

## Commands

- `pnpm verify:api` — PASS, 57 suites / 364 tests.
- `test/runtime/assistance-redis-cleanup.smoke.spec.ts` against real Redis/PostgreSQL — PASS, 1 suite / 2 tests.
- `pnpm deps:check` — PASS; dependency-cruiser checked 303 modules / 1179 dependencies with zero violations.
- `/Users/cls/.nvm/versions/node/v25.9.0/bin/openspec validate implement-ai-expression-stt-foundation-backend --strict` — PASS.
- `pnpm --filter @slogan/api openapi:check` and `git diff --check` — PASS.

## Rollback

- Set `ASSISTANCE_ENABLED=false` and `ASSISTANCE_AUDIO_ENABLED=false` before rolling application instances back. Stop new provider requests and keep cleanup workers running until retained output is cleared.
- Keep the additive tables, consent facts, digests and usage ledger during a forward fix. Do not run a destructive down migration or claim that disabling the feature removes provider-side data.
