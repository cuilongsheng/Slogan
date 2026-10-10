## Context

See proposal for motivation and scope before approval. The current source code baseline read is develop `716cc0bd`. The existing APK release record is an independent unsubmitted document and is not included in the scope of this submission.

### Confirmed reasons and contract audit

|Feedback|Current Evidence|Conclusion/Processing|
|Backend history and folding|RoomsPage.tsx does not have status filtering by default; details controls card details; directly displays room.id/room.kind|The current contract supports a single status, but lacks the OPEN+SCHEDULED merge paging boundary; server query expansion is required, and local filtering after paging is not possible|
|Mine did not exit|MeScreen.tsx has five entries and no logout call; auth/context.tsx already has a real logout|The contract can be reused, access the real exit and delete redundant page entries|
|Keyboard blocked|RoomPage SafeAreaView overflow hidden, fixed bottom footer; create page with only ScrollView|You cannot just add keyboardShouldPersistTaps; you need page size adjustment, focus scrolling and bottom operation avoidance|
|The level is single level|Prisma CefrLevel has three sets of combined enumerations, but ROOM_CEFR_LEVELS in rooms/domain/entities/room.ts has only six single levels, and DTOs and build contracts follow this constant|PARTIAL; add upper and lower limit fields and compatible mapping, you cannot just replace the B1 string with B1–B2|
|Message entry error|VoiceRoomScreen composerInput is TouchableOpacity, open ExpressionAssistSheet with initialMode=text; LiveKit token canPublishData=false|MISSING Ordinary room text message capability, requires independent real contract and transmission|
|Recording is cumbersome|ExpressionAssistSheet loading-consent/start/recording/confirm/loading/result and other multiple stages; usePrivateRecorder automatically stops in 30 seconds; only muteRoomMicrophone is passed in|Existing AI/STT contract reusable; lacks press-and-hold auto-commit and explicit unmute choreography|
|Exit is like rejoining|VoiceRoomSession.exit first awaits mute/disconnect, then awaits leave; fails to write phase=failed; SessionState displays leaving as connecting|You need to exit the state independently. Turn off the local audio first. Reconnecting or re-entering the room when leaving the room is prohibited.|
|Quit waiting for LiveKit|HostControlsController.run await host.execute and then await dispatchPending; if it fails, 503 will be thrown on the submitted result.|The database has been completed and was falsely reported as failure; decouple the leave request from provider dispatch|

### Figma Evidence and Confirmation Checklist

All read/write via Desktop Bridge plug-in, file `56nIowZmvBhb0QJvOlDQdU / Slogan`, page `102:2766 / 02 UI`. The original text and plug-in export screenshots have been checked; the user's original page has not been modified.

|Purpose|Frame|Dimensions|Status/Difference|
|Instant creation|111:979|390×844|New version of theme card, level range, direct content; upper and lower limits directly select supplementary status 153:1485 has been created, the original manuscript is retained|
|Appointment creation|121:3613|390×844|Date, time and same room configuration; original full Frame screenshot archived|
|Voice room|115:1425|390×844|Normal input + send at the bottom, independent private translation entrance, scrolling message area; real-time transcription of sample speech text is not allowed|
|Press and hold to translate|115:1627|390×844|Press and hold to start speaking, release to generate English, up to 10 seconds|
|English results|115:1720|390×844|Only main English results, no tone and multi-select expression stacking|
|Room host handover exit|111:906|390×844|Only room host needs to take over the selector|
|Admin room|114:1602|1440×900|The old design still has ended cards and folds, which conflicts with this clear feedback; supplementary status 153:1524 The complete card has been created, and the old image is retained|
|Mine|152:1467|390×844|The user explicitly authorized this repainting; existing Noto Sans SC, background variables and three Button instances, automatic layout, no new irrelevant business entrance; final screenshot inspection passed|

The personal page navigation uses the return entrance; if the navigation structure of the new mobile phone changes, it must be adjusted according to the specific original Frame. All mobile phone UI updates will first list the specific Frame/routing set to avoid equating "all adjustments" with guessing unread designs. When missing status occurs subsequently, only the target status will be filled, and the page adjusted by the user will not be redrawn.

## Goals / Non-Goals

**Goals:** completes the actual visible behavior of the user and maintains server membership, permissions, and session facts; short speech is only processed on the private link; the production exit response does not rely on LiveKit availability.

**Non-Goals:** Rewrite personal CEFR, force room entry refusal based on room level, automatically play English, room audio transcription, delete business history, add user confirmation for each operation, iOS.

## Decisions

### 1. Adopt existing NestJS code-first contract process

Update unique openapi/openapi.yaml via existing openapi:generate after modifying the DTO/controller/domain that owns the interface, and generate packages/api-client. Maintaining a second handwritten front-end type will cause the interface to be misconnected again, so it is not used.

Add compatible upper and lower limit fields to the room; single-level requests are interpreted as min=max, and existing combined enums can be decoded into ranges. Server validates CEFR order and inconsistent mixed input. Personal data CefrLevel will not be changed. It is publicly discovered that the new range query intersects by interval, and the old precise single-level filtering still maintains the original semantics; the cursor is bound to the actual filtering conditions. Persistence can use two new nullable fields and old data backfill, without deleting the original cefrLevel; the representative value compatible with the old output will not be used as the display source of the new version range.

