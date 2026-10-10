# Slogan backend technical guide

This guide helps developers learning backend engineering understand the technologies in this project, why they are used, where their implementations live, and which capabilities still require verification in a real environment.

It describes the code as of 2026-09-17. Versions are defined by the [API package.json](./package.json), [root package.json](../../package.json), and [lockfile](../../pnpm-lock.yaml). Implementation status comes from the code and corresponding acceptance records. This document explains existing implementations; it neither introduces product requirements nor establishes that production deployment is complete.

## 1. Technology overview

The core stack is **TypeScript + NestJS + PostgreSQL + Prisma + Redis/BullMQ + LiveKit**.

| Category                  | Technology / repository version                      | Responsibility                                                        |
| ------------------------- | ---------------------------------------------------- | --------------------------------------------------------------------- |
| Runtime                   | Node.js 24.21.0                                      | Run JavaScript on the server                                          |
| Language                  | TypeScript 6.0.3                                     | Type checking, business code, and interface definitions               |
| Backend framework         | NestJS 12.0.1                                        | Modules, routing, dependency injection, authentication, and lifecycle |
| HTTP framework            | Express 5.2.1                                        | Receive HTTP requests, execute middleware, and return responses       |
| Relational database       | PostgreSQL; test image 17.6                          | Persist users, rooms, sessions, reports, and other business data      |
| ORM / migrations          | Prisma 7.10.0                                        | Typed database access and schema migrations                           |
| Database driver           | pg 8.23.0, @prisma/adapter-pg 7.10.0                 | Connect Prisma to PostgreSQL                                          |
| Temporary data service    | Redis; test image 7.4                                | Presence, temporary coordination, and queues                          |
| Redis client              | ioredis 6.0.0                                        | Connect to and operate Redis                                          |
| Task queue                | BullMQ 6.3.4                                         | Delayed jobs, concurrent execution, and retries                       |
| Realtime voice            | livekit-server-sdk 2.19.0, @livekit/rtc-node 1.0.0   | Room control, credentials, webhooks, and audio subscriptions          |
| Login credentials         | @nestjs/jwt + custom session management              | Access tokens, refresh tokens, and session revocation                 |
| Third-party login         | Google / WeChat OAuth adapters                       | Integrate external identity providers                                 |
| Request validation        | class-validator, class-transformer                   | Validate and transform request fields                                 |
| Configuration validation  | @nestjs/config, Zod                                  | Load environment configuration and validate it at startup             |
| API contract              | @nestjs/swagger, OpenAPI, yaml                       | Generate the sole contract from interface code                        |
| AI / STT                  | OpenAI-compatible HTTP adapters                      | Generate English expressions and transcribe speech                    |
| Logging                   | Pino, pino-http                                      | Structured logs, request IDs, and redaction                           |
| HTTP security             | Helmet, CORS, rate-limiter-flexible                  | Security headers, cross-origin policy, and rate limits                |
| Backend testing           | Jest, ts-jest, Supertest, @nestjs/testing            | Verify rules, database behavior, and HTTP flows                       |
| Contract validation       | @apidevtools/swagger-parser                          | Validate OpenAPI document structure                                   |
| Local test infrastructure | Docker Compose                                       | Isolated PostgreSQL and Redis                                         |
| Engineering tools         | pnpm workspace, ESLint, Prettier, dependency-cruiser | Package management, conventions, and dependency checks                |

`reflect-metadata` and `rxjs` support the NestJS runtime; each low-level dependency does not need to be studied as an independent architecture. Playwright handles browser and cross-application verification in this repository. Backend HTTP tests primarily use Supertest.

## 2. How Node.js, Express, and NestJS relate

- **Node.js** is the runtime that executes JavaScript on the server.
- **Express** is the HTTP framework that handles routing, middleware, requests, and responses.
- **NestJS** organizes the application on top of it through modules, services, dependency injection, guards, validation, and exception handling.

