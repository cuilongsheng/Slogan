## Context

See `proposal.md`’s Why. Currently `apps/*`, `packages/*` and `tests/*` only have directories and `.gitkeep`; the repository root does not have `package.json`, `pnpm-workspace.yaml`, lockfile, TypeScript configuration, test runner or Git repository. The existing architecture has been confirmed `pnpm` monorepo, React PC management terminal, React Native + Expo mobile terminal, NestJS modular monolith, `packages/api-client` and pure TypeScript `packages/shared`. This design is responsible for turning these boundaries into executable baselines.

This change is an engineering infrastructure change and does not generate product requirement delta, so `skip_specs=true` is used. It only enters the Architecture and Test / Acceptance phases.

## Goals / Non-Goals

**Goals:**

- One installation, one lockfile, unified root command, while allowing each workspace to develop and verify independently.
- All three apps have minimal launchable portals that do not pretend to be implemented product pages or APIs.
- Promote ghost dependencies, cross-application imports, illegal sharing and circular dependencies from literal rules to automatic checks.
- Let local and any future CI provider call the same `pnpm verify` to avoid two sets of facts for local/CI.
- Use TypeScript and test configurations suitable for each running environment for admin, mobile, api and pure TS package.
- Record the unique responsibility and adoption time for each technology to avoid the coexistence of multiple libraries for the same responsibility or pre-installation without consumer dependence.

**Non-Goals:**

- Don't force all platforms to use the same test runner, tsconfig, or UI component architecture.
- Does not introduce Nx, Turborepo, Changesets, Git LFS, container orchestration or shared configuration packages.
- Do not initialize database, Redis, LiveKit and other running dependencies, and do not create public HTTP endpoint.
- Does not generate OpenAPI contract/client, does not determine API-first or NestJS code-first.
- Does not connect to a specific CI/Git platform, and does not define deployment and official release versions.

## Decisions

### Decision: Use the native pnpm workspace without adding a task orchestration framework

Root directory creates `package.json`, `pnpm-workspace.yaml`, unique `pnpm-lock.yaml`, version files and `.npmrc`. The workspace range is fixed to `apps/*` and `packages/*`, the package name uses `@slogan/*`, and all are marked as `private: true`. Local workspace dependencies must use `workspace:*`, and each package explicitly declares its direct dependencies.

The root package only holds engineering tools and orchestration scripts that are truly cross-workspace; running dependencies such as React, Expo, and NestJS belong to their respective apps. Use pnpm's default dependency layout, and do not enable global hoist for easy import; if Expo's verified compatibility requires a special node linker, the reasons and impact must be explained in apply evidence.

Currently there are only three apps and two packages, and the pnpm recursive/filter command is enough to organize tasks. Nx/Turborepo's cache, daemon and additional configuration do not generate enough revenue yet; introduce it as an independent change after measurable CI or local build bottlenecks occur.

### Decision: The tool chain version must be recorded in the repository

Root `package.json` pins the exact pnpm version with `packageManager`, pins the supported Node LTS major version with `engines.node` and a version file; lockfile pins the complete dependency graph. At the beginning of apply, the same set of stable versions should be selected and recorded based on the official compatibility range of React/Vite, Expo, NestJS and Playwright. It should not directly inherit the Node `v25.9.0` of the current machine or undeclared global tools.

The version selection verification record is written into the acceptance evidence of this change. In the future, regular dependency upgrades will be routed according to Level 0/1; cross-major version upgrades of Node, Expo, NestJS or build systems need to be evaluated separately.

### Decision: The technology stack is layered using adopt-now / adopt-on-trigger

`docs/architecture/toolchain.md` is the technology selection registration entry; it records responsibilities, status, selection reasons, introduction trigger conditions and rejected overlapping solutions. `package.json` and lockfile are the source of truth for the actual installed version. Stable and must-observe usage boundaries continue to be held by `rules/*.md`, and the complete dependency list cannot be copied into `AGENTS.md`.

Bootstrap’s `adopt-now` combination is:

