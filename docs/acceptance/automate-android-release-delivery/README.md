# Android automatic delivery acceptance

2026-10-08。 The local and actual cloud automatic delivery passed; there were independent failed items in the room background cleaning. Physical-device verification is performed by the user.

## Verified

- Node 24.21.0 / pnpm 12.3.4; mobile typecheck/lint, release script and new API file lint, API build, Prettier and git diff check passed.
- Pages proxy and production release threshold 16 tests passed; added actual Nest HTTP release submission response header e2e 3 tests passed; OpenSpec strict verification and actionlint 1.7.12 passed.
- Actual arm64 assembleRelease for Temurin 21.0.12.1, SDK/build-tools 36, NDK 27.1.12297006, Gradle 9.3.1 successful, 990 native tasks, 2m45s.
- Verify APK's stable signature, package, non-debuggable, adjustResize, version name/version number, built-in submission/API, bundle API address and 15 normal/circular/adaptive launch icon resources. The wrong submission number and wrong version number are both rejected for verification, and the original verification product is retained.
- Product metadata see [local-android.json](local-android.json). This package is local proof, not published as latest, and does not prove that the old production API supports the new room contract.

## Build issues and fixes

The cloud Gradle setup was originally run before Expo prebuild, and the cache could not find the native Gradle file that had not yet been generated; it was changed to run after prebuild. The sdkmanager hosting the runner is not in PATH; explicitly use a fixed version of the Android SDK setup action. APK resource compression will rewrite the resource path, and the validator parses the actual path from the aapt2 resource table; keyboard mode is checked by numeric digits and does not rely on hexadecimal zero padding format.

The original ANDROID_HOME/ANDROID_SDK_ROOT of this machine points to different directories and has been aligned only during the build process. Native access warning for JDK 25 causing CMake configuration to fail, already built with the same JDK 21 as CI; no changes to the system default JDK or other checkouts.

## Actual cloud delivery

[PR #9](https://github.com/cuilongsheng/Slogan/pull/9) has been merged into `fc7bbf86cb28ee315c6e57e4d2a62a0dfc8e56d3`. The actual construction, APK verification and upload of PR Actions passed; the build/publish of [main Actions](https://github.com/cuilongsheng/Slogan/actions/runs/37715522066) all passed. The API response headers and the actual commits of release.json of the two production Pages all match. GitHub Release released `0.0.7` / code `1007`, fixed download HEAD returned 302, actual download 85,035,110 bytes, SHA-256 is consistent with public metadata; the signature, adjustResize, built-in submission/API and 15 icons of the download package were verified again. See [Cloud evidence](cloud-android.json).

## Independent business publishing restrictions

Real two-account text message, scope and quick exit pass, but after stopping room HTTP request six minutes, the persistent cleanup command is still PENDING / attempts=0. This failure is not an APK build failure, nor can it be marked as business acceptance due to automatic release. The in-request recovery seeding patch still needs to be reviewed by the PR and the actual cloud; at that time, the Mac locked the screen again and could not read the logged-in Vercel log or operate GitHub. Vercel project variable list does not see STT/AI configuration, press and hold translation has no real evidence of vendor success.

The signature follows the existing controlled debug installation certificate, not a store signature. Google remains closed; iOS is not included in this cycle. There is no verification evidence for the device keyboard, audio isolation between the two devices, and complete native vision.