The project uses Express through `@nestjs/platform-express`. A typical controller looks like this simplified example:

```ts
@Controller('rooms')
export class RoomsController {
  constructor(private readonly rooms: RoomsService) {}

  @Post()
  async create(...) {
    return this.rooms.create(...);
  }
}
```

`@Controller` defines the route scope, and `@Post` defines the HTTP method. NestJS creates and supplies the constructor's `RoomsService`: this is **dependency injection**. Modules register and compose these services and their dependencies.

For frontend developers, the main new concepts are authorization, data consistency, concurrency, and recovery, rather than TypeScript syntax.

## 3. Architecture and business modules

The core API is a **modular monolith**: one NestJS application organized into business modules. A room-speech worker also starts independently. That does not make the entire system a microservices architecture.

| Module                 | Main responsibility                                             |
| ---------------------- | --------------------------------------------------------------- |
| auth / profiles        | Login, sessions, and profiles                                   |
| rooms                  | Rooms, membership, appointments, history, notes, and extensions |
| voice                  | Realtime identities, voice credentials, and LiveKit control     |
| social                 | Friends and availability                                        |
| moderation / safety    | Reports, safety cases, restrictions, and appeals                |
| backoffice / audit     | Administrative permissions and operation audit                  |
| assistance             | AI expression assistance and short speech processing            |
| speech-safety          | Sensitive speech detection in rooms                             |
| room-speech-processing | Shared coordination for room speech processing                  |
| post-room-learning     | Post-room keywords and vocabulary                               |

Complex modules have four internal layers:

| Layer          | Responsibility                                                       | Examples                                      |
| -------------- | -------------------------------------------------------------------- | --------------------------------------------- |
| presentation   | Receive requests, validate transport structures, and shape responses | Controllers, DTOs, presenters                 |
| application    | Orchestrate a complete business operation                            | Room creation and joining services            |
| domain         | Business rules and interface definitions                             | Capacity rules, eligibility, repository ports |
| infrastructure | Implement database and external service access                       | Prisma repositories, provider adapters        |

Dependencies flow from `presentation → application → domain`. Infrastructure implements interfaces defined by the domain. The domain does not depend on NestJS, Prisma, or provider SDKs.

A **port** defines a capability the business needs; an **adapter** implements it using a particular technology. For example, a Prisma repository implements the capability to save a room, keeping database drivers out of business rules.

See [project structure](../../docs/architecture/project-structure.md) for the complete directory responsibilities.

## 4. How an HTTP request flows

Start with room joining at `POST /v1/rooms/:roomId/memberships`:

```text
Client request
  → HTTP middleware: logs, request IDs, etc.
  → Guard: identity and session validation
  → ValidationPipe: validate and transform request fields
  → Controller: extract identity and parameters
  → Service / Policy: eligibility and business rules
  → Repository: query, check, and write within a transaction
  → Prisma / PostgreSQL
  → Presenter: shape the response DTO
  → HTTP response
```

Exception handling converts failures into stable error responses. Joining a business room and requesting LiveKit credentials are separate steps that require coordination; a join request does not itself transmit audio.

Read the following in order:

1. [Application bootstrap](./src/bootstrap/create-api-app.ts)
2. [Identity guard](./src/common/guards/access-token.guard.ts)
3. [Room controller](./src/modules/rooms/presentation/rooms.controller.ts)
4. [Room service](./src/modules/rooms/application/services/rooms.service.ts)
5. [Room policy](./src/modules/rooms/domain/policies/room.policy.ts)
6. [Room database implementation](./src/modules/rooms/infrastructure/prisma-room.repository.ts)

## 5. PostgreSQL and Prisma: persistence and concurrency

**PostgreSQL is the database; Prisma accesses it.** The usual call chain is `Service → Repository → Prisma → PostgreSQL`.

Prisma provides typed queries and migrations. Models live in [prisma/models](./prisma/models), and schema changes live in [prisma/migrations](./prisma/migrations). Migrations record schema evolution; they do not delete and recreate the database on every startup.

