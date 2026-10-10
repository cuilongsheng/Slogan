## Context

The project currently only has requirements, OpenSpec, rules and workflow, and no front-end or back-end engineering. The existing `rules/frontend.md` and `rules/backend.md` only provide high-level constraints, which are not enough to constrain future directory responsibilities and module dependencies. This change improves the architecture rules and catalog documentation, and creates a complete catalog skeleton without business code.

## Goals / Non-Goals

**Goals:**

- Define different but consistent module organization methods for PC admin, mobile and NestJS backend.
- Clarify the responsibilities and dependency directions of `api`, `hooks`, `utils`, `types`, `styles`, `views`, and `components`.
- Keep single-person projects achievable and explainable while allowing real complexity to grow.
- Prevent cross-end UI sharing, DTO duplication maintenance, global tool directory and public modules from getting out of control.

**Non-Goals:**

- No workspace configuration, package manifest, runtime code, or business implementation is created; only the directory and `.gitkeep` are created.
- API-first and NestJS code-first are not selected; it is still determined by the Architecture change that implements the API.
- No introduction to Nx, Turborepo, microservices, event bus or full DDD ceremony.
- Do not change product requirements and baseline migration classification.

## Decisions

### Decision: pnpm monorepo as target project form

The target top-level structure is:

```text
apps/mobile
apps/admin
apps/api
packages/api-client
packages/shared
```

`packages/config` and other packages can only be created after a second real consumer appears. Currently creating the identified `apps/*`, `packages/api-client` and `packages/shared` directory skeletons. Nx/Turborepo will not be introduced yet; pnpm workspace is sufficient to complete the current scale of dependency and script organization.

The alternative is three independent repositories. It will increase the cost of OpenAPI client, unified checking and atomic changes, and is not suitable for the current single-person, same product development method.

### Decision: Both PC and mobile terminals use feature-first, but the routing and device layers are different

Common rules:

- `api/` only includes transport layer infrastructure, error mapping and client generation; the business request combination is placed in the corresponding feature.
- `features/<domain>/` holds business components, feature hooks, states and API combinations.
- The root `components/` only contains a common UI that spans businesses and has no domain rules.
- The root `hooks/` only contains technical Hooks used by multiple features.
- The root `types/` only puts the front-end global type and does not copy the OpenAPI DTO.
- The root `utils/` only contains stateless pure functions and cannot hide business processes or network requests.
- `styles/` only puts the global reset, theme, and tokens; the component style is co-located with the component.

The PC admin app uses `views/` to express route-level pages and `layouts/` to express shells, focusing on supporting tables, filters, forms and permission statuses.

On the mobile terminal, `app/`, the top layer of Expo Router, is responsible for file routing, and business implementation is located at `src/features/`; platform capabilities such as microphone, permissions, secure storage, language environment, and real-time connection are located at `src/services/`.

Do not share React DOM and React Native UI components. Allows sharing of OpenAPI clients, pure TypeScript validation, and platform-free data transformations.

The alternative is to tile all code according to the `components/hooks/utils` technology type. This method is simple at the beginning, but after the business grows, cross-module boundaries are not visible, so it is not used.

### Decision: NestJS uses modular monolith

The top-level backend structure adopts:

```text
src/config
src/common
src/infrastructure
src/modules/<domain>
```

- `config` is responsible for configuration loading and environment verification.
- `common` Only put cross-module technical mechanisms, such as guards, filters, interceptors, pipes, decorators and basic errors; no rooms or audit business rules.
- `infrastructure` puts global adaptation facilities such as database, Redis, LiveKit, OAuth and observability.
- `modules` is organized by business domains, such as auth, users, profiles, rooms, voice, moderation, and audit.

The complex module adopts the following dependency direction internally:

```text
presentation -> application -> domain
infrastructure -> domain ports
```

- presentation handles controller, DTO and protocol mapping.
- application orchestrates use cases, transactions and cross-port calls.
- domain holds entities, value objects, policies, domain events, and repository ports.
- infrastructure implements Prisma repository or external service adapter.

Simple modules can remain flat when implemented, but the controller must not call Prisma, Redis or LiveKit directly. This time, a complete module directory skeleton is created according to user requirements; if a module is later confirmed to not require a certain layer, the corresponding empty directory should be deleted in the implementation change instead of filling in meaningless code.

The alternatives are to adopt microservices from day one or to fully replicate the Clean Architecture for each module. The former increases distributed complexity, while the latter generates a large number of ceremonies. Neither of them is currently used.

### Decision: Shared code must pass boundary filtering

- `packages/api-client` is generated or derived from a unique OpenAPI contract, and consumers are not allowed to modify the generated results.
- `packages/shared` only accepts pure TypeScript code without React, React Native, NestJS, Prisma, LiveKit and environment dependencies.
- Do not create `shared-ui`; PC and mobile terminals maintain their own UI primitives respectively.
- Do not create global `interfaces/`. Types are placed by owner: API types come from generated client, domain types are placed in feature/module, and truly global types are placed at the root `types/`.

### Decision: Cross-module import takes the public entrance

feature/module exposes the minimum public API. Other modules must not deep import their internal components, repositories, or implementation files. Circular dependencies must be resolved by repartitioning ownership, extracting ports, or moving pure shared logic, without using `forwardRef` as the default means.

### Decision: Rules and examples are maintained separately

- `rules/frontend.md` saves PC/mobile common enforced boundaries.
- `rules/admin.md`, `rules/mobile.md` save platform-specific rules.
- `rules/backend.md` saves NestJS modules and dependency constraints.
- `docs/architecture/project-structure.md` preserves the complete directory tree, description of responsibilities and creation-on-demand principles.
- `AGENTS.md` is only responsible for routing to the corresponding rules according to the target and does not copy the full text.

## Risks / Trade-offs

- [Risk] The complete catalog skeleton seems too much in the first version. → The skeleton only uses `.gitkeep` and does not generate placeholder implementations; delete the unnecessary empty levels when formally scaffolding, and simple features/modules can still remain flat.
- [Risk] `common`, `shared`, `utils` become a dump again. → It is required not to move to the public directory without clear two consumers or clear ownership.
- [Risk] PC and mobile versions have duplicate visual components. → Accept platform UI differences, only share the semantics and pure logic of tokens, and do not force sharing of rendering code.
- [Risk] application/domain layering may be misinterpreted as full DDD. → Only used in modules with complex rules such as rooms, voice, moderation, etc., and other modules keep the minimum structure.
- [Risk] The OpenAPI generation method is undecided. → The rules only fix the unique output and consumption boundaries, leaving the generation method to subsequent API Architecture changes.

## Migration Plan

1. Update common front-end and back-end rules, and add mobile/admin rules.
2. Create `docs/architecture/project-structure.md`, documenting target structure and responsibilities.
3. Update the rule routing of `AGENTS.md`.
4. Creates the documented `apps/`, `packages/` and test directory skeletons, leaving the empty directory for `.gitkeep`.
5. Verify that there are no conflicts between documents, and confirm that there are no business implementations or unapproved contracts in the directory skeleton.

Rollback only requires restoring the above rules and architecture documents; there is no business data, API or runtime migration for this change.
