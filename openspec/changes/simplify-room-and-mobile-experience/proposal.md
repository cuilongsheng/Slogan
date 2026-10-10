## Why

In actual experience, the background room list exposed technical fields and was mixed with historical rooms. The mobile phone lacked an exit entrance, the keyboard blocked input, the room message entrance was incorrectly connected to AI translation, and the recording and exit process was too cumbersome. The complete interaction needs to be corrected based on user feedback and the new version of Figma, and the room exit and external media clearance need to be decoupled.

## What Changes

- The background room management only displays ongoing and reserved rooms; it will be removed from the operation list after completion or cancellation. The card information is expanded directly, and the type is in Chinese; the UUID is not regarded as the room name that the user needs to understand.
- "My" only retains "My Restrictions and Appeals", "My Vocabulary" and "Exit"; reuse the existing real logout and credential cleanup.
- The input box, send or submit operations are visible when the mobile phone input is focused; the page is corrected according to the updated mobile Figma, and no unfounded decorations are added.
- When creating an instant/reservation room, use the three range options A1~~A2, B1~~B2, and C1~C2, which are directly visible; cancel the discoverability and room audio processing settings, and the default for new mobile rooms is PUBLIC and the two audio processing are turned off. The server is still compatible with any legal upper and lower limits, existing single-level rooms and old clients.
- Added ordinary room text messages, which will be scrolled and displayed in the room after being sent; completely separated from the private translation entrance.
- native-language expression uses hold to record and release to automatically submit, showing the main English results; according to the new version of Figma, the front-end recording is limited to a maximum of 10 seconds. The room microphone is muted during recording, and is turned back on after stopping private recording; the necessary first consent and permission judgment are retained, and the current explicit press and hold operation is used to confirm this processing, and repeated confirmation/mode switching/optional expression stacking are removed.
- Ordinary members exit directly; room hosts that still have other members choose a successor and exit, and they exit directly when they are alone. Exit without displaying the re-entry interface. **BREAKING**: When there is a successor member online, the room host can no longer omit the successor and the server automatically selects the second microphone; the front end needs to be upgraded simultaneously when publishing.
- The backend can return success after submitting member exit, handover or room closing. LiveKit undo/deletion is handled by persistent commands and background recovery; the user does not wait for the provider.

## Capabilities

### New Capabilities

- `admin-active-room-management`: Only the current room operation view and directly expanded readable cards.
- `mobile-experience-navigation`: Three personal entrances, real logout, keyboard visibility and new visual correction.
- `room-level-ranges`: Room class range contracts, creation, display, discovery and legacy data compatibility.
- `room-text-messages`: Normal text sending, scrolling display and member permissions in the current room.
- `private-expression-hold-to-talk`: Private press and hold recording translation, microphone isolation, automatic submission and concise results.

### Modified Capabilities

- `host-controls`: When voluntarily exiting, the successor is clearly selected, the normal/last person exits quickly, and the cleanup is asynchronous.
- `temporary-speech-processing`: The clear hold gesture and the continuously visible usage description of the current recording can complete this confirmation, and there is no need to confirm after recording.

## Impact

- Affects Architecture, Prototype/Figma, Backend/API, Frontend, Test/Acceptance, and Deployment (repackage Android, record versions, and rollbacks). iOS is not in this scope.
- The code involves admin rooms, mobile profile/room-creation/voice-room/auth, keyboard page shell, rooms/voice/assistance backend, Prisma and the only OpenAPI generated client.
- Divided into three batches: A. Basic page and level range; B. Normal messages and press and hold translation; C. Quick exit and background cleanup. Within each batch, the contract/backend is first, then the frontend, and finally acceptance; C does not depend on B and can be delivered first.
- Confirmed Figma file `56nIowZmvBhb0QJvOlDQdU`, page `102:2766 / 02 UI`. See design for original node and conflict records.
- Non-target: delete historical business records, remove independent capability backend, automatic broadcast translation, public private recording/transcription, store publishing, iOS.
- "My" design has been created under user supplementary authorization: `152:1467 / 02 UI / Me / 精简个人中心 · V3`, located at `09 手机端 / 我的 · 精简版`, screenshot and editable structure check passed.
- The upper and lower limit selection of level `153:1485` and the complete card of the current room `153:1524` have been supplemented, and the original Frame is retained. The creation, reservation, voice room, translation, handover and my original drawings have been saved; the complete running visual and Android status must still be accepted one by one, and the verification of the original to the running page cannot be replaced by a supplementary frame.
- Design default values ​​for review: ordinary messages can only be read in the current room, and no historical chats are provided after the end; the level range server supports any legal upper and lower limits in A1–C2, retaining single-level compatibility, and the mobile phone creation UI only has three fixed combinations according to the latest user requirements. They do not add to the product range of chat history or forced denial of entry by level.

2026-10-09 Supplementary scope: Correct topic title cropping, background business page to fill available width, message idle backoff and background pause/resume, room refresh and merge in transit. The release is suspended according to the user's request. This batch will be kept locally and the visual and device verification boundaries will be recorded.