An ORM does not automatically resolve business concurrency. If a room has one seat left and two users join simultaneously, both may initially read that one seat is available. Independent writes could then exceed capacity.

The current room repository uses:

- `$transaction` to group database operations and roll back related writes on failure.
- `SELECT ... FOR UPDATE` to lock relevant rows and coordinate concurrent modifications.
- `pg_advisory_xact_lock` for transaction-scoped coordination by business identifier.
- Request identifiers and business checks to handle retries of the same operation.

**Idempotency** means that repeatedly submitting the same business operation must not repeat its business effect. Disabling a button improves interaction, but the server still needs to handle retries, multiple devices, and direct API requests.

A database transaction cannot roll back a request already sent to LiveKit. Cross-system consistency requires command records, retries, and reconciliation.

## 6. Redis and BullMQ: temporary state and background jobs

PostgreSQL stores durable business facts; Redis supports temporary state and coordination. Friend relationships belong in the database, while presence can use expiring Redis data and worker ownership needs temporary coordination.

BullMQ is a Redis-backed queue. The [realtime queue](./src/infrastructure/redis/realtime-queue.service.ts) currently includes room expiry, host timeout, appointment-window, and realtime control-command jobs.

It provides delayed execution, concurrency control, retries, and backoff. Backoff gradually increases retry intervals after failures to reduce pressure on an unavailable service. Jobs may run more than once, so handlers still need to be idempotent.

Critical scheduling facts and commands are retained in PostgreSQL. Redis is not the sole source of business truth. A delayed Redis job alone cannot guarantee that an operation will never be missed.

## 7. LiveKit: business control and voice media

| Component          | Responsibility                                                               |
| ------------------ | ---------------------------------------------------------------------------- |
| NestJS API         | Joining eligibility, host identity, restrictions, and credential permissions |
| LiveKit            | Voice connections, media transport, and participant connection management    |
| Room-speech worker | Join eligible rooms, subscribe to audio, and drive speech processing         |

The flow is: client requests membership → backend checks eligibility → client obtains room-scoped LiveKit credentials → client connects to LiveKit → LiveKit reports events through webhooks.

A **webhook** is an external service calling the backend to report an event, such as a participant connection change. The backend must authenticate the source and handle duplicate and delayed events. See the [LiveKit adapter](./src/infrastructure/livekit/livekit.adapter.ts).

- `livekit-server-sdk` provides server-side credentials, management APIs, and webhooks.
- `@livekit/rtc-node` lets the media worker join rooms and read audio tracks; see the [media source](./src/workers/room-speech/livekit-room-media-source.ts).

The HTTP API does not relay every participant's realtime audio. BullMQ task workers and continuously running speech-media workers perform different kinds of work.

Real Cloud connections, old-credential revocation, and device audio behavior require external acceptance evidence. Installing SDKs or passing fake-provider tests does not establish those results.

## 8. Login, sessions, and authorization

The current design uses **JWT access tokens + random refresh tokens + database sessions**.

| Concept       | Purpose                                    |
| ------------- | ------------------------------------------ |
| Access token  | Credential sent with API requests          |
| Refresh token | Renew an expired access token              |
| Session       | Revocable session state in the database    |
| Guard         | Identity checks before business processing |

The [session service](./src/modules/auth/application/services/session.service.ts) implements:

- JWT signature, expiry, issuer, and audience validation, plus session-state checks.
- Cryptographically secure random refresh tokens.
- HMAC-SHA256 digests, storing the digest rather than the plaintext refresh token.
- Token rotation and detection of reused old tokens.
- Session revocation on logout.

This is therefore not a fully stateless design that only checks JWT signatures. Google and WeChat use independent OAuth adapters. Existing code and completed authorization against real providers are separate states.

