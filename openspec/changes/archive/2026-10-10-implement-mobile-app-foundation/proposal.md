## Why

The mobile terminal is still the project startup page, and `packages/api-client` only has an empty directory. It is not yet possible to safely develop real business pages with a unique OpenAPI contract. First establish a client boundary that can be generated repeatedly and can check drift. Subsequent login, room and voice changes can be accessed to the same contract in batches.

## What Changes

### Confirmed scope

- Generate type from `openapi/openapi.yaml` without handwriting endpoint, DTO or enumeration copy.
- Provides a lightweight, typed client factory in `packages/api-client` that can inject `fetch` and base URLs, as well as deterministic build and drift checking commands.
- The mobile terminal consumes the package through its own `src/api` entrance, and reserves the location for the next batch of login changes to be injected into the authentication and session life cycle.
- Keep the current project startup page and verify that the generated client can be referenced by the Expo/TypeScript project; do not disguise pages without API calls as business delivery.

### Non-goals

- This change does not implement login, information, i18n product copy, rooms, LiveKit or management pages; these are respectively subject to subsequent frontend changes.
- Do not modify the backend business implementation or `openapi/openapi.yaml`, do not write static success data or maintain the second interface contract.

### Roadmap and unresolved decisions

- The secure session storage and refresh strategy is designed and implemented with `implement-mobile-auth-profile`; the first real API page is then connected to the query cache and localization library.
- The confirmed Figma vision will be mapped to the precise frame, status and device size in each specific page change. The base of this project does not declare the completion of visual acceptance.

## Capabilities

### New Capabilities

None. This change only establishes the basis for code generation and application access, and does not add new product demand scenarios; `.openspec.yaml` sets `skip_specs: true`.

### Modified Capabilities

None.

## Impact

- Affected stages: Architecture, Frontend, Test/Acceptance.
- Code range: `packages/api-client/`, `apps/mobile/src/api/`, mobile dependency list and related generation scripts; does not touch currently uncommitted backend changes.
- Verification: reproducible generation results, contract change detection, mobile terminal typecheck/lint/test/build and dependency boundary checking. Runtime login and physical device voice evidence are left to the corresponding business change.
