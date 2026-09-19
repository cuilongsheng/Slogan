# Toolchain Registry

## Authority

This registry explains technology ownership and adoption timing. Workspace `package.json` files
and `pnpm-lock.yaml` are the authority for installed versions. Stable usage boundaries remain in
`rules/*.md`.

## Runtime Baseline

| Technology |     Version | Status    | Responsibility                      |
| ---------- | ----------: | --------- | ----------------------------------- |
| Node.js    | 24.21.0 LTS | adopt-now | Shared JavaScript runtime           |
| pnpm       |      12.3.4 | adopt-now | Workspace and dependency management |
| TypeScript |       6.0.3 | adopt-now | Shared type system and compiler     |

Node 24 satisfies the selected Vite, Expo/React Native, NestJS, ESLint, dependency-cruiser and
Playwright engine ranges. The Expo 57 versions follow the official `create-expo-app` SDK 57
template inspected during this change.

## Adopt Now

| Area   | Technology                 |                 Version | Responsibility                       |
| ------ | -------------------------- | ----------------------: | ------------------------------------ |
| Root   | ESLint                     |                 10.10.0 | Static code quality                  |
| Root   | Prettier                   |                   3.9.6 | Deterministic formatting             |
| Root   | dependency-cruiser         |                  18.2.0 | Dependency boundaries and cycles     |
| Root   | Playwright                 |                  1.63.0 | Admin browser E2E evidence           |
| Admin  | React / React DOM          |                  19.2.3 | PC rendering                         |
| Admin  | Vite / React plugin        |           8.2.2 / 6.1.1 | PC development and build             |
| Admin  | React Router DOM           |                  7.18.3 | Centralized PC routing               |
| Admin  | Tailwind CSS / Vite plugin |                   4.3.3 | PC styles and semantic tokens        |
| Admin  | Vitest / Testing Library   |          5.0.0 / 16.3.3 | Fast component tests                 |
| Mobile | Expo / Expo Router         |       57.0.21 / 57.0.20 | Native runtime and file routing      |
| Mobile | React / React Native       |         19.2.3 / 0.86.3 | Native rendering                     |
| Mobile | React Native StyleSheet    |                platform | Native styles using semantic tokens  |
| Mobile | Jest / jest-expo           |         29.7.0 / 57.0.5 | Native component tests               |
| API    | NestJS / Express adapter   |                  12.0.1 | Modular HTTP application shell       |
| API    | @nestjs/config / Zod       |          12.0.0 / 4.5.4 | Startup configuration validation     |
| API    | PostgreSQL / Prisma        |         server / 7.10.0 | Persistent identity and profile data |
| API    | NestJS Swagger             |                  12.0.1 | Code-first OpenAPI generation        |
| API    | JWT / rotating token       |                  12.0.1 | Access and refresh session boundary  |
| API    | Pino / Helmet / limiter    | 10.3.1 / 8.3.0 / 11.2.0 | Logging and HTTP security baseline   |
| API    | Jest / ts-jest             |        29.7.0 / 29.4.12 | API bootstrap tests                  |

## Adopt On Trigger

| Trigger                           | Default                                                         | Boundary                                    |
| --------------------------------- | --------------------------------------------------------------- | ------------------------------------------- |
| First real API consumer           | Generated OpenAPI fetch client + TanStack Query                 | Views never call transport directly         |
| First complex form                | React Hook Form + Zod                                           | Form schemas stay with the owning feature   |
| First admin data table            | TanStack Table                                                  | Columns and actions stay with the feature   |
| First localized product screen    | i18next + react-i18next; Expo localization on mobile            | All user text uses resources                |
| First scheduling capability       | date-fns + date-fns-tz                                          | UTC API values and IANA display timezone    |
| First persistent use case         | PostgreSQL + Prisma (adopted)                                   | Prisma remains in backend infrastructure    |
| First Redis coordination use case | ioredis                                                         | Temporary coordination only                 |
| First delayed or retryable job    | BullMQ                                                          | Idempotent jobs with retry and timeout      |
| First voice-room use case         | LiveKit server/client SDK                                       | Provider code remains behind adapters       |
| First public API                  | Pino/pino-http, Helmet, CORS allowlist, rate limiting (adopted) | Structured logs and server security         |
| Authentication change             | Provider adapters and explicit token/session design (adopted)   | Separate Level 2 decision                   |
| First real deployment             | Error reporting and OpenTelemetry as required                   | Do not claim production observability early |

## Deferred

| Technology      | Reason to defer                             | Reconsider when                                       |
| --------------- | ------------------------------------------- | ----------------------------------------------------- |
| Axios           | Generated fetch transport is the default    | Upload progress or adapter constraints are proven     |
| Redux / Zustand | No cross-page client state exists           | Local state no longer owns the behavior cleanly       |
| NativeWind      | Mobile uses StyleSheet and tokens           | Measured delivery benefit exceeds tooling cost        |
| Fastify         | Express is sufficient for the control plane | Profiling identifies the HTTP adapter as a bottleneck |
| Testcontainers  | Dedicated local/CI PostgreSQL is sufficient | Parallel isolation or multi-service tests justify it  |
| Changesets      | All packages are private                    | Publishing/versioning shared packages becomes real    |
| Git LFS         | No large tracked binary assets exist        | Repository assets exceed an agreed threshold          |

