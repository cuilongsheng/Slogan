# Design

## Targets

Desktop Bridge file 56nIowZmvBhb0QJvOlDQdU / 02 UI, section 186:2347: Partners 186:2348, Messages 186:2369, Chat 186:2389, Incoming 186:2407, Active 186:2418, all 390×844. Me source 152:1473. Native safe areas and the previously authorized 402×874 web maximum remain.

The owner explicitly overrides original page heading sizes to 18px and removes headings from Discover, Partners, Messages and Me. The owner subsequently replaces Partners Chat and Messages View text buttons with 34px circular chat-icon actions. Keep their functional controls and content; eliminate the vacant title space. Chat has 34px content-sized bubbles with 14px/20px text, 10px side margins and about 14px vertical gaps. Composer retains a 50px base, adequate internal line space and grows to 120px. Incoming/active calls follow original source geometry; titles use 18px. The replacement receiver is an editable 24px rounded SVG exported through Desktop Bridge. Preserve original unrelated frames.

## Updates

One shared technical polling scheduler handles foreground, focus, coalescing and generation fencing. Treat unknown initial native AppState as eligible to start, while known background/inactive states and hidden web documents pause. Schedule from request start, with a 500ms minimum idle gap; callbacks catch their own product errors. Resume during an older pending request queues one immediate rerun and invalidates its display writes. No requests overlap within a scheduler.

Discover, Partners, and the open host invitation picker refresh every 5 seconds while focused and foreground. Existing content stays visible during refresh. The invitation picker uses /v1/people/available, filters current members, retains loaded cursor pages, and exposes empty/error refresh instead of freezing its initial snapshot. Cursor pages remain bounded; refresh starts from the current head. Presence heartbeat starts immediately for an eligible logged-in actor and follows server renewal advice. A foreground unread observer polls a lightweight aggregate every 5 seconds across routes, rather than fetching paginated conversation projections. UI displays actual counts (99+ visually) on the Messages tab and in unread conversation rows. Accounts never share notification state.

GET /v1/me/conversations/unread returns only the authenticated actor's total unread message count, excluding sent messages and rows at or below max(hiddenThrough, readThrough). Qualification is checked; no target identifier or message content is accepted or returned. Existing generated clients consume the code-first contract. Direct chat no longer waits for conversation detail before requesting messages/calls. It acknowledges loaded text only while the conversation is focused/foreground and at the bottom; a later call sequence must never acknowledge unseen text pages.

## Editing

The existing basic/preferences routes already permit eligible users. Add an explicit Edit profile action above Logout, rehydrate the draft from saved profile data at each edit entry, clear stale validation errors, and preserve nationality and optional values when submitting. Cancel returns to Me without changing the saved profile. A successful save refreshes auth profile state and returns to Me. New-user onboarding retains its existing flow and adult confirmation rules.

## Risk and rollback

No schema migration; unread aggregation uses current message/member indexes. Polling is foreground-only and bounded; it is eventual synchronization within the polling interval plus network time, not a claim of server push or instant delivery. Server TTL still owns offline presence. Backend failures preserve known UI data and remain retryable. Revert scheduler or observer independently if resource use regresses. Remove the optional unread endpoint/client polling to revert notification aggregation; no data rollback is required. Device/visual acceptance remains pending until the owner requests the final batch.