| Area   | Adopt now                                                                                    | Responsibility                                                      |
| ------ | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Root   | pnpm workspace、TypeScript、ESLint、Prettier、dependency-cruiser、Playwright                 | workspace, static checking, dependency boundaries and Web E2E       |
| Admin  | React、Vite、React Router、Tailwind CSS、Vitest、React Testing Library                       | PC shell, centralized routing, style tokens and quick testing       |
| Mobile | React Native、Expo、Expo Router、React Native StyleSheet、Jest、React Native Testing Library | Native shell, file routing, platform style and quick testing        |
| API    | NestJS、Express adapter、`@nestjs/config`、Zod、Jest                                         | HTTP application shell, startup configuration verification and test |

The following `adopt-on-trigger` default scheme is used when business capabilities appear, but must not be installed in bootstrap:

| Trigger                                        | Default choice                                                                             | Boundary                                                                                       |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| The first real API consumption page            | OpenAPI generated fetch client + TanStack Query                                            | View does not request directly; feature hook combination generated client                      |
| The first complex form                         | React Hook Form + Zod                                                                      | The form schema belongs to the feature and the API DTO is not copied.                          |
| The first admin data table                | TanStack Table                                                                             | Column, filter and permission actions belong to the corresponding feature                      |
| The first Chinese and English product page     | i18next + react-i18next; mobile plus expo-localization                                     | User text only comes from i18n resources                                                       |
| The first appointment/cross-time zone function | date-fns + date-fns-tz                                                                     | DB/API uses UTC time, showing the use of IANA timezone                                         |
| The first persistence use case                 | PostgreSQL + Prisma                                                                        | PostgreSQL is the source of truth; Prisma is only in infrastructure                            |
| The first Redis coordination use case          | ioredis                                                                                    | presence, throttling, temporary state and Lua atomic operations, no persistent facts are saved |
| First asynchronous/delay/retry task            | BullMQ                                                                                     | The task must be idempotent and have retry, timeout and failure evidence.                      |
| The first voice room use case                  | LiveKit server/client SDK                                                                  | token is issued by the backend; SDK is isolated in adapter/service                             |
| The first public API                           | nestjs-pino、Helmet、CORS allowlist、rate limiting                                         | Structured desensitization logs and server-side security boundaries                            |
| Auth change                                    | Passport/provider adapter, token/refresh scheme, Argon2id (when password exists)           | As a standalone Level 2 design, no session model is inferred in bootstrap                      |
| First real deployment                          | error reporting / OpenTelemetry Select according to operation and maintenance requirements | Do not fabricate production monitoring capabilities before deployment                          |

The initial status of Axios, Redux/Zustand, NativeWind, Fastify, Changesets, Testcontainers, etc. is `deferred`, which is not permanently banned:

- Use the fetch transport generated by a unique OpenAPI contract by default; Axios is only evaluated when upload progress, specific adapter or generator constraints form real requirements, and components must not directly depend on the transport.
- TanStack Query only manages server state; when the local React state is sufficient, the global store will not be introduced, and Zustand/Redux will be evaluated after the real cross-page client state appears.
- Admin uses Tailwind CSS; Mobile uses StyleSheet + semantic tokens, and NativeWind is not forcibly introduced for grammatical unification.
- API uses NestJS default Express adapter; Fastify will only be evaluated if stress testing or clear compatibility evidence indicates it is needed.
- Testcontainers were introduced after the advent of PostgreSQL/Redis integration tests; bootstrap tests do not require external containers.

Only one default scheme can exist for the same responsibility. New overlapping libraries must explain the real constraints, migration impacts, and removal plans that cannot be met by the original solution through subsequent changes.

### Decision: The three ends use the smallest official operating shell

