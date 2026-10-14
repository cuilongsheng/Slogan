## Context

The controlled Android distribution already publishes `/downloads/android.json` and `/downloads/android.apk`. Metadata pins commit, versionCode, byte size, SHA-256, package, ABI and certificate. Publication follows exact-main API/web deployment gates. The current APK contains no updater.

## Decisions

1. A local Expo Android module owns installed package identity, HTTPS release reads, streaming downloads, integrity verification, restricted FileProvider access, installation-source settings and installer launch. No new JS dependency or backend endpoint. Existing delivery metadata is a release artifact contract, not a second business OpenAPI contract.
2. Compare Android versionCode, not lexicographic version strings. Accept only the fixed repository's published metadata, matching package and installed signing certificate, supported ABI, bounded valid version/size/hash/commit. Download the immutable commit URL so a changing latest pointer cannot swap the selected binary.
3. Use a bounded HTTPS redirect allowlist for GitHub release assets. Stream to a private temporary file and hash incrementally; do not load an 85 MB APK into JS memory. Check exact byte count, SHA-256 and the APK's actual package, version and signature before installation. Delete incomplete/canceled downloads and retain only the selected verified APK. Revalidate cached bytes before reuse.
4. Optional startup/foreground checks are rate limited to once per six hours after success and a shorter retry interval after failure. Checks do not block application bootstrap. Auto prompts appear on main pages or login only; navigation to calls/rooms suppresses the modal and cancels an active download. Later suppresses the same version for the process session. Manual checks in Me bypass check throttling and dismissal. No request is made on web/iOS/Expo Go.
5. Primary action downloads then opens the system installer. Missing install-source permission opens Android's per-app settings only following an explicit tap; returning after permission approval continues installation. Installer return leaves Install available if the user canceled. The app never claims installation succeeded from an activity return: installed identity on next launch is authoritative.
6. Reuse the existing Noto Sans SC font, light surface, lavender secondary controls and purple primary controls. Create editable update available/download/permission/error states in a separate Figma section via Desktop Bridge; preserve original screens. The owner's latest update-only visual correction uses the existing 80px brand mark beside a 16px title, white342px dialog/radius24, version and explanatory copy below, inline progress/percentage and compact36px dialog actions. These dialog controls use larger touch hit areas; standalone page actions retain342x46. Apply this shared branded layout only to app-update states, not room, invite or report dialogs.

## Risks and Mitigation

- Malformed or swapped artifacts: pinned immutable URL, bounded release data, package/certificate comparison and actual APK verification; errors never launch installation.
- Permission denied or manufacturer policy: remain in a recoverable permission state and allow Later; do not loop settings or claim success.
- New call/navigation interrupts update: only foreground idle routes show the prompt; cancel transfer and leave media untouched. System installer may background the app, so launch only following explicit user action.
- Network failure or process termination: bounded timeouts, partial-file cleanup on failure and next attempt, no permanent update lock. Installed app continues normally.
- Signing distribution changes: mismatched certificate is rejected. A future production signing migration requires a separate change, not an automatic switch in this updater.

## Migration and Rollback

One manual installation of the first updater-enabled APK is necessary. No DB migration or secret changes. Future releases retain the same package/signing identity and higher versionCode. To roll back updater behavior, publish compatible code with a higher versionCode; Android downgrade is not offered. Removing the root observer disables automatic discovery without touching voice logic.

## Evidence

Deferred by owner: pure policy and native-adapter tests, mobile checks, native compilation, Figma-to-runtime comparison, and physical-device upgrade/permission/cancel/offline coverage. No tests or deployment run during implementation. Final acceptance must distinguish code review from actual APK installation evidence.
