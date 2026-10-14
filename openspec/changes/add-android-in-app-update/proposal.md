## Why

Android releases are published with an APK and integrity metadata, but an installed Slogan app cannot discover or install a newer release. Users must find the download link manually.

## What Changes

- Add an optional update prompt after startup and foreground activation on safe, idle pages, plus a manual Check for updates entry in Me.
- Download the selected immutable APK inside the app with progress and cancellation, verify its integrity and installed-app identity, and open the Android system installer.
- Handle installation-source permission, canceled installation, offline checks and retry without blocking login, room entry or calls.
- Reuse existing public Android release metadata and delivery gates. No new business API, database or credentials.

## Capabilities

### New Capabilities
- `android-app-updates`: Discover and explicitly install newer controlled Android APK releases.

### Modified Capabilities

## Impact

Mobile feature/service, local Expo Android module, editable Figma states, release documentation. Delivery stages: requirements, design, implementation, verification, release. The owner has explicitly deferred tests; verification and release remain pending until requested.

## Non-goals

Silent installation, mandatory updates, Play Store integration, iOS installation, OTA JavaScript delivery, background download service and a new signing key are excluded.
