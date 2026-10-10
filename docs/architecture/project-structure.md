# Project Structure

## Purpose

This project uses `pnpm` monorepo, front-end feature-first and NestJS modular monolith. This article defines the target directory and responsibilities; the mandatory dependency rules are still based on `AGENTS.md` and `rules/*.md`.

Currently only the directory and `.gitkeep` are created. The existence of a directory does not mean that the corresponding functions, dependencies, APIs or runtimes have been implemented.

## Repository

```text
Slogan/
├── apps/
│ ├── admin/ # PC management terminal
│   ├── mobile/              # React Native + Expo
│   └── api/                 # NestJS modular monolith
├── packages/
│ ├── api-client/ # The only generation client for OpenAPI contract
│ └── shared/ # Pure TypeScript without framework dependencies
├── tests/
│ ├── e2e/ # Cross-application/browser Playwright process
│ └── fixtures/ # Shared test input without private data
├── openapi/ # unique API contract
├── openspec/ # Current requirements and changes
├── rules/ # Stable engineering constraints
├── workflow/ # Project Delivery Lifecycle
└── docs/ # Architecture, acceptance, release and runbook
```

Do not create `packages/config`, `packages/shared-ui`, microservice applications or the second set of API types yet. The new workspace package must have a clear owner and at least two real consumers.

## PC Admin

```text
apps/admin/
└── src/
    ├── app/
    │ ├── router/ # Centralized routing and route guards
    │ └── providers/ # Application level providers
    ├── api/
    │ └── generated/ # OpenAPI generates results, no manual modification
    ├── features/
    │   ├── auth/
    │   ├── dashboard/
    │   ├── rooms/
    │   ├── moderation/
    │   ├── users/
    │   └── settings/
    │ ├── api/ # feature request combination
    │       ├── components/  # feature UI
    │ ├── hooks/ # feature status and interaction arrangement
    │ └── model/ # feature local model, schema, status
    ├── views/ # Routing level page combination
    ├── layouts/ # Application shell and page structure
    ├── components/ # Cross feature UI primitives
    ├── hooks/ # Cross-feature technology Hook
    ├── styles/              # global、theme、tokens
    ├── types/ # Really global front-end type
    ├── utils/ # Stateless pure function
    ├── i18n/ # Language resources and initialization
    ├── assets/ # Local static assets
    └── test/ # admin test setup/helpers
```

The above uses `settings/` to show the internal structure of the feature; the directory skeleton creates the same `api/components/hooks/model` subdirectory for each listed feature. The actual implementation allows deletion of empty subdirectories that serve no purpose.

### Admin Dependency Direction

```text
app/router -> views -> features -> api/shared frontend infrastructure
layouts ---------------> shared components/hooks/styles
```

- `views` does not call generated client directly.
- Feature does not depend on `views` or `app/router`.
- Use each other's public entrance across features, and do not deeply import internal components or hooks.
- Table columns, filtering, field forms and permission actions belong to features and do not enter the root components.

## Mobile

```text
apps/mobile/
├── app/
│ ├── auth/ # Expo Router Identity routing
│ ├── rooms/ # room routing
│ ├── profile/ # Data routing
│ └── voice-room/ # Voice room routing
└── src/
    ├── providers/ # application providers
    ├── api/
    │ └── generated/ # OpenAPI generates results, no manual modification
    ├── features/
    │   ├── auth/
    │   ├── profile/
    │   ├── room-discovery/
    │   ├── voice-room/
    │   └── reporting/
    │       ├── api/
    │       ├── components/
    │       ├── hooks/
    │       └── model/
    ├── components/
    │   └── ui/              # React Native UI primitives
    ├── hooks/ # Cross-feature technology Hook
    ├── services/
    │ ├── microphone/ # audio equipment package
    │ ├── permissions/ # System permission encapsulation
    │ ├── secure-storage/ # Secure local storage
    │ ├── localization/ # Device language reading
    │ └── realtime/ # LiveKit technology adapter
    ├── styles/ # theme and semantic tokens
    ├── types/ # Really global mobile terminal types
    ├── utils/ # Stateless pure function
    ├── i18n/ # Chinese and English language resources
    ├── assets/ # Mobile static assets
    └── test/ # mobile test setup/helpers
```

The directory skeleton creates `api/components/hooks/model` for each listed feature. The route file of Expo Router only combines features and does not carry APIs, permissions or LiveKit business processes.

### Mobile Dependency Direction

```text
app routes -> features -> api/services/shared mobile infrastructure
```

