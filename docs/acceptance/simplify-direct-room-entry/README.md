# Direct entry verification

## Latest status: 2026-10-09 Automatic equipment inspection supplement, not yet released

The latest user request covers the previous behavior of "asking after opening the mic for the first time": Now automatically check system permissions, temporary microphone audio track and playback status after connecting to the room; Android checks the available output of the started LiveKit AudioSession, and the Web uses the actual playback permission status. The detection will not be published, recorded or uploaded, completion/cancellation will always stop, React Native also calls MediaStream.release; the room microphone is turned off by default.

Permission denied, permanent denial, no input/output or playback blocked gives a concise prompt in the room, retry and necessary system settings/turn on sound actions, does not require a fixed device to prepare the page. The output API cannot prove that the physical speaker is audible; actual listening is still verified by the user's physical device. There are generation/resource release tests for exiting before the check is completed, late connection, and explicit opening of microphone and detection competition. Process-level native audio sessions are serially acquired/released by the room holder to prevent the exit of the old room from stopping the audio of the new room.

Local mobile lint/typecheck, 50 suites/162 tests, 10 Expo Router Web portal and authorization regressions, 3 real component visual/interaction verification passed; Pages build and Android Hermes bundle export passed. The native adapter unit test uses a clear SDK/device stand-in and does not connect to the physical device; these checks are not regarded as real listening or complete APK installation acceptance.

`device-warning-runtime-fixture.png`: 390×844 Actual in-room components, devices/sessions and messages using explicit test fixtures, showing permanent deny and retries; no pretending to be true Android permission status. The original manuscript 115:1425 is not modified, and the error message belongs to the user-approved supplementary status.

Publishing is suspended at the explicit request of the user. The previous commit e89a786 has pushed the correction branch, but no PR, merge or update of the production APK has been created in this round; this automatic check and create/background/request corrections are only saved locally. Production status is not inferred from the local PASS for this report.

The following are the historical verification records of previous batches. Equipment inspection behavior shall be subject to this section.

Date: 2026-10-09. The demand comes from the user's request to "click on the room and join the room", corresponding to OpenSpec `simplify-direct-room-entry`. The release status must be based on PR and production records. This file first records the local results.

Click the list card to directly enter the session and initiate the real membership API; double-click to avoid repeated navigation. The details page retains the sharing link entrance, and its join button also leads directly to the session. You only need to enter a four-digit password in the password room, and you will be directed to the session after submission. Retain backend qualifications, capacity, password, authorization verification and failed retries; no longer go through the fixed three pages of details, rules, and equipment. Request native permissions when the microphone is first enabled; members enter rooms muted by default. Never publish microphone audio after the member exits while a permission request is pending.

`rulesAccepted` is still an existing API contract field, and is directly added to the intent to send true; this does not mean that the user has read the old rule page, and the prerequisite requirements of the old rules are explicitly removed in this change. Voice processing purpose authorization is reserved independently: the consent component is displayed only when the current purpose authorization is missing, and the user can only retry after explicitly accepting it, and ACCEPT is not automatically called. The old rules/device URL remains compatible, but is not on the new list addition path.

Local: mobile lint, typecheck, 46 test suites / 135 tests passed; 4 Playwright processes passed; `build:pages:mobile` passed; OpenSpec strict passed. Browser testing uses contract-shaped fixtures, with request ordering and routing run by actual components. Credentials intentionally returns 503, which is a failed recovery after verifying the occupied room, and does not represent true LiveKit connectivity or online acceptance.

Reproduce browser test: `pnpm exec playwright test --config tests/direct-entry.playwright.config.ts`. Test the Expo Web that starts port 8083 and closes it when finished.

## Figma and running evidence

Read Slogan `02 UI`, Section `115:1196`, List Frame `115:1197`, and Room Frame `115:1425` through the connected Figma Desktop Bridge. Original screenshot `list-original-figma.png` is retained as is. The user approved the interaction path change this round and did not require the list to be redrawn.

