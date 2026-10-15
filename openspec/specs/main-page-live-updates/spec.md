# main-page-live-updates Specification

## Purpose

Keep foreground main-page lists and unread notifications current through authenticated server events, with private account isolation and authoritative recovery after missed updates.

## Requirements

### Requirement: Main lists update from authenticated server events

Discover, Partners, Messages and the shared unread observer SHALL use one shared authenticated foreground SSE connection instead of recurring list/unread polling. Focus entry, user refresh, reconnection and applicable change events SHALL revalidate through existing authorized queries. Existing rows SHALL remain visible during revalidation. Backgrounding, logout and account replacement SHALL cancel the connection, pending work and reconnect timers.

#### Scenario: Other actor creates or ends a room

- **WHEN** another actor changes a discoverable room while Discover is foreground and focused
- **THEN** a server event causes its authorized snapshot to update without a periodic list request

#### Scenario: Background and resume

- **WHEN** the app goes to background and later resumes
- **THEN** it closes the old connection, ignores late responses and reconnects with an authoritative revalidation
- **AND** it runs no recurring main-list or unread requests while backgrounded

### Requirement: Private updates retain account isolation

Conversation and unread events SHALL reach only authenticated participants or the affected owner. Events SHALL carry invalidation scope and opaque recovery identifiers, not message bodies, peer presence timestamps, room occupancy details, access tokens or session credentials. Qualification, blocking and visibility/read boundaries SHALL remain enforced by the authoritative query and write APIs. An expired or revoked session SHALL lose stream access; old account events SHALL not update a newly signed-in account.

#### Scenario: Third actor observes a private conversation

- **WHEN** one participant sends a message or changes a personal read/hide boundary
- **THEN** the relevant participants receive only their applicable invalidation
- **AND** an unrelated authenticated actor receives no private-conversation event or message data

#### Scenario: Session expires or is revoked

- **WHEN** a connection's credential expires or its session becomes invalid
- **THEN** that connection terminates within its authorization lease and new connections must authenticate again

### Requirement: Events survive instance boundaries and recoverable gaps

Committed changes affecting a main-page projection SHALL schedule notifications durably across API and recovery-worker instances. Reconnect SHALL either replay only events visible to that actor from a bounded recovery window or explicitly reset and requery when replay is unavailable. Duplicate, late and reordered invalidations SHALL not duplicate rows or messages. Dependency failure SHALL preserve known rows with actionable unavailable/reconnecting feedback rather than certify an empty list. The new client SHALL not silently substitute recurring list polling when SSE fails.

#### Scenario: Publish fails after commit

- **WHEN** a mutation commits and immediate notification delivery fails
- **THEN** durable recovery retries publication and the committed business change is retained

#### Scenario: Cursor is outside retained history

- **WHEN** a client reconnects with an expired recovery cursor
- **THEN** it receives a reset signal and refreshes its focused list and unread snapshot instead of assuming it is current

### Requirement: Partner availability and cursor completeness remain authoritative

Availability events SHALL reflect eligibility, blocking, room/direct-call occupancy, renewed online leases and lease expiry. They SHALL never manufacture online state for a candidate. A successful empty scan with a continuation cursor SHALL not be treated as terminal absence; clients SHALL continue bounded scanning or expose continuation until exhaustion. Coordination failure SHALL remain distinguishable from genuine emptiness.

#### Scenario: Online candidate lies beyond offline scans

- **WHEN** the available-people query returns an empty batch with a continuation cursor
- **THEN** the client continues reading or visibly offers that continuation, rather than repeatedly declaring that no peers exist

#### Scenario: Peer stops renewing presence

- **WHEN** a peer's server-controlled online lease expires
- **THEN** the affected availability projection is invalidated and a fresh authorized query excludes that peer

### Requirement: Streaming is verified through the actual delivery chain

The release SHALL verify progressive event delivery and cancellation through its API host and frontend proxy, bounded connection renewal and authorization failure handling before enabling SSE in a published client. Native client decoding and lifecycle acceptance SHALL be completed before client publication unless the owner explicitly accepts that platform verification as a follow-up. Local or fixture results SHALL be identified separately from cloud and physical-device acceptance.

#### Scenario: Proxy buffers the event stream

- **WHEN** the delivery chain buffers events until the response closes
- **THEN** SSE rollout remains blocked and the current released client remains the rollback option


#### Scenario: Owner accepts native verification as a follow-up

- **WHEN** the owner explicitly accepts a named platform verification as a follow-up and instructs deployment to continue
- **THEN** the release record keeps that platform verification outstanding without claiming device proof
- **AND** cloud delivery and account-isolation acceptance remain required
