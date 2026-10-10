## Purpose

Provides automatic build and fixed download entrances for controlled Android installation acceptance that are consistent with online front-end and back-end, source traceable, and signed continuously, allowing users to directly install and verify, and retain the last available product when the release fails.

## ADDED Requirements

### Requirement: Automatically build traceable Android packages

System SHALL automatically builds Android APK when the trusted branch of the repository is submitted and PR is updated, recording the source submission, version, API address, signing certificate and SHA-256; non-production build SHALL does not change the production download version.

#### Scenario: Update PR

- **WHEN** User submits new code for a PR in the repository
- **THEN** Trigger Android build and existing front-end and back-end preview deployment, the product can be downloaded by the workflow and the source is identified for submission

### Requirement: Production release threshold

The system MUST only release the corresponding APK after the API submitted by the target main, the management terminal and the mobile terminal production deployment are all successful, and the running submissions are consistent. Failed, timed-out, old commit, or canceled builds MUST not be marked as latest download.

#### Scenario: A deployment failed

- **WHEN** API or any front-end deployment failed or run commit inconsistently
- **THEN** Workflow report failed, fixed download entry retains the last successful release

#### Scenario: Old build delayed in completion

- **WHEN** Build committed by earlier main completed after main has been updated
- **THEN** This build cannot be updated to the latest downloaded version

### Requirement: Fixed download and overlay installation

The system SHALL provides a fixed HTTPS download entrance, pointing to the latest successful production APK, and providing matching version metadata and verification values. Controlled installation signatures MUST be consecutive, version numbers SHALL incremented, builds MUST not contain production secrets.

#### Scenario: Install after successful release

- **WHEN** The deployment submitted by the same main was successfully verified against the APK
- **THEN** Fixed address to download the APK with metadata to check commit, API, version, SHA-256 and signing certificate