| Evidence                             | range/result                                                                                                                                                             |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `list-runtime-web-fixture.png`       | 390×844 actual list; click on the card to go directly to the session. The data and avatar are test fixtures.                                                             |
| `join-error-runtime-web-fixture.png` | Retry or exit when membership is successful or media fails, without jumping back to the fixed front page.                                                                |
| `consents-runtime-web-fixture.png`   | The purpose authorization is only displayed when the authorization is missing; the title of the dark page is readable, and the content is scrollable if it is too long.  |
| Original manuscript comparison       | The existing list still has differences in avatars, card heights, etc., and the entire mobile UI cannot be marked as 1:1 PASS; this round mainly changes the entry path. |

Android permissions, physical device audio and two-machine isolation are tested by users. Public deployment, background cleaning, independent cloud verification and new APK downloads need to be supplemented after release.

## 2026-10-09 physical device feedback correction

Previously, only the list and details buttons were covered, and the old rule/device components that could be entered were retained. Details deep linking and sharing would also stop on the details page; at the same time, the old version of the large speaker card was still used in the room. The full user path or new layout cannot be declared complete based on previous partial testing. The APK version used in the user's screenshot is not provided, and it cannot be determined based on the screenshot that the user installed it incorrectly.

This time, the old JoinScreens will be deleted, all details/rules/device/password routing will jump to the session, and the invitation identification will be retained; the shared instant room and invitations will follow the same path. Session does not require a draft memory for public rooms. The password room pops up first and requires valid input before requesting to join. Wrong passwords can be modified in the same pop-up window. Independent use authorization is still processed according to the original explicit authorization, and ACCEPT will never be forged; system permissions are requested only when the microphone is turned on for the first time.

Bridge reconfirms Slogan / 02 UI / 115:1425, 390×844, original `voice-original-figma.png`. Remove the old 172 high speech card; the rules are always displayed; the member bar is at y220–411, with four columns of members and an empty space in the center; the chat area occupies the remaining height and scrolls to display messages; native-language expression only displays the lower right round button; three parallel controls of input, send and microphone. Flag backgrounds, role badges, mute backgrounds, and the host’s minus button use the original design’s dimensions and colors. The minus button opens the existing removal confirmation; it does not immediately remove the member. Real production avatars are provided by user information, and original character photos are only used for testing fixtures.

Verification: mobile lint/typecheck, 47 suites / 142 tests, 10 real Expo Router Web portal/authorization regressions and 1 in-room component interaction test passed; Pages build, 4 Android delivery unit tests, OpenSpec strict passed. Covers four old URLs, sharing, invitation retention, missing and incorrect passwords, text sending, hold/release translation and room host takeover exit. Playwright configurations must be run serially to avoid the shared test-results directory being cleared by another configuration.

Running comparison `voice-runtime-web-fixture.png` using the same 390×844, Noto Sans SC 400/500/700 loaded, room host status, same original photos, B1·B2 and 38 minutes remaining. System text is explicit visual HTTP fixture data used to measure message layout and does not prove production system message interfaces. `voice-comparison.html` provides side-by-side and transparent overlays of the original image and the final running image, without modifying the original image.

Original draft/running layout check: header 88, rule 76, member 191, old speech card does not exist; chat and bottom bar are independent, bottom bar input 236×56, send 44×44, microphone 44×44, native language button 38×38. Behavior and web layout verified separately, no claims of Android 1:1 or dual-machine audio passed. There is currently no Android emulator or physical device connected to this machine. Native permissions/keyboard/audio are verified by the user according to established arrangements.

There are no API contracts, database migrations, Redis configuration or vendor changes at this time. The submission, version and SHA-256 of the production release and actual APK are recorded by this PR/Android workflow and release-artifacts; the packager has added a new check for the `voice-room-direct-entry-v2` mark in the APK to avoid only checking app.config and missing the JS interface version.