**Authentication** establishes who you are; **authorization** establishes what you may do. Logging in does not grant permission to remove members, read another user's data, or apply administrative restrictions. Host status, roles, and resource ownership require separate checks.

## 9. Validation and the API contract

TypeScript types cannot prevent clients from sending invalid JSON at runtime.

| Input                 | Tools                                                | Examples                                         |
| --------------------- | ---------------------------------------------------- | ------------------------------------------------ |
| Startup configuration | Nest Config + Zod                                    | Database connections, secrets, and feature flags |
| HTTP parameters       | class-validator + class-transformer + ValidationPipe | Required fields, types, ranges, and extra fields |

The global ValidationPipe enables field allowlisting, rejection of extra fields, and transformation. Request DTOs, database models, and business entities have distinct responsibilities and should not be interchangeable merely because their shapes are similar.

The API uses **NestJS code-first**: controller / DTO / Swagger annotations → [generation script](./src/scripts/generate-openapi.ts) → [sole OpenAPI contract](../../openapi/openapi.yaml).

`openapi:check` compares generated output with the repository contract to prevent drift. OpenAPI describes interfaces; OpenSpec remains the authority for current product requirements.

At the time this guide was written, `packages/api-client` was still a reserved generation boundary. The complete frontend client-generation pipeline could not yet be counted as delivered.

## 10. AI and STT integration

- **AI expression assistance** generates English expressions from input, topic, and proficiency level.
- **STT (speech-to-text)** transcribes speech for subsequent business processing.

The current implementation calls OpenAI-compatible HTTP interfaces using Node.js `fetch`. It neither uses LangChain orchestration nor trains its own models.

The [AI adapter](./src/infrastructure/ai/openai-compatible-expression.adapter.ts) and [STT adapter](./src/infrastructure/stt/openai-compatible-stt.adapter.ts) provide configurable endpoints and models, timeouts, response validation, usage information, and error mapping. STT also supports cancellation signals.

“OpenAI-compatible” describes an interface format, not an approved production provider or completed acceptance against a real service. The current STT HTTP adapter uploads audio for transcription. Continuous room-audio processing and suitable streaming STT must still be verified against the actual provider.

## 11. Security, logging, and audit

| Technology / mechanism | Purpose                                         | Boundary                                                                                           |
| ---------------------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Helmet                 | Security-related HTTP response headers          | Does not replace business authorization                                                            |
| CORS allowlist         | Browser cross-origin policy                     | Does not block direct API calls outside a browser                                                  |
| rate-limiter-flexible  | Limit high-frequency requests                   | Current authentication limits use process memory and are not automatically shared across instances |
| Pino / pino-http       | Structured logs and request IDs                 | Does not establish production monitoring and alerting                                              |
| Log redaction          | Keep credentials and sensitive data out of logs | New logging still needs review                                                                     |
| Business audit         | Trace actors, targets, reasons, and outcomes    | Has a different purpose from debug logs                                                            |

Exception filters provide stable error structures to clients while retaining internal diagnostic information. SQL, stack traces, and provider secrets must not be returned directly to clients.

## 12. Testing, development commands, and deployment boundaries

| Verification level  | Tools / environment              | Scope                                                                            |
| ------------------- | -------------------------------- | -------------------------------------------------------------------------------- |
| Unit tests          | Jest, ts-jest                    | Rules, permissions, and state changes                                            |
| Integration tests   | Jest, real test PostgreSQL, etc. | Repositories, transactions, and infrastructure behavior                          |
| HTTP E2E            | Supertest, Nest test application | Routes, identity, inputs, outputs, and business flows                            |
| External acceptance | Actual providers / LiveKit Cloud | Real service behavior                                                            |
| Device acceptance   | Supported mobile devices         | Microphone, reconnection, foreground/background behavior, and audio interactions |

Run these commands from the repository root. Start with `nvm use`, ensure `node --version` matches `.nvmrc` and the root `package.json`, and use the pnpm version specified by `packageManager`.

