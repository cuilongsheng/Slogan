# Instant Room Backend Verification Evidence

## Scope

- OpenSpec change: `implement-instant-room-backend`
- Current requirements: `openspec/specs/instant-room-discovery/spec.md` and the server-side join boundary from `openspec/specs/localization-and-room-rules/spec.md`
- Impacted stages: Architecture, Backend / API, Test / Acceptance
- Verification date: 2026-09-11
- Release state: not deployed
- Product acceptance: DEFERRED until frontend integration

## Automated Evidence

| Evidence                          | Command                                      | Status | Result                                                                                                     |
| --------------------------------- | -------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------- |
| Environment and secret validation | `pnpm --filter @slogan/api test:unit`        | PASS   | Missing/short room pepper and blank rules version reject bootstrap; room password fields are redacted      |
| Domain and security tests         | `pnpm --filter @slogan/api test:unit`        | PASS   | Creation, eligibility, access order, HMAC, DTO and transaction-retry behavior covered                      |
| Clean database migration          | `pnpm --filter @slogan/api test:integration` | PASS   | Identity/profile foundation and additive instant-room migration applied to PostgreSQL 17.6                 |
| Repository integration            | `pnpm --filter @slogan/api test:integration` | PASS   | Schema constraints, atomic create, profile projection, list/detail, join and rollback covered              |
| Concurrent last seat              | `pnpm --filter @slogan/api test:integration` | PASS   | Two real PostgreSQL contenders produced one success, one `ROOM_FULL` and exactly two memberships           |
| HTTP API E2E                      | `pnpm --filter @slogan/api test:e2e`         | PASS   | Authentication, eligibility, create/list/detail/join, rules, password, expiry, capacity and errors covered |
| OpenAPI validation and drift      | `pnpm --filter @slogan/api openapi:check`    | PASS   | Four room endpoints and their schemas validate; deterministic regeneration has zero drift                  |
| Full backend verification         | `pnpm verify:api`                            | PASS   | Node 24.21.0; 65 unit, 10 PostgreSQL integration and 12 HTTP E2E tests passed with lint/typecheck/build    |
| Workspace format                  | `pnpm format:check`                          | PASS   | All managed source and verification evidence use project formatting                                        |
| Dependency boundaries             | `pnpm deps:check`                            | PASS   | Workspace audit passed; 121 modules and 288 dependencies have no violations                                |

The commands above were run with the repository-pinned Node.js 24.21.0 runtime. The ambient shell
was using unsupported Node.js 25.9.0, so it was not used as verification evidence.

## Requirement Review

| Current requirement                                               | Backend evidence                                               | Review status    |
| ----------------------------------------------------------------- | -------------------------------------------------------------- | ---------------- |
| Eligible adults can create an immediate 2–6 person, two-hour room | Policy unit tests, repository integration and HTTP E2E         | BACKEND VERIFIED |
| Public rooms and four-digit password rooms                        | HMAC security tests, real repository integration and HTTP E2E  | BACKEND VERIFIED |
| Room list and detail expose required room facts                   | Cursor/list/detail integration and HTTP E2E; generated OpenAPI | BACKEND VERIFIED |
| Concurrent joins never exceed capacity                            | Real PostgreSQL row-lock integration test                      | BACKEND VERIFIED |
| A join requires server-side rules confirmation                    | Policy, integration and HTTP E2E reject `rulesAccepted: false` | BACKEND VERIFIED |

## Contract and Security Notes

- `openapi/openapi.yaml` is generated from NestJS metadata and remains the sole published API
  contract.
- `POST /v1/rooms`, `GET /v1/rooms`, `GET /v1/rooms/{roomId}` and
  `POST /v1/rooms/{roomId}/memberships` require a verified access token and current adult-profile
  eligibility.
- PostgreSQL is the room and membership fact source. A row lock plus unique constraints protects
  the last seat; Redis is not introduced in this change.
- Four-digit PINs are stored only as room-scoped HMAC-SHA-256 digests using a required server
  pepper. API responses expose only `passwordProtected`.
- `memberCount` means persistent room membership, not LiveKit presence or current audio
  connections.
- The initial host membership is created atomically with the room. The localized rules UI,
  microphone check and realtime credential flow remain outside this backend control-plane change.

## Deferred Acceptance and Known Boundaries

- Frontend integration, localized rule presentation, Figma comparison and device evidence are
  DEFERRED by the product owner until the pages are ready.
- LiveKit token issuance, audio, presence, leave/host transfer, removal/reinvite and room ending are
  not implemented by this change.
- Platform restriction durations, appeals and safety-operator actions remain a separate safety
  change; this version enforces active sessions plus profile and age eligibility.
- No deployment, hosted CI run or production behavior is claimed.

Automated backend verification is complete. Keep this OpenSpec change unarchived until the planned
unified frontend/backend product-owner acceptance is performed.
