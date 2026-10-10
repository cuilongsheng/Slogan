# Deployment Runbook

The repository's delivery path is Vercel for the NestJS API and managed realtime consumer, Cloudflare Pages for the admin and mobile web clients, and GitHub Actions / Releases for Android. The earlier Render deployment proposal has been retired. This guide describes the source configuration; dated [release records](../releases/README.md) establish what was verified in a particular environment.

## Application delivery

| Target       | Source configuration                                                                   | Output / release trigger                                                               |
| ------------ | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Vercel API   | Project root `apps/api`; `prisma generate && nest build`                               | Branch previews; production from `main`                                                |
| Admin Pages  | `pnpm build:pages:admin`                                                               | `apps/admin/dist`; production from `main`                                              |
| Mobile Pages | `pnpm build:pages:mobile`                                                              | `apps/mobile/dist-pages`; production from `main`                                       |
| Android      | [.github/workflows/android-delivery.yml](../../.github/workflows/android-delivery.yml) | PR / branch artifacts; publish from `main` after the production deployment gate passes |

Build from the lockfile and source. Generated Web/iOS exports, native prebuild directories, APKs, and environment files do not belong in Git. The APK download entry redirects to GitHub Releases; it does not store the APK inside Pages.

For both Pages projects, configure Production and Preview separately:

- Admin: `VITE_API_BASE_URL=https://slogan-preview-admin.pages.dev`.
- Mobile: `EXPO_PUBLIC_API_BASE_URL=https://slogan-preview-mobile.pages.dev`.
- Both: `API_UPSTREAM_ORIGIN=https://slogan-api-pi.vercel.app`.

Each frontend's public API base is its own full HTTPS origin. The packaged Pages worker forwards `/v1/*` to the approved backend, preserving same-origin browser sessions. The build disables automatic dotenv loading. Environment changes take effect on a new deployment. These fixed public origins describe the existing project configuration, not a promise of isolated PR accounts or a branch-specific backend.

The API uses its own environment configuration, including browser-origin allowlists, database, Redis, session signing, and LiveKit. Consult [apps/api/.env.example](../../apps/api/.env.example) and the [controlled-account runbook](../preview-accounts-runbook.md); never commit real credentials. Keep Google's enabled state aligned with the approved product scope rather than enabling it as part of release housekeeping.

## Database and realtime release order

1. Identify the target database and take a recoverable backup before a schema change.
2. Apply the committed incremental Prisma migrations using the migration connection. `prisma generate` does not apply migrations, and the APK workflow does not migrate production.
3. Deploy an API that remains compatible with clients still in use. For cleanup changes, deploy the standalone Vercel Queues consumer and check durable command processing as described in the [realtime deployment guide](../deployment/room-experience-vercel-queues.md).
4. Deploy both Pages clients. Confirm the actual API commit header and both `release.json` files before publishing an APK for that commit.
5. Record the commit, provider deployments, Actions run, APK metadata/hash, migrations, smoke evidence, known gaps, and rollback outcome in a dated release record.

Redis is coordination infrastructure. Git-driven application deployment does not upgrade Redis, clear its data, or change its connection configuration. Retain durable PostgreSQL cleanup commands until a consumer completes them.

## Android and rollback

The [Android delivery guide](../deployment/android-automatic-delivery.md) describes signing, versioning, publication permissions, failure handling, and the matching-commit release gate. A PR APK uses the existing production API and is available as an Actions artifact; opening a PR does not update the public download.

When rolling back, redeploy the last compatible API and frontend commits and restore configuration deliberately. Keep additive schema fields needed by active clients and preserve pending cleanup commands. Drain or replace a queue consumer before removing its trigger. Restore a database backup only through an explicit recovery plan; an application rollback is not a database rollback.

Local builds, tests, documentation, and OpenSpec archival do not prove production deployment or device acceptance. Record those evidence classes separately.
