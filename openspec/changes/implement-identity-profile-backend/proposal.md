## Why

The current API only has a working NestJS shell and does not yet have account, session, profile or adult access capabilities; the room, voice and security modules are unable to establish trusted user identities and access boundaries. First implement the back-end closed loop of `identity-and-profile`, and at the same time determine the first batch of API, database and authentication architecture, which can provide a stable foundation for subsequent room control surfaces.

## What Changes

- Implement the backend of the existing `identity-and-profile` capability: Google/WeChat third-party identity login, same issuer + subject idempotent association, first data initialization, current user data reading and modification, data completion status and 18-year-old access judgment.
- Establish the first persistence model and migration of PostgreSQL + Prisma, covering platform users, third-party identities, materials and revocable sessions.
- Determine and implement the unique OpenAPI contract generation method in the Architecture stage; this change recommends using NestJS code-first generation, which generates and verifies `openapi/openapi.yaml` by a deterministic verification script. The same command is executed after CI is available, and handwritten contracts are not allowed to be maintained in parallel.
- Establish an access token + rotating refresh token session model available on mobile terminals; refresh token only saves irreversible digests and supports rotation, revocation and replay detection.
- Isolate Google and WeChat authentication through provider adapter; automated testing uses deterministic fake adapter, real provider acceptance must use their respective legal configurations, and simulation results must not be used to pretend that online authentication is successful.
- Configure verification, structured logs, security response headers, CORS allowlist, authentication/refresh interface current limit, unified error code and request correlation ID for the first batch of public API access.
- Provide unit, integration and API e2e evidence for domain policy, Prisma repository, session rotation and key HTTP processes, and generate reviewable OpenAPI contracts.

### Confirmed Scope

- This change implements the confirmed behavior of `openspec/specs/identity-and-profile/spec.md` and does not change its product requirements.
- Age is calculated based on the year and month of birth reported by the user; this batch does not claim to have completed document-level age verification.
- The same `provider + providerSubject` must be mapped back to the same platform account.
- Those whose information is not completed or who are under 18 years old can log in and maintain their own information, but they cannot obtain room business access qualifications.

### Non-goals

- Does not implement rooms, Redis concurrent capacity, LiveKit, room host control, reporting penalties, STT, AI, friend or administrator background.
- Does not implement independent registration of mobile phone number, SMS verification code or document-level age verification.
- Does not implement automatic merging or manual binding between different OAuth provider accounts.
- Does not provide a public user data query interface to avoid expanding data exposure before data visibility is determined.
- Does not implement front-end page or real device UI acceptance.

### Future Roadmap

- 0.0.1 backend is promoted according to delivery slices: identity and data 7 development days; room control surface 6-8 days; LiveKit voice and room host control 6-9 days; security reporting and auditing 4-6 days; integration verification and release reinforcement 3-5 days. A total of about 26–35 pure development working days, excluding Figma, platform review, voucher waiting and product review.
- Subsequently, each slice will create or update OpenSpec change independently to prevent a large change from occupying all modules at the same time.
- Mobile phone number registration, account merging and stronger age verification are reserved for subsequent version decisions.

### Unresolved Decisions

- The official application credentials, redirect URIs and environment configurations of Google and WeChat still need to be provided by the project owner before implementation.
- The hosted CI provider has not been selected. Currently, ensure that all verifications can be repeatedly executed by a single repository command; initialize Git and determine the hosting platform before connecting to the corresponding pipeline.

## Capabilities

### New Capabilities

<!-- None. This change implements existing current requirements and does not introduce new product capabilities. -->

### Modified Capabilities

<!-- None. identity-and-profile requirements unchanged, skip_specs=true. -->

## Impact

- Impacted delivery stages: Architecture、Backend / API、Test / Acceptance。
- Mainly affects `apps/api/src/modules/auth`, `users`, `profiles`, `apps/api/src/infrastructure/oauth`, `database`, `observability`, `apps/api/prisma`, `openapi/openapi.yaml` and API testing.
- Prisma, PostgreSQL driver, JWT/cryptography, OpenAPI, logging and HTTP security-related dependencies will be added; Redis or LiveKit will not be introduced.
- The database enters the first schema from a no-business schema; migration must be upgradeable in an empty database, and a development environment recovery solution must be provided.
- Once generated, the API contract becomes the only publishing contract, and subsequent front-end consumption can only be done through generated client.
