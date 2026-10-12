# Tasks

Implementation and verification are separately tracked in `docs/releases/phase-one-completion-tasks.md`.

- [x] Implement safe default and replaceable avatars without changing optional profile/adult confirmation requirements.
- [x] Implement persisted manual language selection with device-default initialization.
- [x] Implement shared auth throttling and managed maintenance/recovery consumers.
- [x] Implement guarded migration/backup/recovery release infrastructure and required CI coverage.
- [ ] Complete contract/client generation, consolidated tests, visual/runtime evidence, and release checks.
- [ ] Synchronize specs/documents, archive accepted changes, and publish verified matching APK.

## Approved interface revision

- [x] Create and inspect five simplified high-fidelity Figma targets using the existing visual system, preserving V1 originals.
- [x] Implement simplified partner/recent/chat/call layouts, keeping unread, paging, message selection/reporting, blocking and immediate audio shutdown.
- [x] Capture and compare the five new original/runtime targets and revalidate affected interactions before the final release.

## 2026-10-12 Android acceptance repairs

- [x] Repair native UTF-8 response decoding and add a regression using the installed RN Response polyfill.
- [x] Restore the established recording permission and gate actual APK publication on its declaration.
- [x] Keep room level/LIVE labels on one line and distinguish initial joining from reconnection.
- [x] Remove the serialized member-display wait and redundant first connection refresh without bypassing admission.
- [x] Preserve the four main tab instances, account isolation and background refresh behavior.
- [ ] Record final affected checks, gated delivery and owner native verification for the repaired build.
