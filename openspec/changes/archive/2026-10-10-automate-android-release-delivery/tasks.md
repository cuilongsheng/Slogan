## 1. Construction and traceability of products

- [x] 1.1 Fixed the tool chain and configured read-only PR builds and main release permissions; verified workflow syntax, event boundaries and actual Actions builds.
- [x] 1.2 Access public commit/API metadata and increment Android version; verify Expo config with APK actual app.config/Manifest/bundle.
- [x] 1.3 Verify stable signature, APK hash, native flag and output release metadata; verify actual build product and failed verification test.

## 2. Production threshold and download

- [x] 2.1 Verify the status of the three providers and the actual production submission, reject failed/old submissions; verify that missing checks, failures, delays, and submissions do not match the old version test.
- [x] 2.2 Add fixed HTTPS download and metadata redirection; verify GET/HEAD, method restrictions, no forwarding of credentials and approximate path testing.
- [x] 2.3 After uploading the draft assets, release latest, and keep failure without replacement; verify that the real Release and downloaded file hashes are consistent.

## 3. Delivery

- [x] 3.1 performs affected lint/typecheck/test/build, OpenSpec strict inspection, and records local and cloud evidence.
- [x] 3.2 Submit and create PR, production merge/deployment, download entrance acceptance; record submission, release, APK and physical device verification boundaries that the user is responsible for.

2026-10-08: Local actual APK and negative examples, 16 Pages/release threshold tests, 3 new API e2e tests, affected lint/typecheck/build, actionlint and strict OpenSpec verification passed. PR #9 has been merged into fc7bbf8, PR/main actual Actions passed; three production commits are consistent, Release 0.0.7 and fixed download hash/actual APK verification passed. Completed automatic delivery does not establish that background room cleanup passed. This separate business gate remains recorded in simplify-room-and-mobile-experience 5.3. The user performs physical-device verification; device evidence has not been falsely reported. See `docs/acceptance/automate-android-release-delivery/README.md`.
