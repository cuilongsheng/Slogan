# Main pages, compact chat and live updates

Local verification completed on 2026-10-13 after the owner authorized testing and deployment. Publication is tracked separately in the release record. Real device behavior and measured production latency are not inferred from local results.

## Confirmed visual source

Desktop Bridge file `56nIowZmvBhb0QJvOlDQdU`, page `02 UI`, section `186:2347`. The connected original frames were inspected and exported at 390×844:

| View          | Source                     | Capture                                   |
| ------------- | -------------------------- | ----------------------------------------- |
| Partners      | 186:2348                   | [Original frame](figma-partners.png)      |
| Messages      | 186:2369                   | [Original frame](figma-messages.png)      |
| Chat          | 186:2389                   | [Original frame](figma-chat.png)          |
| Incoming call | 186:2407                   | [Original frame](figma-incoming-call.png) |
| Active call   | 186:2418                   | [Original frame](figma-active-call.png)   |
| Me            | 152:1467, actions 152:1473 | [Original frame](figma-me.png)            |

The original chat source has compact content-sized bubbles, no permanent voice-consent banner and no bottom report/block toolbar. Its composer is 50px high with 14px/20px text. The implementation allows growth up to 120px and provides report/block through a header menu and incoming-message long press. Voice still requires explicit acceptance. Main tab headings are omitted and other mobile page headings use 18px, as explicitly requested even where original captures still show larger headings. Brand wordmarks, body text and icon glyphs are not page headings. The previously authorized 402×874 maximum web phone frame is retained.

The owner requested a replacement receiver: the original 24px phone frame `186:2484` now contains rounded vector `201:2813`, exported into `direct-phone.png` with editable SVG source. The Me action stack contains Edit profile `202:2815` above Logout, retaining the original button styles and spacing. The owner subsequently requested icons instead of Chat/View text. Those five scoped row/action instances were detached locally for structural overrides; their reusable source components and unrelated frames were preserved. The updated row frames are `204:2817`, `204:2829`, `204:2841`, `204:2853`, `204:2866`; their 34px buttons use the exported `direct-chat-action.png`/SVG. Updated captures were inspected for this Figma-only change; they are not runtime evidence.

## Behavior and identified causes

- The old chat composer used 28px vertical padding plus a 24px line inside a fixed 50px box. It now reserves adequate line space. Fixed bubble widths/heights and the large timeline inset were removed.
- Partners previously waited 30 seconds after each completed request. Messages waited 15 seconds. Discover had focus/manual refresh without periodic updates. Focused main lists now refresh every five seconds while foreground, scheduling from request start with a minimum 500ms idle gap after slow requests.
- Unknown initial native AppState no longer prevents polling from starting. Known background/inactive states and hidden browser documents pause it. Returning to foreground fences old responses and queues a fresh refresh. A separate request queue prevents overlap when an old focus request is still pending. Loaded Discover cursor pages are replayed from the fresh head so automatic refresh does not truncate the list or reuse old cursors.
- The room invitation picker previously fetched once when opened. It now refreshes online/idle candidates every five seconds while focused and open, preserves loaded pages and search text, excludes current members, and supports manual empty/error refresh. It uses the same server-owned `/v1/people/available` eligibility as Partners, not friendships. Being online does not override room/call occupancy or restrictions.
- An eligible actor sends an immediate root presence heartbeat and follows server renewal advice. Incoming-call polling shares the same foreground scheduler. Server presence TTL and network time remain part of eventual updates; this is not WebSocket push or a measured latency guarantee.
- `GET /v1/me/conversations/unread` returns only the authenticated eligible actor's aggregate incoming unread text count. It excludes sent and personally hidden/read messages, accepts no target actor and returns no message contents. No database migration is needed. The code-first OpenAPI and client types were regenerated; no second contract is maintained.
- The root unread observer updates tab badges every five foreground seconds. Conversation rows retain their real unread counts. A chat fetch starts detail, text and call-history requests concurrently. Read acknowledgement applies only to loaded text while focused, foreground and near the bottom; later call sequences cannot acknowledge unloaded text. Draft and idempotent retry behavior are retained.
- Me contains Edit profile above Logout. Each entry rehydrates the edit draft from the current saved profile and clears stale field errors. Existing optional demographics and nationality are retained; adult confirmation remains required. Existing authenticated profile APIs handle saving and refresh auth state before returning to Me.

## Verification — 2026-10-13

- Repository formatting, dependency boundaries, lint and typecheck: PASS.
- Mobile Jest: 59 suites / 217 tests, PASS.
- Backend unit: 45 suites / 243 tests, PASS; integration: 41 suites / 212 tests, PASS; HTTP E2E and runtime suites: PASS (runtime 8 suites / 15 tests).
- Admin unit: 3 tests, PASS. Browser application workflows: 26 tests, PASS, including real Expo Router profile edit/cancel/save. Saving now dismisses to the original Me route instead of duplicating it in the stack.
- Visual/interaction harness: 42 tests, PASS, including 320px/390px/412px and bounded desktop layouts, direct-copy sharing, disabled dark assistance, cartoon fallbacks, inline reconnect, unread badges, and Discover/invitation updates without reopening.
- Pages proxy/build/release tests: 23 tests, PASS. Real-controller HTTPS cookie/origin/refresh/logout browser test: PASS.
- NestJS code-first OpenAPI check and generated client check: PASS. All application builds passed; the final mobile build is repeated after the profile navigation repair.
- Both OpenSpec changes validate strictly.

Original Figma captures were directly inspected beside the runtime captures for chat, partner rows, incoming/active calls and Me. Bubble sizing, composer legibility and call avatar/control positions follow the confirmed source; requested 18px headings, removed main-page titles, unread counts, compact icon actions, and the reachable safety menu are explicit authorized differences. Font rendering can differ slightly between Figma and browser; no blanket pixel-identical claim is made. Runtime captures are under [runtime](runtime/), and the bounded room/sheet captures are in the sibling room-usability record.

The old test assertions for a 390px desktop maximum, retained main titles and pre-change sheet heading geometry were updated to the approved requirements. The SafeArea fixture now forwards the real page test identifier, and browser suites use separate output directories so concurrent runs cannot delete each other's traces. Test adapters remain outside production imports.

Physical Android evidence remains pending: no device was attached. Browser fixture checks do not prove actual microphone permission, audio publication/subscription, interruptions or two-device audio. Release gates must finish on the committed source before API, Pages and APK publication are reported as complete.