The background room query adds an explicit query boundary that only takes the current operation collection, and is bound to status/q/visibility/from and the cursor; the client requests this collection by default, and only provides all three status entries of current, in progress, and reservation. Reservation information must not be spliced ​​into two pages of results to forge global paging. The type is translated as instant/appointment, the UUID can be used for technical retrieval and audit, and does not appear in the main card information; there is no fictitious R-2409 without a real readable number contract.

### 2. Ordinary messages use the server-side authenticated room message interface

It is planned to add sending POST and cursor-based incremental reading GET /v1/rooms/{roomId}/messages, using the current member and account qualification check, clientRequestId idempotent, server time/serial number, and visible sender nickname; the client periodically reads incrementally and cancels it when leaving the room. The message is plain text, does not support HTML, limits the length and request rate; the default length limit is 1000 Unicode code points, consistent with the existing text boundaries, and is an implementation default value for review.

Reuse PostgreSQL facts with existing domain/repository boundaries, add minimal RoomTextMessage model and index. Only provides reading of current room messages, and refuses to read and write after the room is closed; cleanup at the end of the text and regular cleaning of the bottom line are implemented at the same time, and the chat history is not guaranteed. The specific short-term retention configuration is specified in the migration/acceptance record, and the text is prohibited from entering the log.

Do not directly change LiveKit canPublishData to true: it is difficult for the client to directly verify the message permissions/idempotent/current limit on the server, and the old token will also be sent during the revocation delay. The Vercel long connection WebSocket service will not be added; controlled incremental reading under the existing serverless API is easier to deploy reliably. Message latency and request cost are controlled with active room-only polling, background pauses, and short incremental responses. If the audit requires long-term history or low-latency strong real-time transmission, the plan needs to be adjusted independently.

### 3. Press and hold to record is a private transaction

The entrance only enters the existing Figma recording layer; after valid permissions and usage are agreed, onPressIn: Confirm that the room is muted → start private recording. onPressOut: Stop recording→Restore available room microphone→Automatically upload and display generated Chinese/mainly English results. Reuse the consent/audio API without modifying the main English result contract; the first valid consent is still processed, the current usage prompt remains visible, the user actively presses the gesture to form noticeConfirmed, and the confirmation is repeated after no longer recording.

Use the recording generation and request UUID to prevent repeated uploading due to rapid press/release, asynchronous start that has not yet ended, automatic 10-second cutoff and release at the same time. Use the clip returned by recorder.stop as the submission fact and do not wait for the React clip state to be updated. Release processing resources on cancellation, room departure, or transition to the background. Room microphone audio must not be republished until release succeeds. Translation wait does not extend room silence. Provide concise feedback when recovery fails, and do not falsely report that the microphone is open; account or room permissions will not be restored if they fail. Real Android verification Expo recorder competes with LiveKit AudioSession's device audio and cannot be replaced by unit tests.

### 4. Complete the business before exiting, and the provider will converge in the background.

Preserve HostControlsService's transactions, member generations, concurrency locks, permission transfers, endLocked and REVOKE_IDENTITY/DELETE_ROOM persistent commands. The leave controller returns the business results and PENDING cleanup status after the transaction is submitted, does not inline dispatchPending, and does not return 503 because the provider is unavailable. Other remove/end/invite behaviors are not changed incidentally.

Ordinary members can exit directly without elasticity; room host must be selected if there are other online members, but room host cannot be selected alone. The server rejects illegal/expired successors. Failure only leaves the simple handover interface and does not send members back to the joining process. Independent leaving/leave-unconfirmed status processing network failure; local media is immediately muted, stops listening and disconnected, without waiting for the provider. It is not a local unfounded forgery database exit; the business interface response is lost and retry/confirm with the original expectedCredentialVersion idempotent.

Local audio can be stopped when the network is unavailable, but it must be distinguished that the server exits without confirmation. The recovery responsibility is borne by the backend, and the UI does not display "Rejoin"; the pending exit credentials cannot be used for the next join. Process survival after an async void or Vercel response must not be considered a durable task delivery. The actual running platform and recovery trigger of the existing runner must be verified; if a reliable worker/scheduler is not deployed, complete reliable triggering, command scanning and retry evidence of the target environment before releasing C.

### 4.1 Vercel managed queue adaptation

According to users’ questions about Vercel workers, the existing Vercel API uses Queues independent private consumers to undertake short tasks; the public Nest API and consumption functions are built separately. The database still has persistent command and recovery facts and cannot rely solely on post-response process survival. Hosted mode does not start the in-process Worker/timer, and the next scan is issued after the consumer scans; exceptions are retried by the queue. Other environments retain the BullMQ solution.

Seeding is performed within the request context of the public API, published by the platform `waitUntil` tracking queue, HTTP does not wait for provider cleanup. Concurrent requests share in-transit seeding, and will cool down for five minutes after success; failure will not be cached, and the next request will be retried. Subsequent requests can restart the interrupted scan chain. Do not send recovery messages during startup to avoid relying on a request OIDC context that does not yet exist. Private consumers and PostgreSQL persistent facts remain unchanged.

