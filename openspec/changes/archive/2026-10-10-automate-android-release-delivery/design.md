## Context

Vercel and two Pages have been bound to this repository. Pushing triggers the build, and main is the production branch. The APK is approximately 85 MB, exceeding the Pages single file limit of 25 MiB. The user has authorized implementation, submission and PR release, and physical device testing is performed by the user.

## Goals / Non-Goals

Goal: Deliver code and build from the same PR, merge them to generate an installable production APK, and fix the entry not pointing to the failed version. Non-target: iOS, store distribution, changing Google/AI configurations, automatically performing production database migrations on any PR, extending existing supplier access.

## Decisions

- Reuse existing Git integration; GitHub Actions uses fixed action commit, Node 24.21.0/pnpm 12.3.4/Java 21, Gradle assembleRelease after Expo Android-only prebuild, arm64-v8a. PR uses read-only permissions, only main releases job to get contents:write, pull_request_target is not used.
- APK is stored in GitHub Releases, and the label binding is completed and submitted; first create a draft and upload APK, SHA256SUMS, android-release.json, and then mark it as latest. Compared with R2, there is no new account/token/bill; compared with Pages, direct upload meets the size limit.
- `/downloads/android.apk`, `/downloads/android.json`, `/downloads/android` are fixedly redirected to the latest assets/descriptions of this repository through Pages worker. Only GET/HEAD, does not forward credentials, ignore query parameters, and does not add a new UI.
- API response provides x-slogan-commit with strict SHA format check; Pages wrapper release.json contains CF_PAGES_COMMIT_SHA. Publish a job to verify the corresponding submission status of three providers and the submission of three actual production addresses, not just HTTP 200.
- Keep existing Expo controlled debug signing certificate and verify fixed fingerprint; automatic version code=1000+run_number. It is not a store production signature. In-APK app.config holds public commit/API metadata; validator checks package name, version, arm64, adjustResize, non-debuggable, certificate and actual bundle URL.
- Check main HEAD again before publishing to prevent old builds from overwriting new versions; failed drafts are not marked latest. The current four migrations have been completed; future schema changes need to be backed up and migrated before being released, and no secrets will be given to the untrusted PR production database.

## Risks / Trade-offs

- [Third Party Deployment Late] → Bounded waits and explicit failures, retaining the last downloaded version.
- [Parallel version coverage] → Publish serial + main HEAD review + publish after draft upload is completed.
- [Signature Drift] → The APK certificate fingerprint does not match and fails immediately; formal private key migration requires an independent controlled process.
- [Beta Queue, Provider Failure] → Independent record of real cloud queue acceptance of original room change; automatic build does not claim audio verified.

## Migration Plan

Submit the workflow and fixed entrance with the existing release branch and merge it into main through PR; track production deployment and workflow, confirm public download and verify metadata. Repair the failure first and then rerun; there is no need to roll back the successful incremental migration. Keep the historical Release when rolling back, explicitly select the last verified package and matching server, and do not roll back the business LEFT/ENDING state.