- `apps/admin`：React + TypeScript + Vite + React Router + Tailwind CSS。 Only provides the project smoke page and centralized router/provider entrance, and does not create fake dashboard, login or room UI. Use Vitest and React Testing Library for testing; use root Playwright for browser acceptance.
- `apps/mobile`：React Native + Expo + Expo Router + TypeScript。 Only provides one project smoke route; retains the top-level `app/` and `src/features`/`src/services` boundaries, and uses StyleSheet and semantic tokens for style. Unit/component testing uses Expo-compatible Jest and React Native Testing Library; startup and bundle/export checks are not equivalent to physical device acceptance.
- `apps/api`：NestJS + TypeScript + Express adapter。 Only provides bootable `AppModule`, bootstrap, `@nestjs/config` and Zod environment verification, and does not create business modules, public controllers or `/health` endpoints that have not entered the only OpenAPI contract. Use Jest for testing. At least verify that the legal configuration can be init/close. If the required configuration is missing, the startup will fail.

These smoke shells are engineering operation evidence, not product UI design, so Figma is not required and `voice-room-figma-to-frontend` is not used; subsequent Level 1/2 product UIs still comply with this Skill rule.

### Decision: The shared package establishes boundaries first and does not pre-build capabilities.

- `packages/shared` uses pure TypeScript, providing minimal public entry and package `exports`; must not rely on DOM, Node-only API, React, React Native, NestJS, or environment variables. When there is no real sharing logic, the entrance remains without business export.
- `packages/api-client` only creates private package manifest, generate directory and generate/clean script boundaries; before `openapi/openapi.yaml` is approved, it does not generate files, does not expose placeholder DTO, and does not become app dependency.

Do not add `packages/config`. The shared TypeScript, ESLint, and Prettier configurations are placed directly in the root directory and explicitly extended by app/package; they will be extracted when the configuration requires an independent version or is reused across repositories.

### Decision: TypeScript configuration is inherited by running environment and does not use global path shortcuts

Root `tsconfig.base.json` only puts stringency and quality options that are true for all three ends. admin, mobile, api, and shared each maintain options related to the operating environment; do not mix DOM, Node, and React Native lib into the same configuration.

When importing package name and `exports` across workspaces, aliases within the application are only allowed to point to the public root of this application. It is prohibited to use a root `paths` mapping to directly penetrate other app or feature internal directories. The initial scale is not mandatory for TypeScript Project References; the real build graph needs to be introduced during incremental compilation.

### Decision: ESLint manages code quality, dependency graph tools manage boundaries and loops

The root ESLint flat config provides TypeScript and platform adaptation rules, and each app only adds necessary overrides. Use `dependency-cruiser` as a separate dependency graph checker to perform the following hard checks:

- app cannot import another app;
- package cannot be imported into app;
- `packages/shared` must not rely on platform frameworks or Node-only modules;
- Deep import of internal implementation across feature/module is not allowed;
- The dependency graph must not form a cycle.

Dependency graph checked as `pnpm deps:check` and into `pnpm verify`. Don't hide loops with barrel, TS alias or NestJS `forwardRef`.

### Decision: The root command is the only verification entry

Root scripts include at least:

```text
dev:admin       dev:mobile       dev:api
format          format:check
lint            typecheck       deps:check
test            test:e2e        build
verify
```

`verify` sequentially performs checks without modifying the file: `format:check -> deps:check -> lint -> typecheck -> test -> build -> test:e2e`. Playwright configuration starts the admin smoke app through `webServer`, which only covers browser behavior; the mobile side smoke uses Expo to start/bundle and corresponding test evidence. Subsequent functions such as microphone, permissions, and locale still require physical device evidence.

The scripts of each workspace remain individually callable, and the root command is arranged through pnpm recursive/filter. Packages without corresponding capabilities do not provide pseudo-success scripts; for example, the api-client that has not yet been generated does not use `echo success` to pretend to be build/test.

### Decision: Git, version and release only establish anti-pollution boundaries

Create `.gitignore`, exclude `node_modules`, build artifacts, coverage, Playwright reports, local environment files, Expo/Metro cache, and editor temp files, while leaving safe `.env.example`. Do not ignore OpenSpec, rules, lockfile or required test fixtures.

