# Identity and Profile Backend Acceptance Evidence

## Scope

- OpenSpec change: `implement-identity-profile-backend`
- Requirements: `openspec/specs/identity-and-profile/spec.md`
- Impacted stages: Architecture, Backend / API, Test / Acceptance
- Release state: not deployed

## Automated Evidence

| Evidence                  | Command                                                                     | Status | Result                                                                           |
| ------------------------- | --------------------------------------------------------------------------- | ------ | -------------------------------------------------------------------------------- |
| Locked dependencies       | `pnpm install --frozen-lockfile`                                            | PASS   | Lockfile accepted; direct dependencies are pinned                                |
| Environment validation    | `pnpm --filter @slogan/api test:unit`                                       | PASS   | Missing/invalid secrets, TTL, CORS and provider configuration reject bootstrap   |
| Domain/application tests  | `pnpm --filter @slogan/api test:unit`                                       | PASS   | Profile, age, session, provider, redaction and limiter behavior covered          |
| Clean database migration  | `pnpm --filter @slogan/api test:integration`                                | PASS   | Initial migration applied to isolated PostgreSQL 17.6 test container             |
| Repository integration    | `pnpm --filter @slogan/api test:integration`                                | PASS   | Schema, unique identity, rollback, concurrent refresh and profile upsert covered |
| HTTP API E2E              | `pnpm --filter @slogan/api test:e2e`                                        | PASS   | Login, current user, profile, refresh replay, logout and stable errors covered   |
| OpenAPI generation        | `pnpm --filter @slogan/api openapi:generate`                                | PASS   | Generated `openapi/openapi.yaml` from NestJS metadata                            |
| OpenAPI validation/drift  | `pnpm --filter @slogan/api openapi:check`                                   | PASS   | Contract validates and a second generation has zero drift                        |
| Full backend verification | `pnpm verify:api`                                                           | PASS   | Node 24.21.0; 35 unit, 5 PostgreSQL integration and 8 API E2E tests passed       |
| Workspace regression      | `pnpm format:check`, `deps:check`, `lint`, `typecheck`, `build`, `test:e2e` | PASS   | Dependency boundaries, all builds and Playwright Chromium baseline passed        |

## Runtime Evidence

| Provider                            | Success                                                    | Cancel/invalid code    | Status                                               |
| ----------------------------------- | ---------------------------------------------------------- | ---------------------- | ---------------------------------------------------- |
| Deterministic provider-neutral fake | API E2E                                                    | API E2E                | PASS                                                 |
| Google test application             | Requires client credentials and configured redirect URI    | Requires provider flow | BLOCKED — test-app credentials not provided          |
| WeChat test application             | Requires approved application credentials and redirect URI | Requires provider flow | BLOCKED — credentials/platform approval not provided |

Automated fake-provider evidence proves internal behavior only. It does not claim that a real
Google or WeChat application has completed provider review or runtime authentication.

## Requirement Review

| Current requirement                                                            | Evidence                                                                                    | Review status |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- | ------------- |
| First and repeated Google/WeChat identity login maps to one platform account   | Provider adapter tests, application tests, concurrent PostgreSQL identity test and HTTP E2E | READY         |
| A first-time user must complete the required profile before room eligibility   | Profile policy/application tests and `GET /v1/me` / `PUT /v1/me/profile` E2E                | READY         |
| A user remains age-restricted until the month after the eighteenth birth month | Frozen-clock boundary tests and profile HTTP E2E                                            | READY         |

The current change exposes eligibility state but intentionally does not implement room endpoints;
the later room control-plane change must enforce this state on create, join and invitation actions.

## Security and Architecture Notes

- PostgreSQL is the identity/session/profile fact source; Prisma types remain inside backend
  infrastructure adapters.
- Access JWTs are short-lived. Opaque refresh tokens are stored only as HMAC digests, rotated in a
  serializable transaction, and replay revokes the session.
- OAuth authorization codes and token fields are redacted from structured logs.
- Rate limiting is process-local and is accepted only for the current single-instance boundary.
- No production deployment or hosted CI is claimed by this change.

## Product-owner Review

DEFERRED by the product owner until frontend integration is ready. Keep the OpenSpec change open;
review the criteria, generated OpenAPI contract, migration, automated evidence, real-provider
blockers and current non-goals as part of the unified frontend/backend acceptance before archive.
