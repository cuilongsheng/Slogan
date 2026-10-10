# Site invitation and social portal audit (local fix, not yet released)

Check baseline: production/main `0152ba27c22b20ec70109ab7e68c203230225d11`.

## Confirmed problem

- The free invitation of `VoiceRoomScreen` calls `setShareOpen(true)` to open the external sharing link popup.
- `RoomListScreen`'s "Find a Partner" and "Message" are static views without click callbacks; there is no corresponding independent route.
- `/me/social` has friends, inviteable users, relationship requests, blocks, and room invites; it has no private conversations or message history.
- `/v1/people/available`, `/v1/me/presence/heartbeat` and room invitation interfaces already exist. The backend screens idle candidates based on recent online signals, valid room occupancy, account qualifications and two-way blocking.
- The original heartbeat is only bound to the page focus of `SocialScreen`. Online idle users on other pages will disappear from the candidate list due to signal expiration.
- There are no models, migrations, OpenAPI operations, backend implementations, or mobile routing for one-to-one private chat yet; `add-partner-discovery-direct-conversations` is a work in progress (also including one-to-one voice). Text messages in the room are not private chats.

## Local repair scope

- Room host Click on the empty space to directly open the site selection popup; ordinary members cannot send room host invitations.
- Candidates use the real available API and no longer merge offline friends; exclude current members; send using the existing idempotent invitation interface and do not declare that the other party has joined.
- Uniformly maintain the front-end online signal of qualified accounts in the root layout after login. Stop renewal in the background, resume refresh in the foreground, clean up after exiting/changing accounts, old requests will not restart the timer; presence failure does not block room behavior.
- The invitation pop-up list no longer overflows below other controls at zero height. Original Desktop Bridge target `Slogan / 02 UI / 111:882` (390×844, bottom sheet 390×518); title, search, candidate lines, buttons, and descriptions use this node's geometry and font.
- The search filter has loaded candidates; subsequent cursors continue to be read by the existing "load more" operation, and the server-side full-text search is not created.

## Validation boundaries

- Local mobile phone typecheck, lint, 51 suites / 167 tests passed (including direct opening and sending, candidate filtering, front and backend and old account request cleaning).
- The browser-generated client invitation sending process passes (1 test); using actual VoiceRoomScreen, RoomControls and generated clients, the HTTP response is a clear test fixture; it is not an online dual-account invitation acceptance.
- Android Hermes export passed; not APK build, release, or physical device acceptance.
- `figma-invite.png` is the original target exported by Desktop Bridge; `runtime-invite.png` is the test run page. The user, sending status and underlying room are different, and the entire image pixels are not claimed to be consistent.
- There is no push, PR, database migration, deployment or update of public APK this time.

## Still missing

- Independent "find a partner" page and clickable navigation.
- One-to-one message conversation list, persistent history, sent, unread, unilateral deletion and safe interaction.
- The existing service allows offline friends to invite through the ordinary API (the friend path does not require presence); if the entire product only allows online idle targets, the server rules and the current OpenSpec need to be updated, and the qualification changes during the sending period must be verified.
- No independent partner/private chat page found for the currently connected 02 UI, old social pages cannot be passed off as the confirmed new design.

## 2026-10-10 Review before publishing

The user has resumed testing and release authorization. This batch of complete mobile version typecheck/lint, 51 suites / 170 tests, browser harness 14/14 (including this function path), Android Hermes export and two Pages were built and passed. The original functions, visuals and provider/device gaps are retained and will not be recorded as completed due to packaging and release. Production submissions and APKs will be checked against existing release thresholds; local testing will not be considered as evidence of online dual accounts or native devices.