This change does not implement `git init` because the repository remote platform and working method have not yet been confirmed by the user; nor does it enable Git LFS because there are currently no large binary assets that must enter the repository. Keep all workspaces private first, and do not introduce Changesets or npm publish process. Product release state continues to be recorded independently in `docs/releases/`.

### Decision: CI provider is deferred, but CI contract is now fixed

In the future, CI can only call root `pnpm install --frozen-lockfile` and `pnpm verify`, and cannot copy another set of check logic. Cache keys should contain lockfile and runtime versions; parallelization or affected-only optimizations must remain equivalent to full `verify`.

Since `docs/runbooks/deployment.md` has been recorded and the CI provider has not been determined, this change does not create `.github/workflows` or other platform files. After the platform is determined, add the provider adapter as an independent change and retain complete verification as a baseline in the first CI.

## Risks / Trade-offs

- [Risk] Expo has framework-specific requirements for pnpm dependency layout or Node version. → Use the official support matrix to select the version when applying, first verify `expo-doctor`, startup and bundle/export; only add linker/hoist exceptions when evidence appears.
- [Risk] Root `verify` Initial serial execution will be slower than shortest feedback. → Keep the independent commands of each workspace and each check; after the CI provider is connected, it will be parallelized or filtered based on the measurement, and the cache framework will not be added in advance.
- [Risk] Dependency boundary rules that are too strict will prevent legal reuse. → Cross-end sharing is only allowed via package public exports; new exceptions must indicate the owner, and path-level temporary exemptions are not allowed to exist for a long time.
- [Risk] Increase the configuration amount of the three test environments. → Accept platform differences, unify the root entry, naming and evidence, and do not force unification of test runners.
- [Risk] smoke page mistaken for product implementation. → The page explicitly marks the project bootstrap, and does not use product copy, Figma status or static business data; the acceptance record indicates that it does not constitute 0.0.1 functional completion.
- [Risk] The provider CI is not connected, and there is no remote mandatory access control at the time of merging. → This change fixes the reproducible local CI contract; priority is given to access after the platform is selected, and it must not claim that the CI has been configured before.
- [Risk] `packages/api-client` empty packet causes users to bypass the contract. → Apps must not rely on this package until the unique OpenAPI contract and build strategy are approved in a subsequent Architecture change.
- [Risk] The deferred library listed in the technical registry was mistakenly thought to be installed or available. → Only dependencies that exist in the manifest and lockfile and that have passed verification are considered implemented; the document must show adoption status and trigger.

## Migration Plan

1. Record compatible version combinations and selection criteria, create root package/workspace/version/format/lint/TypeScript configuration and `.gitignore`.
2. Create manifests for five workspaces, use `workspace:*` to declare real internal dependencies, install dependencies and generate unique lockfiles.
3. Create the minimum running entrance and respective configurations of admin, mobile, and api in the existing directory; delete `.gitkeep` that was replaced by the real file, and do not clean up the confirmed directory that is still empty.
4. Create a minimal public entry for `packages/shared`; keep `packages/api-client/src/generated` ungenerated and not consumed by the app.
5. Add ESLint, dependency graph, each application test and root Playwright smoke test, and connect root scripts.
6. Execute frozen install and `pnpm verify` from the clean dependency state, and collect evidence of admin browser startup, mobile Expo startup/bundle, and Nest application init/close respectively.
7. Update the project startup document to clarify which ones are only bootstrap evidence and which ones have not yet been implemented; do not modify the product acceptance or release status.

The rollback is bounded by the new manifest, lockfile, tool configuration and smoke entry of this change; the original rules, docs, OpenSpec and directory structure are retained. Since there is no database, API contract, remote CI or deployment state, this change does not require data migration and production rollback.

## Open Questions

- Use GitHub, GitLab or other remote platforms; decide the CI adapter file location and branch protection method after finalization.
- Whether Git LFS is needed in the future; this will only be decided if Figma exports or media assets do need to go into Git and the size reaches an agreed threshold.
