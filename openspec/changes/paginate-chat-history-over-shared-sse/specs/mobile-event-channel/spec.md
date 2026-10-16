## Purpose

Deliver authorized mobile product changes through one shared foreground server-event channel, with precise audiences, bounded recovery and no recurring client queries solely to discover changes.

## ADDED Requirements

### Requirement: One foreground event connection serves all mobile features

Each authenticated client instance SHALL own at most one active foreground SSE connection. Feature screens SHALL subscribe through that connection rather than opening their own streams or recurring change-detection queries. Initial/focus/manual reads, bounded catch-up, commands, lease renewal and command retries SHALL remain separately identifiable. Background, logout and account replacement SHALL abort old work and fence late callbacks.

#### Scenario: Chat and incoming-call observers coexist

- **WHEN** an authenticated actor opens chat while global call and invitation observers are mounted
- **THEN** they share one SSE connection and idle message/call/invitation detection produces no periodic GET requests

#### Scenario: Background or account replacement

- **WHEN** the client backgrounds, signs out or replaces the authenticated account
- **THEN** old reads and reconnect timers are canceled and late private events cannot update another session

### Requirement: Notification audiences and resources are explicit

Committed changes SHALL notify only currently authorized audiences for their topic and optional resource reference. Current mobile topics SHALL cover conversation timeline/state, unread/inbox, incoming call/state, invitations, room lifecycle/membership/settings/text, host-only safety alerts, own account/profile/restrictions/appeals, own report progress, own history/notes/vocabulary and eligible post-room summary availability. Private payloads SHALL exclude business contents, reporter identities, speech text, credentials and unrelated resource references. A blocked social feature SHALL not prevent an otherwise valid account from receiving its permitted self-service status changes. Invalid sessions and public trial viewers SHALL not gain stream access through this change.

#### Scenario: Private or host-only change

- **WHEN** a private conversation changes or a host-only safety alert becomes available
- **THEN** only its participants or current authorized host receive the corresponding resource notification and unrelated users receive none

#### Scenario: Restricted actor awaits an appeal decision

- **WHEN** an authenticated actor is ineligible for social features but is permitted to read their own restrictions and appeal status
- **THEN** their stream can deliver those own-account updates while social and room topics remain denied

### Requirement: Consumers refresh only their affected projections

Notifications SHALL be coalesced by topic and resource, and consumers SHALL query only projections they currently observe or global responsibilities they own. Marking a message read SHALL refresh applicable unread/inbox projections without triggering unchanged timeline content reads. Acknowledgements SHALL only advance for actual text visible in the focused foreground chat and SHALL be deduplicated. Call records SHALL never acknowledge unloaded text.

#### Scenario: Read acknowledgement completes

- **WHEN** an actor acknowledges a newly visible text sequence
- **THEN** the system updates its unread projection without a timeline-to-read-to-unread refetch loop

#### Scenario: Unrelated conversation changes

- **WHEN** an actor receives a change for another conversation while viewing the current chat
- **THEN** applicable global badges can refresh but the current conversation timeline is not fetched for that unrelated change

### Requirement: Durable recovery preserves authoritative safety boundaries

Notification publication SHALL follow committed business changes, survive process loss, and recover duplicates or missed history through bounded replay or explicit reset. Reset SHALL revalidate current observers and global responsibilities without loading every historical page. Room removal/end, role transfer, consent changes and authorization changes SHALL invalidate affected product state even if the media event path is absent. No hidden periodic product-query fallback SHALL replace failed SSE delivery.

#### Scenario: Room removal with no media callback

- **WHEN** the server removes a member and the media SDK emits no useful state callback
- **THEN** the authorized event/recovery path reconfirms membership and stops invalid room access without waiting for a periodic room GET

#### Scenario: Event history is unavailable

- **WHEN** retained recovery history cannot cover the client's cursor
- **THEN** the client resets its observed projections, retains useful known rows with reconnect feedback, and queries authoritative current state

### Requirement: Release availability shares the channel without changing installation trust

Authenticated foreground Android clients SHALL consume new-release availability on the shared channel and verify the existing fixed public release metadata before offering an update. Only successfully published metadata SHALL generate availability. Signed-out clients SHALL retain startup, foreground and manual checks without requiring an unauthenticated permanent stream. Artifact signature/hash checks, safe-page deferral and system installation confirmation SHALL remain unchanged.

#### Scenario: Verified release advances

- **WHEN** the published fixed metadata advances to a newer verified Android release
- **THEN** signed-in supported clients are notified through the existing SSE, while failed or old builds do not create a false available update

### Requirement: Outbound leases and media responsibilities remain independent

Presence renewal, direct-call liveness heartbeats, media transport, device/permission callbacks, UI clocks and bounded retries SHALL retain their existing responsibilities. They SHALL not be misclassified as server-change polling, and they SHALL not introduce additional SSE connections.

#### Scenario: A call remains active without product changes

- **WHEN** a foreground call remains active and its product state does not change
- **THEN** required liveness/media activity continues while periodic call-state queries do not

### Requirement: Event expansion remains compatible with released clients

The existing event endpoint SHALL preserve its released default event vocabulary and recovery behavior. Clients requesting the expanded protocol SHALL receive their authorized typed events on the same single connection. Unsupported protocol values and cross-protocol recovery input SHALL have an explicit validated outcome. A legacy client SHALL not receive a new event kind that causes its existing parser to disconnect.

#### Scenario: Older client remains connected during backend-first rollout

- **WHEN** legacy and expanded-protocol clients connect while a new private topic changes
- **THEN** each receives only its supported authorized event representation and the legacy parser continues operating without encountering an unknown scope
