# Production release tool repairs

The Phase-one main release passed application verification and Android assembly, then encountered two tool failures before API publication. These failures blocked the public APK gate as intended.

## PostgreSQL client installation

Ubuntu 24.04 could not locate `postgresql-client-17` in its default repositories. PR #20 adds the official signed PostgreSQL Noble repository and verifies both client versions. The retry successfully encrypted the production snapshot, restored it in isolation, checked all recovery invariants, and applied the pending private-conversation migration. The daily recovery workflow now uses the same installation procedure.

Neon transaction pooling does not preserve session locks. A pooled migration connection left an idle PostgreSQL advisory lock after the release process ended. Database tools now derive the same Neon endpoint's direct hostname while preserving credentials, database and TLS settings; approval and backup identity remain bound to the configured source URL. API connection pooling is unchanged. The first migration failure was not diagnosable from the original suppressed output, and is not attributed conclusively to this lock behavior.

## Vercel CLI installation

The command `pnpm dlx vercel@63.1.2 --version` reproduced `ERR_PNPM_IGNORED_BUILDS` under pinned pnpm 12.3.4. The isolated dlx installation did not inherit workspace approval for the CLI's esbuild dependency. This prevented CLI startup before authentication or deployment.

Adding `--allow-build=esbuild` allows only the required dependency script. The corrected command successfully starts Vercel CLI 63.1.2. No token was replaced and no global build policy was disabled.

Migration and deployment wrappers now retain at most 16 KiB of output in memory and report only recognized error codes. Provider output, credentials and private connection details are never emitted. Focused tests cover diagnostic chunk boundaries, secret exclusion, backup authentication/isolation, approved Neon endpoint derivation, and production/APK gate failures. These tests and local CLI startup do not establish a successful production deployment; the guarded main job and live commit checks remain authoritative.
