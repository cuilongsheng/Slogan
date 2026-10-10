## Context

See proposal.md. Existing RoomListScreen card navigation details, and then through rules/device, VoiceRoomSession calls membership and credentials. LiveKit turns off the microphone by default when entering a room, so a pre-recording check is not a requirement for connection.

Figma Desktop Bridge has been successfully detected in real time, file Slogan / 56nIowZmvBhb0QJvOlDQdU, 02 UI, list 115:1197, voice room 115:1425, 390×844. Keep the original card and voice room vision; canceling the intermediate page is a process difference explicitly authorized by the user, and the original will not be modified. The visual differences of existing room cards are not included in this global 1:1 PASS statement.

## Goals / Non-Goals

Goal: One-click entry with ordinary room card, joining after completing the password, and recovery after failure. Non-target: reservation semantics, password validation, user qualifications, vendors, databases, Google and iOS.

## Decisions

- Add the direct entry intention to the existing JoinProvider and use the unique generation API; do not add a new server endpoint and do not create another connection instance in the list. The existing rulesAccepted=true means that the entry operation is compatible and does not pretend to be a reading behavior.
- The list is synchronized to create a draft and navigate the session; the password room pops up the necessary password input in the current session; join directly after input and submission. Details, sharing, invitations and old rules/device/password deep links enter the session uniformly, and cannot go back to the old process.
- Add a return list entry to the SessionState failure interface; return password input if a password is missing; use the existing RoomConsentPanel to handle missing authorization, and try again after success without automatically submitting the authorization. It is still up to the backend to decide whether to allow or not to join.
- The default silent connection does not require pre-recording; the permission request and error handling of the actual opening of the microphone are maintained.
- It is saved in a clean existing delivery worktree and submitted separately from the background recovery patch to be launched; a PR can be reviewed and trigger the existing pipeline at the same time.

## Risks / Trade-offs

- [Cancel each rule check to change existing specifications] → The user explicitly authorizes, updates the corresponding delta, and the room entrance is retained.
- [Server status changed when joining] → Card snapshot is not trusted, and existing server-side checksum error results are retained.
- [Double-click or draft to wrong room] → Navigation lock, room identification and session-level deduplication in transit; test real component interaction.
- [Privacy processing requires explicit consent] → Only display existing authorization components for missing uses and do not inherit rulesAccepted alternative use authorization.

## Migration Plan

No schema or OpenAPI changes. PR preview, main production and APK use existing automatic delivery; merged to verify actual commits and pinned downloads. Rollback only rolls back the mobile navigation code and does not revoke the business member status. Static inspection, complete mobile suite, Pages construction, and browser component processes are recorded separately as evidence; system permissions and physical device are verified by the user, and Web cannot be used instead of Android.

## 2026-10-09 User acceptance correction

The user's physical device screenshot pointed out that the old preparation link still appeared, a pop-up window asking for a password was provided, and the new version of the voice room manuscript was provided. All instant room entrances are unified to session; old details/rules/device/password paths are redirected to session and the invitation ID is retained. The session establishes the intention to enter the room by itself, without relying on the easily lost memory draft of the previous page. When the password room lacks a valid password, a pop-up window is displayed first without calling membership; incorrect passwords are corrected in the same pop-up window.

Original 115:1425 Real-time Bridge Recheck: Cancel 172 The old speaker card, the rules are always displayed, the member bar is located at y220–411, the message area occupies the remaining height, the native-language expression is an independent round button in the lower right corner, and input/send/microphone are three parallel controls. Keep real photos/country/role/mute status and room host removal confirmation. The photos of production members are based on real user avatars and do not include sample characters.

## 2026-10-09 Automatic equipment inspection supplement

The user explicitly requested to check the microphone and audio directly after entering the room. What was canceled was the manual preparation page rather than the device verification. When connecting, the background automatically applies for system microphone permissions, obtains local temporary audio tracks, and stops immediately after checking live; the tracks are never published, recorded, or uploaded. The output check reuses the started LiveKit native audio session/available output, and the web monitoring actual playback permission status; output enumeration cannot prove that the physical speaker is audible, and physical device listening is still a separate acceptance.

Failure is restored with in-room compact prompts and retry/system settings entry, allowing silent listening or text communication without creating additional joining pages. Checking/Rejected/Permanently Rejected/Device Unavailable are recorded separately, checkout and new connection pass generation with AbortSignal to cancel old check results, stop temporary track. While the detection is in progress, explicitly turn on the microphone and wait for its release to avoid competing with private hold recording; the detection is only automatically executed once, and the foreground recovery only rechecks the failure status. No schema or permission contract changes, just roll back the adapter/prompt. When automatic checking is disabled, the actual permission judgment for opening the microphone is still retained.

The native LiveKit AudioSession is a process-level resource: the adapter serially acquires/releases and records the holder of each room instance. Exiting the old room does not stop the session still used in the next room. The connection phase uses generation to prevent late SDK connect after leaving the state or starting automatic detection; the detection stream calls stop and uses native MediaStream.release to release resources.