## Rejected For This Baseline

| Technology                                            | Reason                                                        |
| ----------------------------------------------------- | ------------------------------------------------------------- |
| Nx / Turborepo                                        | Current workspace does not justify another task/caching layer |
| Shared React DOM / React Native UI package            | Platform rendering and interaction semantics differ           |
| Placeholder OpenAPI client or DTOs                    | Would create a second contract before API strategy approval   |
| Placeholder database, Redis, LiveKit or auth services | No approved business use case consumes them yet               |

## Direct Dependency Inventory

The manifests and lockfile remain the version authority. This inventory explains every direct
dependency that supports the adopt-now stack; transitive packages are owned by their direct
parent and are not separate technology choices.

| Workspace  | Direct packages                                                                                                    | Responsibility                                                                     |
| ---------- | ------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| Root       | `typescript`, `@types/node`                                                                                        | Shared compiler and Node types for tooling configuration                           |
| Root       | `eslint`, `@eslint/js`, `typescript-eslint`, `globals`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh` | Flat lint configuration and React-specific static checks                           |
| Root       | `prettier`, `dependency-cruiser`, `@playwright/test`                                                               | Formatting, dependency boundaries and browser E2E                                  |
| Admin      | `react`, `react-dom`, `react-router-dom`                                                                           | PC runtime and centralized routing                                                 |
| Admin      | `vite`, `@vitejs/plugin-react`, `tailwindcss`, `@tailwindcss/vite`                                                 | PC build and semantic-token styling                                                |
| Admin      | `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/dom`, `@testing-library/jest-dom`                   | Component test runtime and DOM assertions                                          |
| Admin      | `typescript`, `@types/react`, `@types/react-dom`                                                                   | App-local compiler and framework types                                             |
| Mobile     | `expo`, `expo-router`, `expo-constants`, `expo-linking`, `expo-status-bar`                                         | Expo runtime, routing, linking and shell status bar                                |
| Mobile     | `react`, `react-native`, `react-native-safe-area-context`, `react-native-screens`                                  | Native rendering and Expo Router navigation peers                                  |
| Mobile     | `react-native-reanimated`, `react-native-worklets`                                                                 | Expo Router animation/worklet peers required by the selected SDK template          |
| Mobile     | `jest`, `jest-expo`, `@testing-library/react-native`, `react-test-renderer`                                        | Expo-compatible component tests                                                    |
| Mobile     | `@react-native/metro-config`, `typescript`, `@types/jest`, `@types/react`                                          | Metro, compiler and test/framework types                                           |
| API        | `@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express`                                                       | NestJS ESM application and Express HTTP adapter                                    |
| API        | `@nestjs/config`, `zod`, `reflect-metadata`, `rxjs`                                                                | Startup configuration validation and NestJS runtime peers                          |
| API        | `@prisma/client`, `@prisma/adapter-pg`, `pg`                                                                       | PostgreSQL persistence behind infrastructure adapters                              |
| API        | `@nestjs/jwt`, `@nestjs/swagger`, `class-validator`, `class-transformer`, `yaml`                                   | Sessions, transport validation and generated OpenAPI                               |
| API        | `express`, `helmet`, `pino`, `pino-http`, `rate-limiter-flexible`                                                  | HTTP runtime, security, redacted structured logs and single-instance rate limiting |
| API        | `@nestjs/cli`, `@nestjs/testing`, `jest`, `ts-jest`                                                                | Build, bootstrap test harness and TypeScript transformation                        |
| API        | `prisma`, `supertest`, `@apidevtools/swagger-parser`, `openapi-types`                                              | Migrations, HTTP E2E and OpenAPI validation                                        |
| API        | `typescript`, `@types/node`, `@types/jest`, `@types/express`, `@types/pg`, `@types/supertest`                      | App-local compiler and runtime/test types                                          |
| Shared     | `typescript`, `vitest`                                                                                             | Platform-neutral build, typecheck and test only                                    |
| API client | None                                                                                                               | Reserved generation boundary; no contract or client exists yet                     |

## Selection Rules

- One default technology owns each responsibility.
- A deferred dependency requires an approved change with a real consumer and verification plan.
- Components, views and routes never depend directly on HTTP transports or provider SDKs.
- Major runtime/framework upgrades require compatibility, migration and rollback evidence.

## Realtime backend adoption

`implement-livekit-voice-session-backend` adopts `livekit-server-sdk` 2.19.0, `bullmq` 6.3.4,
and `ioredis` 6.0.0 in the API only. PostgreSQL owns authorization, identity history, events and
commands; Redis delivers recoverable jobs. Workers run in the existing API process.
LiveKit Cloud is required for strict token revocation; real Cloud smoke remains separate evidence.