- `services/realtime` only encapsulates LiveKit SDK; rules such as room host, removal, and reconnection qualifications belong to the feature and backend.
- PC React DOM components are not allowed to enter mobile; mobile React Native components are not allowed to enter admin.
- Microphone, permissions, system language, and disconnection behavior require runtime/physical device evidence.

## NestJS API

```text
apps/api/
├── prisma/
│ ├── schema.prisma # Contains only generator and datasource
│ ├── enums.prisma # Shared enumerations across models
│ ├── models/ # Prisma multi-file schema, one model and one file
│ └── migrations/ # Historical migration that cannot be rewritten at will
├── test/
│   ├── unit/
│   ├── integration/
│   ├── e2e/
│   └── fixtures/
└── src/
    ├── config/ # Configuration and env validation
    ├── common/
    │   ├── decorators/
    │   ├── guards/
    │   ├── filters/
    │   ├── interceptors/
    │   ├── pipes/
    │   └── errors/
    ├── infrastructure/
    │   ├── database/
    │   ├── redis/
    │   ├── livekit/
    │   ├── oauth/
    │   └── observability/
    └── modules/
        ├── auth/
        ├── users/
        ├── profiles/
        ├── rooms/
        ├── voice/
        ├── moderation/
        └── audit/
            ├── presentation/
            │   └── dto/
            ├── application/
            │   ├── commands/
            │   ├── queries/
            │   └── services/
            ├── domain/
            │   ├── entities/
            │   ├── value-objects/
            │   ├── policies/
            │   ├── events/
            │   └── ports/
            └── infrastructure/
```

The internal structure of the module is shown above with `audit/`; the directory skeleton creates the same hierarchy for each listed module. During formal implementation, simple modules can delete useless empty layers, and only complex modules retain complete layering.

### Backend Dependency Direction

```text
presentation -> application -> domain
infrastructure -------------> domain ports
```

- Controller does not use Prisma, Redis, LiveKit or OAuth SDK directly.
- Domain does not rely on NestJS, Prisma, HTTP DTOs, provider SDKs, or environment variables.
- `common` only accepts cross-module technical mechanisms and prohibits the release of domain rules.
- Call the public application API across modules and do not deeply import the repository or internal services.

## Shared Packages

### `packages/api-client`

```text
packages/api-client/
├── src/
│ └── generated/ # Generated from openapi/openapi.yaml
└── test/                    # contract/client smoke tests
```

- Generated files cannot be modified manually.
- DTO, enum, or endpoint path is not copied within the application.
- When the API contract has not been approved, the directory remains empty and no placeholder client is generated.

### `packages/shared`

```text
packages/shared/
├── src/
│ ├── types/ # Shared types of pure TS, non-API DTO
│ ├── utils/ # Pure function
│ └── validation/ # Shared verification without platform dependency
└── test/
```

Reliance on React, React Native, NestJS, Prisma, LiveKit, DOM, Node-only runtime, or environment variables is prohibited. UI, server entities and provider adapters must not enter this package.

## Naming

- React component：`PascalCase.tsx`。
- Hook: `useSomething.ts`, starting with `use`.
- NestJS：`kebab-case.controller.ts`、`*.service.ts`、`*.module.ts`、`*.repository.ts`。
- DTO: `create-room.dto.ts` and other names with clear operation meaning.
- Test: `*.spec.ts(x)` co-located with source, or applied by level `test/`; Playwright uses `*.e2e.spec.ts`.
- `index.ts` of Feature/module only exposes the stable public API and does not recursively export all internal files.

## Import Rules

- Use workspace/package alias to express common boundaries and prohibit cross-application relative path imports.
- An application may not import another application's `src/`.
- Cross feature/module does not deeply import internal directories.
- `packages/shared` does not depend on any app; `packages/api-client` only relies on the lightweight runtime required for generation.
- Redigate ownership when circular dependencies are found, without masking them with barrel or `forwardRef`.

## Test Placement

- Component, Hook, and pure function tests are placed close to source files for easy identification of ownership.
- NestJS domain/application uses unit testing, repository/provider uses integration test, and HTTP permissions and complete process use e2e.
- Root `tests/e2e` is used for cross-app or PC Playwright user flows; in-app `test/` holds setup, helpers, and app-level fixtures.
- Physical device permissions, microphone, front and backend, system language and network reconnection must be supplemented with mobile runtime evidence.

## Skeleton Rule

- This time, all empty directories are reserved as `.gitkeep`, and no empty classes, placeholder components, fake APIs or package manifests are created.
- Delete the corresponding `.gitkeep` after the real file enters the directory.
- If the implementation determines that a layer has no responsibilities, it should delete the empty layer through the corresponding change and maintain the directory appearance without meaningless code.
- Directory skeletons are not evidence of implemented capability, successful compilation, or deployability.
