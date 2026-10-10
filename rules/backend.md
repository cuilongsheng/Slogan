# Backend Rules

## Stack and System Shape

- Use NestJS, TypeScript, and the Express adapter as a modular monolith. Do not switch to Fastify without load or compatibility evidence, or split microservices without a separate Architecture change.
- Use `@nestjs/config` and validate configuration with Zod during bootstrap. Missing or invalid required configuration must prevent startup.
- PostgreSQL owns durable facts. Redis supports temporary coordination, presence, rate limiting, caching, queues, and atomic concurrency protection; it does not replace database facts.
- `openapi/openapi.yaml` is the sole published API contract. Architecture chooses API-first or NestJS code-first generation when implementing the first APIs. Never maintain two contracts.

## Top-level Ownership

- `src/config/`: configuration registration, environment parsing, and startup validation, without domain rules.
- `src/common/`: cross-module technical mechanisms such as decorators, guards, filters, interceptors, pipes, and base errors.
- `src/infrastructure/`: global adapters for databases, Redis, LiveKit, OAuth, and observability.
- `src/modules/<domain>/`: application and domain behavior organized by business domain, such as auth, users, profiles, rooms, voice, moderation, and audit.
- `prisma/schema.prisma`: generators and datasource only; do not accumulate models or enums here.
- `prisma/models/*.prisma`: Prisma multi-file schema, with one model per file. Shared enums belong in `prisma/enums.prisma`.
- `prisma/migrations/`: historical migrations that must not be casually rewritten. Prisma models are not cross-layer domain models.

`common` and `infrastructure` must not become dumping grounds for ownerless business code. Code without a clear consumer and dependency direction remains in its owning module.

## Module Layers

Complex modules use:

```text
presentation -> application -> domain
infrastructure -> domain ports
```

- `presentation/`: controllers, transport DTOs, parameter parsing, and protocol error mapping.
- `application/`: use cases, transaction boundaries, command/query orchestration, and port calls.
- `domain/`: entities, value objects, policies, invariants, domain events, and repository/service ports.
- `infrastructure/`: Prisma repositories, LiveKit/OAuth/external-service adapters, and module wiring.

Domain code does not depend on NestJS, Prisma, Redis, LiveKit, HTTP DTOs, or environment variables. Infrastructure may depend on domain ports; domain code must not depend on their implementations.

## Controller and Service Boundaries

- Keep controllers thin: protocol handling, DTOs, identity context, and application calls only.
- Controllers must not call Prisma, Redis, LiveKit SDKs, OAuth SDKs, or other external providers directly.
- Application services do not return HTTP Responses or transport-specific exceptions. Presentation maps results to the protocol.
- Enforce room capacity, eligibility, host transfer, removal/reentry, and sanction invariants in server-side domain/application layers.
- Prefer the target module's public application API for cross-module calls. Do not import its repositories or internal services directly.

## DTO, Types, and Contracts

- Transport DTOs reside in the endpoint owner's presentation layer and match the sole OpenAPI contract.
- Do not create a global `interfaces/` directory. Interfaces belong with their owning port, module, or provider.
- Frontends must not consume Prisma types directly. Cross-client API types come from the generated API client.
- Explicitly convert between domain enums/value objects and transport enums; do not rely on accidentally identical strings.

## External Providers

- Integrate LiveKit, OAuth, STT, AI, and other services through adapters. Extract ports only for real substitution, testing, or isolation needs.
- LiveKit client tokens are short-lived, room-scoped, and minimally privileged. Never send platform administration credentials to clients.
- Removed, restricted, or post-room users cannot regain eligibility through old tokens, delayed webhooks, or direct API calls.
- Verify webhook sources and handle duplicate events by provider event ID or a business idempotency key.

## Security and Observability

- Validate identity, roles, and room invariants on the server, including direct requests that bypass the UI.
- Record actor, target, reason, time, and result for moderation or privileged actions. Exclude passwords, secrets, phone numbers, full private audio, and unnecessary transcriptions from logs.
- Return stable error codes to clients and record diagnostic context internally. Never expose stacks, SQL, or provider secrets.

## Structure Growth Rules

- The complete directory skeleton was created at the user's request; do not fill it with empty classes, services, or placeholder repositories.
- Simple modules may initially contain only a module, controller, service, and DTOs. Activate layers when domain invariants, multiple use cases, or provider/repository ports justify them.
- Each abstraction must solve a real current boundary. Do not prebuild code for hypothetical microservices, a second database, or future providers.
- Resolve circular dependencies by redefining module ownership or introducing ports. `forwardRef` is not the default solution.

## Verification

- Prefer fast unit tests for domain invariants, integration tests for repositories/providers, and end-to-end tests for key HTTP permissions and workflows.
- Database migrations require upgrade validation and rollback/recovery guidance proportionate to risk.
- Verify failure paths for capacity concurrency, idempotency, authorization bypass, and old-token reentry, not only happy paths.
