# direct-chat-timeline Specification

## Purpose

Let participants enter long private conversations at the newest visible content, retrieve older history deliberately in bounded pages and receive incremental updates through the shared mobile event channel.

## Requirements

### Requirement: Opening a conversation starts with its latest twenty entries

A participant opening a conversation SHALL receive the newest at most20 visible timeline entries and see its latest end after layout. A timeline entry SHALL be a text message or existing call record, ordered by its stable conversation creation position. A short or empty history SHALL not trigger automatic older-page traversal. Pending sends SHALL remain distinct from persisted pagination. Existing participant-only, personal-hide and safe-send boundaries SHALL remain enforced.

#### Scenario: Long conversation opens

- **WHEN** a participant opens a conversation containing more than20 visible text/call entries
- **THEN** its initial history response contains only the latest20 entries, displays them chronologically, and exposes continuation toward older entries without fetching those older pages automatically

### Requirement: Older history loads in twenty-entry pages without scroll jumps

Reaching the historical edge SHALL load at most20 older visible entries per request through an opaque owner/conversation/direction-bound cursor. Exhaustion SHALL be explicit. Prepended history SHALL preserve the currently visible message anchor. Repeated scroll callbacks and concurrent live notifications SHALL not duplicate pages, overlap older-page operations or discard loaded rows.

#### Scenario: Scroll upward through history

- **WHEN** the participant reaches the top of a long conversation
- **THEN** one older page is prepended, the viewed anchor stays visible, and no request begins at an older cursor until the current page is resolved

#### Scenario: Another participant's cursor is supplied

- **WHEN** a caller supplies a cursor belonging to another actor, conversation or traversal direction
- **THEN** the query is rejected without disclosing private history

### Requirement: New changes use a separate bounded revision watermark

Current-chat invalidations SHALL arrive through the one shared SSE connection. The client SHALL fetch only changes newer than its applied revision watermark, independently of older-history cursors. Catch-up batches SHALL contain at most20 changed entries with explicit continuation and SHALL stop when caught up. Text additions and updates to older call records SHALL merge by stable identity. Initial snapshot and recovery SHALL not leave an unobserved revision gap.

#### Scenario: New message arrives while reading older messages

- **WHEN** new content arrives while the participant is above the latest end
- **THEN** the client merges the newer content without moving the historical viewport, automatically reading it or refetching all older pages

#### Scenario: An older call changes state

- **WHEN** a call already displayed in history changes status
- **THEN** its existing entry updates in place through revision catch-up without appearing as a duplicate new call

#### Scenario: More than twenty updates were missed

- **WHEN** the client reconnects after more than20 visible timeline changes
- **THEN** bounded catch-up follows explicit continuation until its watermark is current, without beginning an endless empty request loop

### Requirement: Recovery and deletion preserve visible history boundaries

Focus/resume/reset SHALL reconfirm authorization, personal visibility boundaries and current revision before using retained history. A personal deletion SHALL clear newly hidden rows on that actor's clients without changing the peer's history. Duplicate or stale events, pending send retries, page completion and account replacement SHALL not resurrect hidden content. Successful commands SHALL merge their authoritative response without waiting for a periodic refresh.

#### Scenario: Hide races with pagination

- **WHEN** personal deletion occurs while an older page is in flight
- **THEN** the late page cannot restore entries at or below the new hidden boundary

#### Scenario: Session or account changes mid-request

- **WHEN** another account replaces the active session before a history or send response returns
- **THEN** the response cannot populate the replacement account's conversation state

### Requirement: Existing clients retain their forward cursor contract

Existing message and call-history query semantics SHALL remain compatible during rollout. The new timeline reads SHALL be additive, and published API/client types SHALL originate from the sole code-first contract. Rollback SHALL retain messages, call records, hide/read boundaries and notification recovery data.

#### Scenario: Older client reconnects after backend upgrade

- **WHEN** an older released client uses its existing forward message/call cursor
- **THEN** that endpoint retains its prior behavior and the old client can continue operating during backend-first rollout
