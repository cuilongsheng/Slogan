# Room list layout check

## Scope and Authorization

2026-10-10 The user confirmed that the screenshot was the room discovery list of "Open Chat", and selected "Only adjust the layout this time, and do not add languages and categories for the time being". This is a visual correction of the existing `implement-mobile-room-discovery-join`. It retains the behavior of the current `direct-room-entry` and does not add product functions, contract fields or persistence models.

- Figma Desktop Bridge：Slogan / `56nIowZmvBhb0QJvOlDQdU` / 02 UI / `115:1197` / `02 UI / Rooms / Pilot V2 · review`。
- Original size: 390×844; original remains unchanged.
- Product routing: Default room list for qualified logged-in users; component `RoomListScreen`.
- Running evidence: The real React Native component in `tests/visual-harness` is running under RN Web; HTTP is a clear fixture within the OpenAPI contract, not a production interface or Android physical device.
- Code baseline: `0152ba27c22b20ec70109ab7e68c203230225d11` plus local workspace modifications.

## Check and modify

| Area                        | Original manuscript basis                                                   | Implementation and results                                                                                                                                                                                                                                                               |
| --------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Header                      | Title x16/y51, 24/32 Noto Sans SC Bold; Brand 32×32, Create 42×42           | Use actual static fonts and original exported icons; remove old subtitles, remove create button translucency                                                                                                                                                                             |
| Screening and Quantity      | Filter line y95, list start y142                                            | Keep "All" and the actual number of loaded contracts; language filtering and classification will not be increased temporarily according to the user's decision. When the cursor is not over, it is still clearly "loaded" and the total number is not false.                             |
| Card                        | x15, width 358, height 132, y142/279/416/553, spacing 5, rounded corners 24 | The browser measures the four ordinary room cards to be consistent one by one; the color matching is purple/blue/purple/mint according to the original; extra description lines are reserved for rooms with processing enabled, and the processing fact cannot be hidden for screenshots |
| Text                        | Topic 16/24, room host 13/18, remaining time 11/15, level 12/16             | Use AppText uniformly to correspond to the original font thickness; retain the actual grade range and remaining time                                                                                                                                                                     |
| Status and number of people | Can add green, full red, password lock, 42×36 capacity mark                 | From the real contract attributes; the password lock is exported from the original. Ordinary cards delete the redundant two lines that are not processed; continue to display clearly when enabled                                                                                       |
| Bottom navigation           | y764, height 80, icon 24, selected circle 48                                | Re-export the four original icons, correct all icon and label coordinates; "Create" and "My" retain the real routes                                                                                                                                                                      |

## API and unresolved differences

`GET /v1/rooms` continues to be reused with the generated client without contract changes.

- READY: topic, level and scope, room host nickname, number of people/capacity, end time, password, room host reconnection, processing enable status, cursor paging.
- User clear suspension: room language and "English/Chinese" filtering, topic classification and classification tags.
- MISSING: room host avatar, member avatar preview, total number of servers. Figma's sample characters are not written into the production code; the existing initials are still retained, and no member avatars are forged.
- Existing product gaps: the independent "find partners" and private chat lists are not completed, and the two navigation entries are still static items; this time, the room list has not been revised to pretend that these functions are completed.
- Other content differences: the actual number is consistent with the projects loaded in the backend, and 12 is not hard-coded; the level range of the actual room does not degenerate into the single level of the design example; the actual remaining time is still displayed when full.

## Verification

- Mobile typecheck, lint: passed.
- Complete test on mobile phone: 51 suites / 167 tests passed.
- Browser: 2 tests passed, covering the card position and size of real components, authentication to generate client requests, direct room navigation, error retry, creation and personal page navigation. No page exception, no horizontal overflow.
- Android Hermes export: passed, `/tmp/slogan-room-list-layout-final`; this is resource/code packaging, not APK or physical device acceptance.
- [Original Figma](figma-original.png)、[Screenshot of current operation](runtime-390.png)。 The two original pictures are both 1170×2532, and the page differences have not been cropped or modified; the two pictures have been viewed directly in this round. The independent overlay file has not been generated yet.

## Conclusion

This layout modification that can be supported by existing contracts has been completed. Overall visual result is PARTIAL: avatar preview still lacks contract, language/category is clearly on hold; full page 1:1 PASS cannot be claimed. Web evidence does not authenticate Android physical device rendering, physical device verification is performed by the user.

No public APKs have been pushed, proposed, released or updated this time. The previous batch of local invitations/online status modifications are still retained independently, and their unfinished partner and private chat functions are not counted as delivered items this time.

The user then requested "Don't do testing and deployment now, there are still tasks later." The above check is a record completed before the request arrives; subsequent additional tests, deployments and APK updates will be suspended until the queued tasks are summarized before unified verification.

## 2026-10-10 Review before publishing

The user has resumed testing and release authorization. This batch of complete mobile version typecheck/lint, 51 suites / 170 tests, browser harness 14/14 (including this function path), Android Hermes export and two Pages were built and passed. The original functions, visuals and provider/device gaps are retained and will not be recorded as completed due to packaging and release. Production submissions and APKs will be checked against existing release thresholds; local testing will not be considered as evidence of online dual accounts or native devices.
