# Page subtitles and Discover toolbar

Owner-approved follow-up to PR #24 on 2026-10-13. Target viewport 390×844; smaller English viewport 320×640. No API, room-session, permissions or provider configuration changed.

## Scope

Remove introductory page subtitles and the layout space they occupied. This includes profile/preferences, registration/verification/password recovery/reset, room and appointment information, share-link loading, history/notes, learning summary/vocabulary, personal restrictions, social pages and direct-call headings. Shared RoomHeader contracts no longer accept a subtitle. Back headings retain 16px alignment. Existing form labels, restriction details, consent/privacy body text, validation errors, microphone/reconnection feedback, call duration and actions retain their behavior.

Discover now has a centered title on its own line and a second-row gray All pill, actual count plus source chevron, existing speech-burst asset and right-side create action. The count is derived from current visible/paginated rooms, not a fixed source number. Polling, pagination, room entry and creation navigation remain functional.

## Original-to-runtime evidence

Original: live Desktop Bridge file `56nIowZmvBhb0QJvOlDQdU`, `02 UI`, frame `115:1197`. The original was not changed. `figma-discover.png` is its native export; `owner-header.png` is the supplied crop. Runtime captures render actual product components with explicitly controlled API/auth data and bundled fonts. Source/runtime are compared at matching logical dimensions with DPR 1; see the parent comparison viewer.

| Header region   | Original / verified runtime bounds at 390×844        |
| --------------- | ---------------------------------------------------- |
| All pill        | x16, y79, 57×32; neutral `#F0EFF3`, source gray text |
| Count           | x93, y84, 62×17 for 12 rooms, 12px Medium            |
| Speech burst    | x173, y79, 32×32; exact existing exported asset      |
| Create action   | x320, y70, 42×42; existing plus asset / route        |
| First room card | x15, y142, 358×132; unchanged card/list geometry     |

The user's explicit centered-title decision overrides the source title's slightly left-shifted text bounds. Count, card, participant and avatar content in fixtures are not production data; the scope of the comparison is the revised header. Runtime count slots can expand for longer localized pagination text. The English 320px check confirms no count/burst/create overlap and preserves creation navigation.

`restrictions-zh.png`, `profile-zh.png` and `password-recovery-zh.png` show actual routed pages without introductory subtitles. Existing profile save/cancel, restrictions/appeal and password-recovery flows are separately exercised by browser tests. These captures are not physical-device or LiveKit acceptance.

## Checks

Formatting, mobile typecheck/lint, dependency boundaries, strict OpenSpec validation and mobile iOS export passed. Mobile unit tests: 59 suites / 217 tests. Visual/interactions harness: 48 tests, including precise header geometry, dynamic foreground count, room entry, creation navigation and narrow English layout. Routed browser suite: 26 tests, with assertions for removed subtitles on restrictions, profile editing and password recovery.

Final results: `checks/browser-final.txt` (26 PASS, 18.8 seconds), `checks/visual.txt` (48 PASS), `checks/unit.txt` (217 PASS), and the matching build/format/dependency logs. There were no automatic retries in the final browser run.

One initial browser run timed out while reopening creation after an instant-room submission. The isolated scenario passed in 3 seconds, then the full browser suite was rerun with no automatic retry. The first failure is not described as a proven product fix. See saved check logs for final results.

PR/CI publication and native-device acceptance remain separate. Production Pages/API/APK are not updated by these local checks.
