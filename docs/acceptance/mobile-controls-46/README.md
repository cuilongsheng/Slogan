# Mobile control sizing and revised Me identity

Branch: `codex/mobile-controls-46`, based on published commit `fce96eea0e4f198141a3ea6f3e79187d63874489`. OpenSpec change: `normalize-mobile-control-height`. UI-only implementation; no API or media lifecycle changes, no deployment in this turn.

## Source and scope

Desktop Bridge live probe and original frame inspection: file `56nIowZmvBhb0QJvOlDQdU`, page `102:2766`, original Me `152:1467`,390x844. The original was not modified. [Original capture](figma/me-original.png).

Owner's clarified46px instruction applies only to inputs and regular action buttons. Selection options retain their source dimensions: language, level, capacity, access, room mode, profile preferences, filters and report categories. Scope: single-line form fields, boxed/regular actions, update/invitation dialog actions and composer actions. Avatars, member/list hit regions, header icons, inline text links and the main navigation retain their separately designed geometry. Large page actions retain342px maximum width. Multiline fields default to46, grow to a bounded160, and scroll within the field beyond that; direct chat preserves its existing120px bound. This was the recommended optional clarification and explicitly announced fallback while awaiting an answer.

## Me comparison

At390x844 in the real Me component with explicit test-only auth/profile fixtures:

| Region    | Original                | Runtime / result                                                                            |
| --------- | ----------------------- | ------------------------------------------------------------------------------------------- |
| Avatar    | x23/y65/52x52           | same geometry, existing fallback cartoon for a fixture lacking a real photo                 |
| Name      | x86/y65,18/27 bold      | same geometry/type, actual fixture display name                                             |
| Languages | x86 and174/y99,80x18    | same positions/widths/type and original18px visual height;46px touch hit area               |
| Menu      | x23,width350, label x29 | same horizontal geometry;46px action-row height below the original language option geometry |
| Logout    | 342x46                  | 342x46 above retained main navigation                                                       |

Existing My reports and native-only Check for updates remain authorized additional entries. Name/avatar remain profile-edit targets, and language controls have independent callbacks so selecting language does not open profile editing. Runtime content is fixture data; this is source-backed web geometry evidence, not a same-data pixel-identity or Android-device claim.

## Verification

- Mobile typecheck and lint passed.
  -233 mobile tests /61 suites passed.
- Expo iOS JavaScript/Hermes export passed; this is bundling evidence, not an Android APK build or installation.
  -48 existing visual harness checks passed, including reduced/narrow viewports, room password/scheduling, report submission/target correctness, main navigation and composer behavior. Updated obsolete geometry assertions to46px.
- The report flow verifies multiline growth to160 and collapse back to46 after clearing; actual report requests still use the correct user/room target.
- Strict validation of the new OpenSpec change and `git diff --check` passed.

Captures: [Me](runtime/me.png), [create room](runtime/create.png), [room report](runtime/report.png), [room actions](runtime/actions.png). These are actual React Native Web components in the explicit visual harness, with simulated system chrome/fonts at390x844.

Physical Android keyboard/font/layout verification remains pending. No new production or APK version is claimed by this record.
