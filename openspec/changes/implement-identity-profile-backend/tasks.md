## 1. API and runtime basics (planned for 1 day)

- [x] 1.1 Install and fix Prisma/PostgreSQL, OpenAPI, validation, JWT, log, Helmet and rate limiting dependencies, update the toolchain registry, and verify dependency closure through `pnpm install --frozen-lockfile` and direct-dependency audit
- [x] 1.2 Extended Zod environment configuration and `.env.example`, covering database, JWT/session, CORS and Google/WeChat provider configuration, and used bootstrap tests to verify that missing secret, illegal TTL, and illegal origin will prevent startup
- [x] 1.3 Establish `/v1` prefix, global validation, stable error body, request ID, Helmet, CORS, Pino/pino-http and authentication current limit, use API e2e to verify that errors do not leak stack/token and the security response header exists

## 2. PostgreSQL and persistence boundaries (planned for 1 day)

- [x] 2.1 Define `User`, `OAuthIdentity`, `AuthSession` and `UserProfile` Prisma schema and the first additive migration, and use schema inspection to verify tables, foreign keys and unique indexes after running migration on a new test database
- [x] 2.2 Implement the database module, Prisma lifecycle and transaction boundary, ensure that the Prisma type does not cross the infrastructure, and verify it through dependency-cruiser and repository integration smoke test
- [x] 2.3 Implement identity concurrent find-or-create and session/profile repositories, and verify through integration testing that the same `(issuer, subject)` concurrent request only generates one account, and no semi-finished products remain in failed transactions

## 3. Information and Adult Access Areas (Planned for 1 day)

- [x] 3.1 Implement profile value object and field verification, including avatar, name, gender code, nationality or city, interest codes, CEFR, birth year/month, and use table-driven unit testing to cover required fields, boundary length, repeated interests, and illegal enumerations
- [x] 3.2 Implement the `PROFILE_REQUIRED`, `AGE_RESTRICTED`, `ELIGIBLE` policy and conservative month algorithm, and verify the boundaries of new years, leap years, the 18th month and the next month through the frozen clock test
- [x] 3.3 Implement profiles application use cases and personal information repository adapter, and verify complete submission of idempotent through integration testing. Changes in birth date will recalculate the status and will not expose other people's information.

## 4. OAuth Identity and Platform Sessions (Planned for 2 days)

- [x] 4.1 Define `OAuthProviderPort`, provider identity and stable provider error mapping, and use deterministic fake adapter to verify success, cancellation, invalid code, timeout and provider unavailable path
- [x] 4.2 Implement the first/second OAuth login use case, verify the first creation of an account through application/integration tests, subsequent returns to the same account, and provider recommended information will not automatically complete the profile
- [x] 4.3 Implement access JWT and rotating opaque refresh token, use transactions to update digest, and verify issuance, expiration, revocation, concurrent refresh, and session invalidation after refresh token replay through security unit/integration tests
- [x] 4.4 Implement Google adapter’s authorization code exchange and issuer/subject verification, verify request parameters, timeout, error mapping and log desensitization through mock HTTP contract tests; supplement real runtime evidence when test application credentials are available
- [x] 4.5 Implement authorization code exchange and stable identity mapping of WeChat adapter, verify request parameters, timeout, error mapping and log desensitization through mock HTTP contract tests; supplement real runtime evidence when test application credentials are available

## 5. HTTP API with the only OpenAPI Contract (planned for 1 day)

- [x] 5.1 implements `POST /v1/auth/oauth/{provider}/exchange`, `refresh`, `logout` controller/DTO/guard, and verifies token lifecycle, unauthenticated access and stable error code through HTTP e2e
- [x] 5.2 Implement `GET /v1/me` and `PUT /v1/me/profile`, and authenticate identity-and-profile's first login, data incomplete, data completed, under 18 years old and over 18 years old scenarios through HTTP e2e correspondence
- [x] 5.3 Establish deterministic NestJS code-first OpenAPI generation and drift check, generate `openapi/openapi.yaml`, and verify that it is the only released contract through OpenAPI validation and secondary generation of zero diff

## 6. Comprehensive acceptance and delivery (planned for 1 day)

- [x] 6.1 Establish an independent test database initialization/cleaning process, run clean migration, repository integration and HTTP e2e to verify that the test is repeatable and does not rely on real credentials or personal data
- [x] 6.2 Add provider-neutral API verification command and perform a full set of checks on workspace format, lint, typecheck, build, unit/integration/e2e, dependency boundary and OpenAPI drift. Record PASS, FAIL or BLOCKED item by item in acceptance evidence; if the hosted CI has been determined, access the same command
- [x] 6.3 Use Google and WeChat test applications to verify success, cancellation of authorization and invalid code respectively; if the certificate or platform audit is not ready, clarify the BLOCKED reason in the acceptance evidence and do not prevent the completion of other automated evidence
- [ ] 6.4 Compare the design/risks of `openspec/specs/identity-and-profile/spec.md` and this change to complete the product-owner review, confirm the criteria, runtime, migration and contract evidence before deciding to archive
