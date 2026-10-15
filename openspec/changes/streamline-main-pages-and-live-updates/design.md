# Design

## Targets

Desktop Bridge file 56nIowZmvBhb0QJvOlDQdU / 02 UI, section 186:2347: Partners 186:2348, Messages 186:2369, Chat 186:2389, Incoming 186:2407, Active 186:2418, all 390×844. Me source 152:1473. Native safe areas and the previously authorized 402×874 web maximum remain.

The earlier approved batch used 18px headings and removed main-tab headings. The latest shell revision below supersedes those heading decisions. The owner subsequently replaced Partners Chat and Messages View text buttons with 34px circular chat-icon actions. Keep their functional controls and content. Chat has 34px content-sized bubbles with 14px/20px text, 10px side margins and about 14px vertical gaps. Composer retains a 50px base, adequate internal line space and grows to 120px. Incoming/active calls follow original source geometry; titles use 18px. The replacement receiver is an editable 24px rounded SVG exported through Desktop Bridge. Preserve original unrelated frames.

## Updates

The shared polling scheduler remains for chat/call/invitation behavior. The owner-approved `replace-main-list-polling-with-sse` change supersedes main-list and unread transport with one foreground authenticated subscription, scope invalidations and snapshot revalidation. Treat unknown initial native AppState as eligible to start, while known background/inactive states and hidden web documents pause. Schedule from request start, with a 500ms minimum idle gap; callbacks catch their own product errors. Resume during an older pending request queues one immediate rerun and invalidates its display writes. No requests overlap within a scheduler.

Discover, Partners and Messages revalidate on focus, foreground, manual action and their SSE scope invalidation, without recurring list timers. The open host invitation picker retains its five-second foreground refresh. Existing content stays visible during refresh. The invitation picker uses /v1/people/available, filters current members, retains loaded cursor pages, and exposes empty/error refresh instead of freezing its initial snapshot. Cursor pages remain bounded; refresh starts from the current head. Presence heartbeat starts immediately for an eligible logged-in actor and follows server renewal advice. The foreground unread observer reads its lightweight aggregate on the shared messages scope and foreground recovery across routes. UI displays actual counts (99+ visually) on the Messages tab and in unread conversation rows. Accounts never share notification state.

GET /v1/me/conversations/unread returns only the authenticated actor's total unread message count, excluding sent messages and rows at or below max(hiddenThrough, readThrough). Qualification is checked; no target identifier or message content is accepted or returned. Existing generated clients consume the code-first contract. Direct chat no longer waits for conversation detail before requesting messages/calls. It acknowledges loaded text only while the conversation is focused/foreground and at the bottom; a later call sequence must never acknowledge unseen text pages.

## Editing

The existing basic/preferences routes already permit eligible users. Add an explicit Edit profile action above Logout, rehydrate the draft from saved profile data at each edit entry, clear stale validation errors, and preserve nationality and optional values when submitting. Cancel returns to Me without changing the saved profile. A successful save refreshes auth profile state and returns to Me. New-user onboarding retains its existing flow and adult confirmation rules.

## Risk and rollback

The original polling/unread rollout required no schema migration; unread aggregation still uses current message/member indexes. The separately approved SSE change owns its additive outbox migration and forward-repair plan. Retained chat/call/invitation polling is foreground-only and bounded; it is eventual synchronization within the polling interval plus network time, not a claim of server push or instant delivery. Server TTL still owns offline presence. Backend failures preserve known UI data and remain retryable. Revert scheduler or observer independently if resource use regresses. Remove the optional unread endpoint/client polling to revert notification aggregation; no data rollback is required. Web verification is recorded with each batch; physical-device acceptance remains pending.

## Latest owner-approved shell revision

The latest instruction supersedes the earlier 18px/no-main-title override. Main tabs display centered titles; back-page headings use 16px and a shared 40px aligned row. Desktop Bridge targets: loading 206:2879, login 118:2970, create 190:2659 plus the original detached capacity/privacy card 206:3129, empty Partners 206:3032; 390x844. Preserve their original nodes. The main empty-title text extends outside its source bounds; owner-requested centering controls runtime alignment. Capacity node 206:3129 is outside the create frame but its measured content and the supplied complete screenshot own the intended layout. Ignore Figma editor annotations.

Render one reusable brand loading component for initial session restoration on index, Gate and sign-in. No delay or new network request. Place the same source logo, wordmark and two sparkle decorations on the loading page. Login omits the old promotional card. Empty successful lists show the soft Refresh action only; failures still expose a localized error and retry. Main headers do not alter polling or tabs. Create retains dynamic validation, password expansion, instant start/end time, and scheduled inputs with an opaque keyboard-aware footer. No backend, provider, role, consent or permission logic changes.

The owner correction on 2026-10-15 supersedes immediate branded startup rendering: mount AuthProvider immediately and restore authentication concurrently with fonts/locale. One root StartupGate owns initial rendering. Keep the existing background until readiness; show BrandLoading only if restoration remains pending after 180ms and its font/locale are ready. Do not hold a completed restore or mount a second branded page when readiness changes. This corrects frequent fast-restore flashes rather than changing the session protocol.

Current Desktop Bridge empty-state target 206:3032 uses an 86×30 lavender control at(162,335) with 14/22 medium text. Retain its20px horizontal offset and increase touch bounds through hitSlop. Main heading placement remains the separately approved layout. Available-page reads follow up to 10 empty API scan pages per batch, retain cursor and scanned-page count, and offer Load more if the budget ends before exhaustion. Subsequent refresh retains all traversed pages. This is a cursor-completeness fix independent of the separately approved SSE transport.

The owner explicitly retained password recovery at the right side of the password label on 2026-10-13. This is the authorized login-source difference.

## Header follow-up

Remove introductory copy beneath page titles from RoomHeader, profile StepHeader, authentication FlowHeader and call headings, including "Reasons, dates, and appeal results". Remove their reserved vertical space and retain 16px back-title alignment. Form labels, validation errors, restriction records, permission/reconnection feedback and consent/privacy body content remain functional.

Discover source 115:1197 now matches the supplied header crop: centered title on its own line; filter at (16,79), count at (93,84), speech burst at (173,79), create action at (320,70), at 390x844. Use one responsive second row, a gray All pill, an actual dynamic count with the source chevron, the existing exported burst asset and the existing create action. Preserve card start y=142 and the list's polling/pagination/navigation behavior. Longer localized count text may expand its slot; smaller viewports remain bounded. The owner's explicit centered main-heading instruction supersedes the source title's slightly left-shifted text box.
