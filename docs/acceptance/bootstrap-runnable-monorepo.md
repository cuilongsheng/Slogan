# Bootstrap Runnable Monorepo Evidence

Status: ready for user acceptance review.

## Scope Boundary

- Product requirements and `PRD_V1.md`: unchanged.
- Figma/product UI: not used; smoke screens are engineering evidence only.
- Public API/OpenAPI/generated client: not created.
- PostgreSQL, Redis, LiveKit, authentication, STT, AI and deployment: not implemented.

## Version Evidence

- Node.js baseline: 24.21.0 LTS.
- pnpm baseline: 12.3.4.
- Expo SDK 57 official template was inspected to align React 19.2.3, React Native 0.86.3,
  TypeScript 6.0.3 and Expo package versions.

## Verification Results

Verified on 2026-09-09 with Node.js 24.21.0 and pnpm 12.3.4.

| Evidence                                            | Result                                                                                               |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `pnpm list --depth -1 -r`                           | PASS: root plus exactly five private workspaces                                                      |
| Five `pnpm --filter <package-name> exec pwd` checks | PASS: every workspace is independently selectable                                                    |
| `pnpm peers check`                                  | PASS: no peer dependency issues                                                                      |
| Clean `pnpm install --frozen-lockfile`              | PASS: lockfile resolution skipped and 1091 packages restored                                         |
| Workspace manifest audit                            | PASS: no deferred package, duplicate package name or invalid internal range                          |
| `pnpm format:check`                                 | PASS: all managed source and configuration files are formatted                                       |
| `pnpm deps:check`                                   | PASS: 35 modules and 29 dependencies, no violations                                                  |
| Controlled admin-to-API dependency fixture          | EXPECTED FAIL: `no-admin-to-other-apps` detected the import; fixture then removed                    |
| `pnpm lint`                                         | PASS                                                                                                 |
| `pnpm typecheck`                                    | PASS: admin, mobile, API and shared                                                                  |
| `pnpm test`                                         | PASS: admin 1, mobile 1, API 2 and shared 1 tests                                                    |
| `pnpm build`                                        | PASS: admin Vite build, mobile iOS export, API Nest build and shared TypeScript build                |
| `pnpm test:e2e`                                     | PASS: Chromium opened the admin route, checked bootstrap content and found no browser console errors |
| `pnpm verify` after clean install                   | PASS in the required order through Playwright                                                        |
| `pnpm dev:api`                                      | PASS: watch compilation had zero errors and Nest application started; then stopped manually          |
| `CI=1 pnpm dev:mobile`                              | PASS: Expo Router project started Metro on port 8081; then stopped manually                          |
| `pnpm dlx expo-doctor@1.20.4 apps/mobile`           | PASS: 21/21 checks                                                                                   |

The API bootstrap test proves valid configuration can initialize and close without an external
service, and that missing `APP_NAME` is rejected. Source inspection confirms there is no
controller or public endpoint. `openapi/openapi.yaml` and generated API-client source do not
exist.

Representative `.gitignore` checks passed for dependency folders, build output, coverage,
Playwright output, local environment files and Expo caches. The same check confirmed that the
lockfile, OpenSpec files, rules and test fixture paths are not ignored. `apps/api/.env.example`
is explicitly retained.

The final direct dependency-to-responsibility mapping is recorded in
`docs/architecture/toolchain.md`. The workspace audit and successful strict-pnpm builds provide
evidence that no app relies on an undeclared root runtime dependency. Packages documented as
adopt-on-trigger or deferred remain uninstalled.

## Known Tooling Note

NestJS 12 publishes ESM packages. The API therefore uses TypeScript `NodeNext`; Jest 29 runs its
ESM bootstrap test with Node's `--experimental-vm-modules` flag and emits the corresponding Node
warning while the test passes. This is a tooling warning, not a suppressed test failure.

## Explicitly Not Verified

- No iOS or Android real-device acceptance was performed.
- No microphone, permissions, networking or audio behavior exists to verify.
- No remote CI provider was configured or executed.
- No deployment or production release was performed.
- No product requirement, product visual or product acceptance claim is made by these smoke
  shells.
