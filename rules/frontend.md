# Frontend Rules

## Architecture

- Both desktop admin and mobile use a feature-first structure. Organize code by business capability rather than placing all business code in global directories by file type.
- Routes compose pages and features; they do not own complex business rules, network requests, or persistent state.
- Cross-feature dependencies must use the target feature's public entry point. Do not import another feature's internal files directly.
- Dependencies flow `route/view -> feature -> shared frontend infrastructure`. Features must not depend on routes or views.
- Resolve circular dependencies by redefining ownership, extracting ports, or moving pure shared logic. Do not hide them behind barrels, path aliases, or runtime tricks.

## Directory Ownership

- `api/`: HTTP client configuration, authentication injection, error mapping, and the generated OpenAPI client. Business request orchestration belongs to its feature.
- `features/<domain>/api/`: compose the generated client for a business capability; do not redefine endpoints or DTOs.
- `features/<domain>/components/`: UI specific to that business domain.
- `features/<domain>/hooks/`: state and interaction orchestration specific to that domain.
- Root `components/`: UI primitives shared by at least two features, without domain rules.
- Root `hooks/`: technical hooks shared by at least two features; business hooks stay in their feature.
- Root `types/`: genuinely cross-feature frontend types; never duplicate OpenAPI DTOs or backend domain models.
- Root `utils/`: deterministic, stateless pure functions without networking or business workflows.
- Root `styles/`: global reset, theme, tokens, and fonts; colocate local styles with components.
- Do not create a global `interfaces/` directory. Types belong with their owning API, feature, or module.

## API Contract

- `openapi/openapi.yaml` is the sole API contract. Frontends consume generated output through `packages/api-client` or application-local `api/generated/`.
- Never edit generated files manually. Pages and components must not concatenate URLs, call raw `fetch`, or maintain a second set of API types.
- Architecture decides between API-first and NestJS code-first generated OpenAPI; the single frontend consumption boundary remains the same.
- Label missing APIs `MISSING/PARTIAL/BLOCKED`. Never disguise incomplete work with static success data unless the user explicitly approves a mock.

## Components and State

- Components receive only the data and callbacks needed for rendering and interaction. Features handle domain permissions and state transitions.
- Handle applicable asynchronous states explicitly: loading, success, empty, permission denied, recoverable error, and offline/reconnecting.
- Manage server state, local UI state, and form state separately. Do not copy server caches into a global client store.
- Shared component changes must remain backward compatible or update all consumers in the same change.

## Visual and Localization

- Figma owns visual truth; OpenSpec owns behavior. Do not infer missing business rules from Figma.
- Use semantic tokens rather than scattering arbitrary colors, spacing, font sizes, radii, or shadows throughout business components.
- User-visible text belongs in i18n. Do not mix unmanaged Chinese and English constants in business components.
- Level 1/2 UI changes involving Figma and APIs must use `$figma-to-frontend`.

## Verification

- Run at least the existing project lint, typecheck, relevant tests, and build.
- Tests/CI provide verification evidence; visual, runtime, and device behavior still require the corresponding evidence.
- Never report unexecuted checks as PASS. Distinguish newly introduced failures from existing failures and environment blockers.
