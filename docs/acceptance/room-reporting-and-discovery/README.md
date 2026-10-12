# Room reporting and discovery repair — 2026-10-12

Owner-authorized follow-up to Android 0.0.54 regression repair; delivered with the first batch in PR #22. Original Figma frames are preserved. Product Chinese language support remains available.

## Behavior and backend

- Another occupied avatar opens the corresponding member report directly. Self avatars are disabled for reporting. Closing the form dismisses locally without leaving the room.
- The three-dot menu has Report room, Leave room and Share room link. Existing host handoff is retained. Empty seats still invite online idle partners through the in-app list; link sharing is a separate action.
- A room report omits the accused user, uses retained actual room membership, and creates its report, room-target audit and safety case atomically. Normalized duplicate submissions replay; changed targets/content conflict. Existing member and private-message reports remain compatible.
- Room evidence uses same-room history and no personal restriction projection. Missing case room references do not widen evidence to unrelated cases. User sanctions are transactionally rejected without an accused user. Administration identifies room cases and offers only non-punitive resolution.
- Migration `20261012153000_room_report_targets` relaxes only Report/SafetyCase accused-user nullability and rejects untargeted private-message records. Existing context, reporter-membership, description and idempotency constraints remain. An isolated-schema test preserves preexisting member reports/cases and inserts new room records. Rollback must retain nullable records; do not restore NOT NULL or delete new reports.
- Availability no longer treats retained ACTIVE membership in an ENDED room as occupancy. OPEN/ENDING rooms, direct-call occupancy, restrictions and bilateral blocking still exclude users. Online filtering scans bounded candidate pages and returns a cursor after the last delivered person instead of skipping undisplayed online people. Empty bounded pages remain resumable.
- Redis initialization is shared between concurrent heartbeat/list calls. Presence transport failure is returned as an unavailable error, never a successful empty list.

## Visual evidence

Connected file: Slogan `56nIowZmvBhb0QJvOlDQdU`, page 02 UI; Desktop Bridge exports only. The owner explicitly requested interaction/layout changes. New editable V2 targets retain the original reporting and creation foundations; these revisions are not a reconstructed-original proof.

| Target | Node | Runtime evidence |
| --- | --- | --- |
| Direct avatar report | 190:2529 | runtime-member-report.png |
| Room report | 190:2558 | runtime-room-report.png |
| Three-action menu | 190:2587 | runtime-room-actions.png |
| Active-only navigation | 190:2628 | runtime-nav-me.png |
| Compact creation | 190:2659; English adaptation 192:2714 | runtime-create-en.png; runtime-create-small-focused.png |

Runtime screenshots are explicitly fixture-backed real React Native Web components, generated HTTP clients and controls, at 390×844, device ratio 1 and Noto Sans SC. Native Android fidelity, microphone authorization/publish/receive and OS keyboard behavior are not certified by these captures. The reporting reference's empty underlay differs from the runtime's dimmed room; compare the actual panel, not the background content. Native device checks remain owner-operated.

The room report panel is 634 pixels high at y=210; its description input is x=24, y=605, 342×95. The menu is 300 pixels high with three 48-pixel rows. The desktop web app is bounded to 390×844 and vertically centered on taller windows. The 56-pixel creation action stays at y=764 inside that frame; 360×540 focused-input coverage verifies reduced-viewport scrolling, not a native keyboard. Navigation has no halo and actual image tint differs between inactive Discover and active Me.

Source/runtime captures were inspected directly. Reporting and menu panel geometry is covered. Creation retains small text/rasterization differences between the English adaptation and web runtime; Android has no new capture. No whole-screen native 1:1 claim is made.

## Verification

- Mobile: 53 suites / 185 tests, including direct avatar report, real room report body, safe dismissal and retained Expo tabs.
- API: 44 unit suites / 241 tests; 40 integration suites / 209 tests; 20 HTTP suites / 106 tests. The new isolated room-report migration test also passes separately. Focused real Redis concurrent initialization, TTL and unavailable checks: 2 tests.
- Browser: existing visual harness 30 tests pass; 3 new report/menu/navigation/compact-preview tests pass after correcting selectors. Backoffice room-case UI test passes and cannot select a personal sanction.
- Workspace types, lint, formatting, dependency boundaries and generated sole OpenAPI consistency pass.
- Controlled production demo_s1/demo_s2 sessions have independent tokens, successful heartbeats and symmetric availability. This does not reproduce the owner's unnamed phone accounts. Those accounts' specific exclusion reason remains unconfirmed; do not attribute it to shared browser cookies or foreground state.

## Release boundary

Production/main migration, API/Pages commit alignment and the upgraded signed APK must be verified after merge. PR/source checks alone do not prove deployment. Android 0.0.54 lacks RECORD_AUDIO; an APK upgrade is required for the first batch's microphone repair.
