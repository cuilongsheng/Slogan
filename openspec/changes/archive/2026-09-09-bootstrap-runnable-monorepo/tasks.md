## 1. Runtime and Workspace baseline

- [x] 1.1 Determine the precise versions of compatible Node LTS, pnpm and adopt-now frameworks according to the official support scope of React/Vite, Expo, NestJS, Playwright; record the responsibilities, reasons and triggers in `docs/architecture/toolchain.md` by `adopt-now`, `adopt-on-trigger`, `deferred`, `rejected`, and verify the adopt-now version with follow-up The manifests and version files are consistent.
- [x] 1.2 Create root `package.json`, `pnpm-workspace.yaml`, `.npmrc`, Node version files and `tsconfig.base.json`, verify that `pnpm list --depth -1 -r` only finds five workspaces in the plan and all packages are private.
- [x] 1.3 Create `package.json` and platform-level TypeScript configurations for five workspaces, verify that each workspace can be accurately selected by `pnpm --filter <package-name>`, and there are no cross-app relative paths or root-level implicit run dependencies.
- [x] 1.4 Install approved dependencies and generate unique `pnpm-lock.yaml`. After deleting `node_modules`, verify that `pnpm install --frozen-lockfile` can rebuild the same dependency graph.
- [x] 1.5 Audit root and five workspace manifests, verify that adopt-on-trigger/deferred technology has not been installed in advance, there is no Axios/fetch client for the same responsibility, or multiple status/style schemes coexist, and the audit results are recorded as acceptance evidence.

## 2. Shared Packages

- [x] 2.1 Create pure TypeScript public entry, `exports`, build/typecheck/test scripts for `packages/shared`, verify that its build and tests pass and that the dependency graph does not contain React, React Native, NestJS, DOM or Node-only runtime.
- [x] 2.2 Establish a private package and generation boundary for `packages/api-client`, verify that `src/generated` remains ungenerated, has no placeholder DTO/endpoint, and no app depends on this package.

## 3. PC Admin Bootstrap

- [x] 3.1 Configure React + TypeScript + Vite + React Router + Tailwind CSS in `apps/admin`, create minimum entry and semantic theme tokens according to the existing `app/router -> views -> features` boundary, and verify routing, Tailwind Vite integration, `pnpm --filter @slogan/admin build` and typecheck successfully.
- [x] 3.2 Create an admin smoke page clearly marked as project bootstrap, without adding product status, static business data or unapproved visual design, verify that the development server can be opened and there are no startup errors in the browser console.
- [x] 3.3 Configure Vitest and React Testing Library, add minimum rendering test, and verify that `pnpm --filter @slogan/admin test` can pass repeatedly.

## 4. Mobile Bootstrap

- [x] 4.1 Configure React Native + Expo + Expo Router in `apps/mobile`, and maintain the boundary between top-level `app/` and `src/features`/`src/services`; establish a minimum style entry of StyleSheet + semantic tokens, verify that Expo Router can parse the minimum route, NativeWind is not installed and typecheck passes.
- [x] 4.2 Create a mobile smoke route clearly marked as project bootstrap, do not add rooms, permissions or microphone fake implementations, verify that Expo startup checks and unsigned bundle/export checks are successful, and log this as runtime evidence rather than physical device product acceptance.
- [x] 4.3 Configure Expo-compatible Jest and React Native Testing Library, add minimum rendering test, and verify that `pnpm --filter @slogan/mobile test` can pass repeatedly.

## 5. NestJS API Bootstrap

- [x] 5.1 Configure NestJS + TypeScript + Express adapter in `apps/api`, create a minimal modular monolith entry that only contains bootstrap, `AppModule`, `@nestjs/config` and Zod environment verification, verify that build and typecheck are successful and no business controller, database, Redis or provider is initialized.
- [x] 5.2 Configure the Jest application startup test to verify that the Nest application can init/close in a legal environment, fails to start when required configuration is missing, and `pnpm --filter @slogan/api test` does not require a database or external services.
- [x] 5.3 Check API boundaries, verify that this change does not create a public endpoint, `openapi/openapi.yaml`, generated client or second set of DTOs, and record the results in acceptance evidence.

## 6. Automation engineering constraints

- [x] 6.1 Create the root ESLint flat config and the necessary overrides for each platform. Verify that the root `pnpm lint` covers admin, mobile, api and shared and has no cross-platform parsing errors.
- [x] 6.2 Configure `dependency-cruiser` to enforce app-to-app, package-to-app, shared platform dependency, cross-feature/module deep import and circular dependency rules; verifying the rules with the minimum controlled violation fixture will fail, then remove the fixture and verify that `pnpm deps:check` passes.
- [x] 6.3 Create Prettier configuration and `format`/`format:check` commands, verify that check mode does not modify files and takes effect for all managed source code and configurations.
- [x] 6.4 Create `.gitignore` with secure environment variable example policy, verifying that dependencies, build artifacts, coverage, Playwright reports, local env and Expo cache are overridden by ignore rules, while lockfile, OpenSpec, rules and fixtures are not excluded.
- [x] 6.5 updates the stable boundaries directly related to adopt-now technology in `rules/admin.md`, `rules/mobile.md` and `rules/backend.md`. The verification rules are consistent with `docs/architecture/toolchain.md` and manifests, and the complete dependency list or deferred technology is not copied into the rules.

## 7. Testing, unified command and acceptance

- [x] 7.1 Configure Playwright at the root, start the admin smoke app through `webServer` and add browser E2E, verify that `pnpm test:e2e` passes in Chromium and generates a diagnostic report when it fails.
- [x] 7.2 Create root `dev:admin`, `dev:mobile`, `dev:api`, `lint`, `typecheck`, `deps:check`, `test`, `build` and `verify` scripts, and verify that each command can be executed independently and there is no pseudo-check like `echo success`.
- [x] 7.3 Connect `pnpm verify` to `format:check -> deps:check -> lint -> typecheck -> test -> build -> test:e2e`, execute and log PASS/FAIL at each step from a clean installation state, and do not report unexecuted physical device, CI or deployment checks as PASS.
- [x] Updated development documentation for 7.4 to list installation, three-terminal boot, single workspace filtering, full verification, and Playwright browser preparation commands; executed once by new terminal as documented and verified without undocumented global tools.
- [x] 7.5 Generate the final dependency list and correspond to the responsibilities of `docs/architecture/toolchain.md` one by one. Verify that there are no undeclared direct dependencies, no consumer dependencies, duplicate responsibility libraries, or adopt-on-trigger/deferred technologies that are falsely reported as implemented.
- [x] 7.6 Run `openspec validate bootstrap-runnable-monorepo --strict`, check that the changes only affect Architecture and Test / Acceptance, `skip_specs=true`, and no business requirement/API/Figma/release status changes, and submit them to the user for acceptance review.