```bash
nvm use
node --version
pnpm --version
pnpm install --frozen-lockfile
```

Before starting the API, consult the [environment example](./.env.example), prepare a local `.env` and development database, and configure Redis and external services required by enabled features. Do not use example secrets in real environments. See [development instructions](../../docs/development.md) for the complete workspace setup.

| Command                                            | Purpose                                                                                |
| -------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `pnpm dev:api`                                     | Start API development mode                                                             |
| `pnpm --filter @slogan/api dev:room-speech-worker` | Start the room-speech worker in development mode                                       |
| `pnpm --filter @slogan/api db:migrate:deploy`      | Apply pending migrations to the configured database; confirm the target before running |
| `pnpm --filter @slogan/api db:test:up`             | Start isolated test PostgreSQL and Redis                                               |
| `pnpm --filter @slogan/api test:unit`              | Run unit tests                                                                         |
| `pnpm --filter @slogan/api test:integration`       | Run test-database migrations and integration tests                                     |
| `pnpm --filter @slogan/api test:e2e`               | Run HTTP E2E tests                                                                     |
| `pnpm --filter @slogan/api openapi:generate`       | Update the generated contract                                                          |
| `pnpm --filter @slogan/api openapi:check`          | Detect contract drift                                                                  |
| `pnpm verify:api`                                  | Run complete backend verification                                                      |
| `pnpm --filter @slogan/api db:test:down`           | Stop and clean up the test environment                                                 |

The [Docker Compose file](./docker-compose.test.yml) uses temporary storage for testing. It is not a production database template. Tests must never target real business databases.

During implementation, first run checks for the affected scope, then complete the relevant verification before delivery. Passing commands establishes only the checks actually performed; it does not replace real-provider or device acceptance.

Production deployment, backup recovery, alerting, and release status are documented in the [deployment runbook](../../docs/runbooks/deployment.md), [release records](../../docs/releases/README.md), and [acceptance records](../../docs/acceptance/README.md). They cannot be inferred from a dependency list.

## 13. Suggested learning order

| Order | Topic                                                    | Goal                                                              |
| ----- | -------------------------------------------------------- | ----------------------------------------------------------------- |
| 1     | Controllers, services, modules, and dependency injection | Trace an endpoint to its business implementation                  |
| 2     | PostgreSQL, Prisma, relationships, and migrations        | Explain how data is stored and queried                            |
| 3     | DTOs, validation, exceptions, and OpenAPI                | Implement a validated CRUD endpoint independently                 |
| 4     | JWT, sessions, authentication, and authorization         | Explain login, renewal, logout, and permissions                   |
| 5     | Transactions, locks, and idempotency                     | Explain concurrent and repeated requests                          |
| 6     | Redis, BullMQ, retries, and recovery                     | Explain what happens after background-job failures                |
| 7     | LiveKit, webhooks, and media workers                     | Explain coordination between business state and media connections |
| 8     | Deployment, monitoring, and backup recovery              | Maintain a real running service                                   |

Start by understanding room joining. Follow one complete request through the code listed in section 4, then study voice credentials. Build an understanding of the entire flow before exploring each tool in depth.

## 14. Documentation responsibilities and maintenance

- [OpenSpec specs](../../openspec/specs): current product requirements.
- [Backend rules](../../rules/backend.md): backend engineering constraints.
- [Toolchain](../../docs/architecture/toolchain.md): technology choices and historical phase boundaries.
- [Project structure](../../docs/architecture/project-structure.md): directory and module responsibilities.
- [OpenAPI README](../../openapi/README.md): contract workflow.
- [Acceptance records](../../docs/acceptance/README.md): evidence and blockers for individual changes.

Architecture and development documents may retain scope statements from early changes. Do not use those historical boundaries to infer that later features remain unimplemented. Assess current implementation through the code, current OpenSpec, and corresponding acceptance records. Update relevant sections when dependencies, architecture, or external acceptance change.