See `docs/deployment/room-experience-vercel-queues.md` for beta, retention period, initial seeding/scanning broken link, repeated delivery, release sequence and rollback boundary. Local build and failure testing have been completed, cloud scheduling evidence is still the release threshold; users are not required to purchase additional resident servers, and it is not claimed that persistent media subscription workers can be directly moved into short task queues.

### 5. Streamline entry and keyboard behavior

MeScreen interfaces with existing useAuth().logout; keeps honest results of undo failures but keeps local session cleanup intact. Remove redundant entries from the personal page without deleting other functional contracts or backends. Keyboard avoidance is handled in the shared page shell to handle the layout size, form focus scrolling is handled in each screen, and voice room message input is separately prevented from being blocked by the composer at the bottom; check the superposition of Android adjustResize and SafeArea/fixed footer, and do not add global blind padding.

## Risks / Trade-offs

- [New message lacks existing contract] → Server permissions, idempotent, and contract generation must be implemented first, and then the message UI is connected; success is proven by not releasing fake messages.
- [Level old client/migration drift] → Incremental migration, backfill, old request contract testing, direct replacement of user level enumeration is prohibited.
- [room host old APK without successor field] → The new behavior is a compatibility change; the new version of the mobile phone version is released simultaneously and stable errors are given, and the version threshold is recorded.
- [Old LiveKit audio credentials during asynchronous revocation] → Business members immediately expire, short-term credentials are maintained with existing identity revocation; the failure recovery verification provider is eventually kicked out, and zero-delay revocation cannot be promised.
- [Press and hold to leak the recording or get stuck in mute] → start/stop sequence and cancel race test, dual-device listening and physical device audio recovery; the recording is private and not persistent.
- [Simplified UI Hide Necessary Use Control] → The first time you agree to keep the minimum prompt, there is a withdrawal channel to maintain the three lists that are actually accessible but do not reinsert "My"; it is the responsibility of the existing associated function/account control entrance, and the path is verified before publishing.
- [Infinite scroll message or polling resource leak] → Bounded paging/memory windows, unsubscribe, checkout and background stop polling, rate limiting.

## Migration Plan

1. Review this proposal/specs/design/tasks and the new "my" design; complete a clear list of visual difference nodes and apply batch by batch.
2. A: First migrate the local migration and compatible contracts, and then the background and mobile basic pages; the relevant tests/screenshots passed. C can be delivered after A before B.
3. B: Message model/interface/cleanup → client-side real dual-member message; press and hold to translate to use the existing provider configuration, real STT/AI availability is confirmed separately, and the key/provider is not changed without authorization.
4. C: Verify continued background command processing and expire old credentials before issuing a quick exit. First inject LiveKit timeout in the isolation environment and confirm the API success, database failure, and final cleanup.
5. Completed the full affected scope lint/typecheck/test/build, OpenAPI check, Playwright management process, Android physical device keyboard/message/press and hold recording/exit control. Regenerate standalone APK and record SHA, signature, API, version and clear unaccepted items; not released to iOS this time.
6. Rollback retains newly added data columns; message capability disables the rollback front-end entry; submitted member LEFT/room closing or deletion uncleaned commands must not be rolled back. Wait for commands to drain before rolling back the processor to avoid losing undo/delete tasks.

## 2026-10-09 User acceptance supplement (approved for implementation, release suspended)

The user explicitly adjusts the mobile phone creation page to three directly visible options, A1~~A2, B1~~B2, and C1~C2, and cancels discoverability and room audio processing controls. The default value of PUBLIC will be used for new mobile rooms, and the audio processing flags of the two rooms are fixed to false; the backend legal arbitrary range, old clients and existing room usage authorizations will not be deleted. This user supplement covers the selection interaction of the old upper and lower limit selection Frame, and the remaining themes/capacities/passwords/reservation visuals still follow the Bridge originals 111:979, 121:3613.

The theme title container cancels the 20px fixed height, explicit line height and minimum height to accommodate Android Chinese fonts. Remove the 1440px width limit of shared page-content from all business pages on the admin app, and retain the width boundaries of sidebars, padding, horizontal scrolling of tables, and the pop-up window itself.

The constant two-second polling for in-room messages is changed to two seconds for new messages, and the continuous empty page gradually backs off to ten seconds; local transmission is displayed immediately and fast synchronization is resumed. Stop the request in the background, return to the front desk to complete the incremental request immediately, and cancel the departure; do not change the server member authentication or canPublishData. Room details/members are retained for fifteen seconds, the front and backend life cycles are bound, and merged and refreshed on the way. LiveKit regions are SDK refresh region configurations based on the server-side cache period. They do not belong to the business interface cycle and do not hide requests by disabling SDK recovery.

This batch only has client changes, no database migration; just roll back the corresponding UI/polling/device adapter. The user requested to queue up the task first. This batch will not be pushed, create a new PR, merge, deploy or publish the APK. Device and full end-to-end provider acceptance is still performed by the physical device.
