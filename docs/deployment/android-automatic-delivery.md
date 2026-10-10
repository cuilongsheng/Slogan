# One PR for frontend, backend, and Android delivery

User authorization date: 2026-10-08. The configuration reuses `cuilongsheng/Slogan` and existing provider projects.

| Configuration                 | Target and trigger                                                                                                                                                                                         |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vercel `slogan-api`           | Root `apps/api`; branch pushes create previews and main creates production deployments. The standalone `api/realtime.ts` Queues consumer is deployed with the public API.                                  |
| Pages `slogan-preview-admin`  | `pnpm build:pages:admin`, output `apps/admin/dist`; main is production.                                                                                                                                    |
| Pages `slogan-preview-mobile` | `pnpm build:pages:mobile`, output `apps/mobile/dist-pages`; main is production.                                                                                                                            |
| GitHub Actions                | `.github/workflows/android-delivery.yml`; same-repository PRs, codex branches, main pushes, and manual dispatch.                                                                                           |
| Android                       | Node 24.21.0 / pnpm 12.3.4 / Java 21, SDK/build-tools 36, NDK 27.1.12297006; Android-only Expo prebuild and arm64 assembleRelease.                                                                         |
| Version                       | `versionName=0.0.<run_number>`, `versionCode=1000+run_number`; embedded public commit/API metadata.                                                                                                        |
| Signing                       | Reuse the controlled installation certificate with a fixed fingerprint. A mismatch blocks publication. This is not a store production key.                                                                 |
| Release gate                  | All three main deployments must succeed. The actual API response header and both Pages release.json files must match the commit. Confirm main has not moved, upload a complete draft, then publish latest. |
| Artifact storage              | GitHub Releases; one `android-<sha>` tag per full commit, containing the APK, `android-release.json`, and `SHA256SUMS`.                                                                                    |
| Stable address                | `https://slogan-preview-mobile.pages.dev/downloads/android.apk`; `.json` metadata and `/downloads/android` version details.                                                                                |

## Usage

The backend uses Vercel Git integration for automatic deployment. Configure `slogan-api → Settings → Git / Build and Deployment` with repository `cuilongsheng/Slogan`, Root Directory `apps/api`, Framework Preset `NestJS`, and Production Branch `main`. The API build script is `prisma generate && nest build`. Assign environment variables to Production and Preview according to their purpose; changes require redeployment. Pushing a non-main branch creates Preview, while merging its PR into main creates Production without a manual Deploy action. Reference: [Vercel Git deployments](https://vercel.com/docs/git).

This does not include automatic database migrations. `prisma generate` generates the client; it does not migrate the database. Production deployment does not automatically run `prisma migrate deploy`. Schema-changing releases require a backup and compatible migration before deploying APIs that depend on the new schema. The Android release gate checks deployment commits and cannot replace migration.

Opening a PR starts preview deployments and APK builds. The PR package is available as an Actions artifact and uses the existing production API. It must not be described as a fully usable new-contract package before the main production release is complete. After merge, an APK matching the production commit is built and published at the stable download address. The user installs it for device verification.

Cloudflare Pages limits individual files to 25 MiB, while the current APK is approximately 85 MB. The site therefore serves a stable redirect, and GitHub Releases stores the APK. APKs are not committed to Git, and no R2 token is requested. Download redirects handle only GET/HEAD, use a fixed target, and never forward session cookies or bearer tokens.

## Permissions and failure handling

The build job has only contents:read. The publish job runs only on main and uses GitHub's current GITHUB_TOKEN with contents:write/checks:read/statuses:read. It does not use long-lived personal tokens, expose database/provider/signing secrets to PRs, or use pull_request_target. Actions are pinned to official release commits; Gradle uses basic caching.

Deployment failure, cancellation, timeout, production-commit mismatch, signing mismatch, or main advancing before an older build finishes all prevent latest from updating. Failed draft uploads can be rerun; an already published Release for the same commit is not overwritten. Provider Git integrations deploy independently, so this is not an atomic release transaction. Migrations must remain compatible with old and new APIs; the download gate prevents publication of a mismatched APK.

The four migrations in this delivery were backed up and completed successfully; no repeated initialization is required. Future schema changes still require backup and compatible migration against an explicit target. Opening an arbitrary PR must not run production migrations, and this workflow does not store the production DATABASE_URL.

## Verification boundaries

Local verification does not replace actual Actions runs, public downloads, cloud queue execution, or device audio. The first online release must record the PR/main SHA, Actions run, all three deployments, Release URL, and download hash. Device testing is performed by the user. Google remains disabled; iOS and store releases are outside this delivery's scope.

References: [Cloudflare file limits](https://developers.cloudflare.com/pages/platform/limits/), [GitHub workflow triggers](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow), [Expo local builds](https://docs.expo.dev/build-reference/local-builds/).
