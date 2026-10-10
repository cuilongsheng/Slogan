# Reconnect page layout correction

## Goals and Scope

2026-10-10 The user provided a screenshot of `02 UI / Connection / Reconnecting · V1` and requested to carefully check the page layout and UI; at the same time, he requested not to do testing and deployment first. This time only the front-end display is modified, and the existing session recovery and server exit rules are retained.

- Product routing: `/rooms/{roomId}/session` has been added and LiveKit automatically reconnects.
- Current behavior basis: `openspec/specs/voice-session/spec.md`'s network reconnection feedback, `openspec/specs/host-controls/spec.md`'s room host 60-second recovery window; existing change `implement-mobile-voice-room-session` has confirmed this frame.
- Original file: Slogan / `56nIowZmvBhb0QJvOlDQdU` / 02 UI / `114:2511`, 390×844.
- [User’s screenshot](user-reference.png) is the layout position reference. The card in the currently connected Figma is x14/y138 and the exit is y519, which is different from the screenshot; it has been explained to the user that the screenshot shall prevail this time. The card in the screenshot corresponds to approximately x16/y173, and exits approximately y564.
- [Desktop Bridge original export](figma-original.png) Leave the Figma file as is, unmodified.

## Confirmed problem and code modification

Old `SessionState` uses universal connection/error card. The card's marginTop138 overlaps the status bar and page header, and the exit area adds marginTop104, which cannot be equal to the absolute position of the design. The old page still lacks the return arrow, 116 rings, 90 icon background colors, timing and recovery instructions. The icon is a text arrow, and the color, font and button are different.

Add `ReconnectingScreen`, enter from the `active + media.reconnecting` state that has actually joined the session:

| Area            | Measurements and assets used                                                                                                              |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Header          | Return 40×40, original white return icon 24; title 28/39 Bold, left 64; subtitle 12/17, left 64                                           |
| Pages and Cards | The page background follows #2A2149; the ordinary card is 358×345, rounded 24, #3A2B5A; the location is subject to the user’s screenshot. |
| icon            | Original export refresh icon 28; purple background 90, #6247E8; cyan ring 116, inner border 3, #23C8BE                                    |
| Text            | Title 21/29 Bold; timing 18/25 Regular; description 12/18 Regular, #C9BEE5, using actual Noto Sans SC static font weight                  |
| Exit            | width 350, height 56, rounded corners 14, #EEE8FF, text 14/20 Medium #5538D8; spacing behind the card 46                                  |

`VoicePage` adds an optional connection appearance. The reconnection page uses the preview status bar font weight and font size that is smaller than the original version; the remaining voice pages retain the original appearance.

## Data and Actions

- Both the return arrow and the exit button call the existing `session.leave()`, not only switching pages but leaving membership behind. The room host needs to take over, the exit fails, or the original exit status is still entered when exiting.
- Don’t write down the timer to 00:42. When the room host and there is a valid server `RoomDetail.hostReconnectDeadline`, the real remaining time is displayed; otherwise, only the elapsed time of the reconnection page is displayed, and the 60-second server period is not forged.
- Reaching zero does not automatically capture, hand over or end the room, the final result continues to be confirmed by the server.
- Timing to pause updates in the background and resume when returning to the foreground, page uninstall cleanup timer and AppState monitoring.
- Keep the existing LiveKit automatic recovery, failure retry, exit and member fact synchronization, and do not add new endpoints, contract fields, database or Redis changes.

## Verification status at first modification

No lint, typecheck, unit tests, Playwright, build, APK packaging or deployment was run at this time, and no PR was pushed or created, following user instructions to pause testing and deployment. Only design reading, source code verification, code modification and formatting.

The code modification has been completed and has not yet been verified. After waiting for the queued tasks to be completed, unified supplement: 390×844 actual running screenshot comparison, real reconnection/recovery/exit behavior, timing and front and backend life cycle, shared VoicePage regression and Android physical device verification. Currently does not claim 1:1 PASS or is online.

## 2026-10-10 Resume verification

The user then authorizes testing, push, deployment and APK updates. The mobile version typecheck/lint and 51 suites / 170 tests passed; the new reconnection regression covers two exit entrances, real room host period, background suspension, no unauthorized exit to zero and monitoring cleanup after recovery. The complete browser harness passed 14/14. Its 3 reconnection flows verify layout, recovery, and both exit actions. Media and HTTP are still explicitly test adapters and are not a substitute for physical disconnection or real LiveKit proof.

390×844, DPR3 actual measurement: card x16/y173/358×345, button x18/y564/350×56, consistent with the position benchmark of this user’s screenshot. [Running screenshot](runtime-390.png), [Left original and right running comparison](comparison.png), [Overlay](overlay.png) Viewed, header, ring, icon, timing, description and exit button aligned. Scaled the full app frame proportionally to the running screenshot compared to the external white canvas and title with only the user screenshot removed; no app differences were cropped, stretched, or redrawn. The original image is retained.

Android Hermes export with two Pages build passes. The current web layout and adapter behavior pass; Android physical device rendering, actual front and backend and audio recovery are checked by the user after installation, and cross-platform 1:1 PASS is not claimed. The online status is subject to verification by this release.
