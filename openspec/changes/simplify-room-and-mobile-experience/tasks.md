## 1. Design and implementation boundaries

- [x] 1.1 Review the compatibility changes of the seven capabilities delta, scope compatibility and room host selection; acceptance: record the approved scope and the boundaries that will not automatically delete the history.
- [x] 1.2 Confirm the latest mobile Frame/routing page by page, complete the background expansion card and level upper and lower limit selection status, reuse and add my 152:1467; Acceptance: The original Frame screenshot and node list are complete, and the differences can be reviewed.

## 2. Batch A: Basic page and level range

- [x] 2.1 Expand the background current room query set and cursor binding; Acceptance: The filtering, total number, paging and permission test of mixed OPEN/SCHEDULED/ENDED/CANCELLED data passed.
- [x] 2.2 adds compatible fields, verification and incremental migration for the upper and lower limits of room levels, covering instant/reservation/sharing/query; acceptance: single-level old requests are valid, B1–B2 round-trips are consistent, inversion range rejection, local backfill and old data reading tests pass.
- [x] 2.3 Generate unique OpenAPI and client from code-first DTO; acceptance: openapi:check and old and new request contract tests passed.
- [ ] 2.4 The background only displays the current room, complete direct cards and Chinese types, and removes the UUID main display; acceptance: Playwright disappears after finishing the room, the card does not need to be expanded, and Figma comparison screenshots.
- [ ] 2.5 My page is changed to three entrances and connected to the real logout; acceptance: two entrances are reachable, certificate cleaning, server revocation and failure feedback test, 152:1467 visual comparison. The behavioral test and web comparison have been completed, the source font and font weight have been reviewed, and the Android comparison has not been completed.
- [x] 2.6 Use directly visible upper and lower level limits for instant and reservation creation, update room list/details/share display; Acceptance: Really create B1–B2 rooms, all interfaces are consistent and personal level remains unchanged.
- [ ] 2.7 Corrected the keyboard avoidance of page shell and form/bottom operations; Acceptance: Android login, information, created theme/password/time, room messages and notes and other input focus item-by-device recording without blocking input and operations.

## 3. Batch B: real room text messages

- [x] 3.1 Added RoomTextMessage model, index and migration; acceptance: local migration successful, request idempotent and cursor order repository test passed.
- [x] 3.2 Added room message sending and incremental reading use case, server member authorization, current limit, plain text boundary and end cleaning; acceptance: non-member/left/removed are rejected, repeated requests are not repeated, the room cannot be read and written after closing, and the body cleaning test is passed.
- [x] 3.3 Generate message OpenAPI/client and confirm that the unique contract is consistent; acceptance: schema verification, generation check and HTTP contract test pass.
- [ ] 3.4 room composer changed to real TextInput/send button, separated from AI request; realized message scrolling, incremental reading and departure/background cancellation; acceptance: real sending and receiving of two members, non-repetition of failed retries, no polling after exit, 115:1425 screenshot comparison.

## 4. Batch B: Press and hold native language translation

- [ ] 4.1 Prompt and clearly press and hold the gesture according to the current purpose to achieve immediate confirmation, retain the first permission/valid consent and accessible withdrawal path; acceptance: no consent rejection, valid gesture success, withdrawal/version update blocking processing, first prompt and subsequent short process screenshots.
- [x] 4.2 changed the recording arrangement to press and hold to start, release/automatically stop in 10 seconds and submit; use stop to return to clip to realize recording generation and idempotent; acceptance: quick release, double stop, 10 seconds cutoff, cancel without uploading, retry in the same segment and use UUID test passed.
- [ ] 4.3 implements the confirmation of mute during recording, turning on the microphone after stopping and the main English results, and removes the post-recording upload confirmation/text mode/tone/multiple candidates in the regular process; acceptance: 115:1627/115:1720 visual comparison, real STT/AI returns the main English.
- [ ] 4.4 Verify that the recording is coordinated with the device audio of LiveKit; Acceptance: On the two Android devices, observers cannot hear the private recording, and can continue to communicate after releasing it. Recording fails/translation fails/cuts to the background/leaves the room without residual collection.

## 5. Batch C: quick exit and background convergence (can precede Batch B)

- [x] 5.1 leave controller returns business success/PENDING after transaction submission, removes its synchronized LiveKit dispatch and submitted result 503; acceptance: when the injection provider times out/fails, leave succeeds and does not call provider I/O within the request, and the persistent command exists.
- [x] 5.2 The server implements clear takeover selection and the last person's business closure, retaining the generation idempotent/concurrency lock/old certificate rejection; acceptance: takeover failure, two concurrent exits, room host no selection rejection, last person exit and response loss retry test passed.
- [ ] 5.3 Verify and complete the target environment's continuous command scanning, retry and recovery triggering; acceptance: undo/deletion can still be performed after the request response is completed, the command converges after restart and provider recovery, and the actual scheduling record can be reviewed.
- [x] 5.4 Ordinary members of the client log out directly, room host only takes over the selection, and room host alone logs out directly; separate logout and reconnection UI and handle unconfirmed network; acceptance: each role exits and returns to discovery, no rejoining interface, repeated clicks/loss of responses will not affect the generation of new members.
- [ ] 5.5 Verify that local media stop and server cleanup are completed respectively; acceptance: Android stops audio immediately after clicking to exit, the last person gets business success even if the provider is down, and there are no ghost rooms and invalid identities after recovery.

## 6. Complete acceptance and Android delivery

- [ ] 6.1 finally runs the full affected scope of lint/typecheck/tests/build/OpenAPI check, Playwright and Android device verification; acceptance: record the actual passing results, original Figma comparison and unexecuted items, and do not use Web evidence to replace the microphone physical device evidence.
- [ ] 6.2 After approval, sync/archive requirements, repackage Android and update release records; acceptance: APK signature, built-in API, version, SHA, installation and key process checks are complete, Git/deployment boundaries and rollback paths are clear, iOS is not touched.

## Evidence status of this round

2026-10-07: The above checked options are supported by local migration, HTTP/component/browser testing; see `docs/acceptance/simplify-room-and-mobile-experience/README.md` for complete evidence and unimplemented items. The unchecked option retains the visual, physical device or cloud threshold, which does not mean it has been archived/deployed. Figma Desktop Bridge has resumed reading/exporting; browser adapter screenshots of voice room, hold/result, handover and first consent that already have real components cannot replace native/real provider acceptance. Android `adb devices -l` No device. Vercel has independent consumer local builds and failure recovery tests, without the need to purchase additional resident servers, but there is no cloud scheduling record.

## 7. Subsequent user acceptance correction (2026-10-09, release suspended)

- [x] 7.1 Create instant/scheduled rooms using three scopes; remove discoverability and room audio handling UI, verify default request values and topic titles are not clipped.
- [x] 7.2 All backend business pages fill the available width on the right side of the sidebar, verifying the true layout of large screens and design widths.
- [x] 7.3 Message idle backoff, front and backend pause recovery and in-transit room refresh merge, verify that there are no repeated timers or requests after exit.
- [x] 7.4 Run affected front-end inspection and visual comparison; save local results and wait for the user to resume publishing, and the physical device is verified by the user.
