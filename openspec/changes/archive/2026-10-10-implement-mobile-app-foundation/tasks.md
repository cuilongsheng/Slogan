## 1. Front-end consumption boundary of unique API contract

- [x] 1.1 Fixed generator and fetch client dependencies in `packages/api-client`, added build and drift check commands; verify dependencies and input paths are available through `pnpm install --frozen-lockfile` and build commands.
- [x] 1.2 Generate a read-only TypeScript contract from the current `openapi/openapi.yaml`, providing a typed client public factory; verify that paths, parameters and responses come from the contract via type checking of the generator `--check`, package typecheck and a known endpoint.

## 2. Mobile access and evidence

- [x] 2.1 Add the `apps/mobile/src/api` entry and generate the client through the workspace package reference. Do not write requests or copy DTO in the route; pass the mobile terminal typecheck and dependency boundary check verification.
- [x] 2.2 Record the API address configuration and generation/checking method, and clarify the boundaries between the current project page, session and business UI; check the path/command in the document and verify with `git diff --check`.
- [x] 2.3 Run affected scope format, lint, typecheck, relevant tests, build, dependency boundaries, build drift, and OpenSpec strict validation on final changes; note actual results and pending runtime/device validation in acceptance records.
