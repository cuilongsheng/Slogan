# Android in-app updates

Implementation is local on `codex/android-in-app-update`. Tests, native build, device acceptance and deployment are deferred at the owner's explicit request. Do not treat this document as release evidence.

## User flow

An installed updater-enabled controlled Android APK checks the existing public release metadata after startup and foreground activation on idle main/login pages. Success is throttled for six hours; transient failures retry no sooner than five minutes. Me has a manual Check for updates entry. Automatic check failures do not block the app. Later suppresses the selected version for the current process session.

Download shows progress with cancellation. Successful verification opens the Android installer; if installation-source permission is missing, the user opens Android's per-app settings, permits installation and returns to continue. Denial/cancellation leaves the current app usable. Returning from the installer is not recorded as successful installation. Version comes from the actual installed Android package on the next check.

Entering a room, a call or another non-idle route hides the prompt and cancels any active transfer. A completed download in the background waits for the user's Install action rather than launching a system screen over another app.

## Bootstrap and distribution boundary

The APK currently installed without this feature cannot discover the feature itself. The first updater-enabled release requires one manual APK installation, after final verification and publication. Future compatible releases can then be offered inside the app.

This is controlled APK distribution, not Google Play in-app updates or Expo OTA. Web, iOS, Expo Go and unstamped development builds do not run this updater. Retain package `com.slogan.mobile`, the existing signing certificate and a higher versionCode. A signing-key migration is a separate project change.

The local Expo module is in `apps/mobile/modules/slogan-updater`. Expo Autolinking discovers it from its default modules directory during the existing Android prebuild. Its library manifest contributes `REQUEST_INSTALL_PACKAGES` and a non-exported FileProvider scoped only to the verified-update cache folder. No database, business OpenAPI, credentials, CI workflow or signing configuration changes are required.

## Release artifacts and validation

- Metadata: `https://slogan-preview-mobile.pages.dev/downloads/android.json`, using the existing guarded GitHub latest release.
- Selected APK: `https://github.com/cuilongsheng/Slogan/releases/download/android-{commit}/slogan.apk`, pinned to the metadata commit.
- Metadata is bounded to 64 KiB; APK size is bounded to 250 MB. HTTPS redirects are bounded and restricted to the known Pages/GitHub release-asset hosts.
- The native module compares versionCode and supported ABI, matches installed package/certificate, hashes bytes incrementally and verifies exact size/SHA-256, actual APK package/version and actual signing certificate.
- Partial files are not exposed to FileProvider. Failed/canceled transfers delete their partial file; a later attempt removes remnants from process termination. Cached complete files are revalidated before reuse. Signed asset redirect URLs are neither logged nor returned to JavaScript.
- Do not roll back by decreasing versionCode. Publish compatible rollback code as a new, higher versionCode through the existing deployment gates.

## Final verification still required

Run affected TypeScript/lint/dependency, policy/native adapter tests, Android native compilation and packaging checks once requested. Compare the actual update UI against the editable Figma target. A physical device must cover same-signature upgrade preserving login, missing/denied/granted installation permission, installer cancellation/retry, interrupted/offline download, wrong digest/package/signature, and incoming-call/room navigation during transfer. Browser screenshots cannot establish Android installation evidence.

Official references: [Expo local modules](https://docs.expo.dev/modules/get-started/), [Autolinking](https://docs.expo.dev/modules/autolinking/), [Android PackageInstaller](https://developer.android.com/reference/android/content/pm/PackageInstaller.html), [per-app installation settings](https://developer.android.com/reference/android/provider/Settings#ACTION_MANAGE_UNKNOWN_APP_SOURCES), [FileProvider](https://developer.android.com/reference/androidx/core/content/FileProvider).
