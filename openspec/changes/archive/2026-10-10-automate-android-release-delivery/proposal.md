## Why

The current API, two Pages and Android packages are released separately, and users cannot install the latest APK consistent with the online contract from a fixed address. The user has clearly requested to continue completing the original release, and directly submit, submit PR, trigger deployment, and the installation acceptance is performed by the user.

## What Changes

- PR/branch submission in the same repository triggers existing Vercel, admin/mobile Pages preview and automatic Android APK construction; merging main triggers production deployment.
- After successfully verifying the three production deployment and running submissions, publish the submitted APK, check value and version metadata to GitHub Releases.
- The mobile site provides a fixed APK/version download entrance, and a failed build will not change the latest downloadable version.
- Fixed Node/pnpm/Java, dependency locks, Android configuration, signing certificates and incremented version numbers to make it clear that controlled installations are not store releases.

## Capabilities

### New Capabilities

- `android-release-delivery`: Android automated builds, production deployment thresholds, traceable downloads, and failure recovery.

### Modified Capabilities

There are no changes in business requirements for existing products.

## Impact

Affects Architecture, Test/Acceptance, and Deployment; involves GitHub Actions, build scripts, Expo configuration, API submission response headers, Pages publishing metadata, and fixed download redirection. No new application pages, no modification of Google/AI configurations, no disclosure of business secrets, no introduction to iOS or store release. This round of four database migrations has been completed according to authorization; future database changes must still be backed up and explicitly migrated/rolled back, and production migrations will not be performed in untrusted PRs.
