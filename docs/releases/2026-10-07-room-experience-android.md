# Android Room Experience Modified Version Build

Build date: 2026-10-07. Target: Android controlled installation verification of OpenSpec `simplify-room-and-mobile-experience`. The existing `2026-10-07-android-preview.md` will not be rewritten.

## Products

- Path: `/Users/cls/Downloads/Slogan-android-logo-2026-10-07.apk`
- Size: 85,035,026 bytes, about 81.1 MiB.
- SHA-256：`cf73ba3770e38512b500c30bbcdd2b4e3a742a0854abacf9b8d39587e35eac67`
- Package name: `com.slogan.mobile`.
- versionName / versionCode: `0.0.0` / `1`, use the existing configuration; it is not a new version released by the store.
- ABI：`arm64-v8a`；minSdk 24 / targetSdk 36。
- Built-in API: `https://slogan-api-pi.vercel.app`, injected and verified bundle through compile-time public configuration.
- release variant, use the existing debug signing key of the project; apksigner verify passed, v2 signature, 1 signer. Not a production signed release.
- Manifest check `windowSoftInputMode=0x10`(adjustResize); no debuggable=true.
- There are 6 font resources in total: 4 shared Noto Sans SC static font weight and 2 existing Expo fonts, there is no duplicate Noto resource retaining the old path.

This APK also contains the launcher icon correction of the Slogan project Logo: the normal and circular icons, adaptive foreground and white background have been connected to the Expo configuration and synchronized through Android-only prebuild.

This APK includes the final round of recording cancel/retry race fixes, as well as voice room icons exported from the original, press-and-hold translation and dark room host handover popups, input boxes, and successor accessibility labels. Previously `Slogan-android-experience-2026-10-07.apk` and `Slogan-android-experience-final-2026-10-07.apk` were earlier products, and the latter has not yet included this round of logo revisions; please use the new `Slogan-android-logo-2026-10-07.apk` above for final acceptance.

## Build and local evidence

Source: develop `716cc0bd0fd4e0010721f0e0ac3c77eec4522436` plus currently uncommitted workspace, no new Git commit/PR/push. Node 24.21.0, pnpm 12.3.4, Gradle 9.3.1, Android build-tools 36.0.0; `:app:assembleRelease --no-daemon --max-workers=2 -PreactNativeArchitectures=arm64-v8a` passed.

mobile typecheck/lint, 45 suites/131 Jest tests, and admin/API/Contract/related browser and local queue build results see [Acceptance record](../acceptance/simplify-room-and-mobile-experience/README.md). Unit tests, APK signatures, and adjustResize settings are not actual microphone or keyboard validation.

## Installation and online boundary

User explicitly performed physical device testing themselves; there is currently no evidence of agent-performed installation or physical device operation. Requires an arm64 device with Android 7.0+; two Androids to verify that observers cannot hear private recordings and restore normal room audio.

The current online API has not yet released the new level range, text messages and asynchronous cleanup contracts for this round. This APK points to the existing production address, four online database migrations have been successfully executed and verified, and API/queue deployment is still in progress; the deployment must be completed before full online acceptance. It cannot be claimed that all new features are available without deploying a new version of the backend. No online environment variables, providers, keys, or Google logins have been modified.

The store has not been released and OpenSpec has not been archived this time. The user has authorized online publishing and four database migrations, and the migration has been completed; the publishing status will be updated after verification in the cloud. Figma final visual and Android device proof are not complete, iOS is not in scope. See [Vercel queue solution](../deployment/room-experience-vercel-queues.md) for release/restore/rollback sequence.

## Android Logo correction evidence

The previous Expo configuration did not have `android.icon` / `android.adaptiveIcon`, and the native generated directory still used the default Android robot. Logo is only used on the page and will not automatically become the launcher icon. Now use `assets/brand/slogan-logo.png` as the source to generate ordinary icons and safe zone foregrounds; the original Logo will not be rewritten.

Check the application icon / roundIcon and Android 8+ adaptive XML reference of the final APK. A total of 15 icon resources in five levels of DPI match the resources generated in this round byte by byte; for the extracted icon, see [Actual icon in APK](../acceptance/simplify-room-and-mobile-experience/android-launcher-from-apk.png), and for a complete check, see [Build record](../acceptance/simplify-room-and-mobile-experience/android-logo-build.json). The old and new APK signing certificates are consistent and can be overwritten for installation; cache/cropping is not verified on the physical device launcher.

Icon configuration is a Level 0 brand asset wiring fix; no new product behaviors or iOS modifications have been added.

Icon specification basis: [Expo Android icon configuration](https://docs.expo.dev/versions/v57.0.0/config/app/), [Android adaptive icon safe area](https://developer.android.com/develop/ui/compose/system/icon_design_adaptive).
