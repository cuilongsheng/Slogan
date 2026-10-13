## ADDED Requirements

### Requirement: Compact direct communication and live main-page updates

The mobile client MUST implement the approved compact chat/call/list layouts, display input placeholders without clipping, use content-sized text bubbles, use aligned 16px back-page headings and centered headings on the four main tabs, and provide an explicit profile-edit action above Logout.

#### Scenario: Short text and composer

- **WHEN** a user views or composes a short message
- **THEN** the bubble follows its content and the composer visibly displays its placeholder and text with enough line space

#### Scenario: Other actor creates a discoverable room

- **WHEN** an eligible actor remains on Discover in the foreground
- **THEN** the list periodically refreshes without manual action or a blank loading screen and stops polling when backgrounded or unfocused

#### Scenario: Partners update

- **WHEN** the foreground partner page becomes focused or a peer's server-visible availability changes
- **THEN** the client refreshes immediately on focus and every five seconds, without overlapping refreshes or applying stale responses after blur

#### Scenario: Unread message notification

- **WHEN** an unread received message is visible under the actor's persisted read/hide boundaries
- **THEN** the foreground client displays its actor-scoped unread count on navigation and conversation rows and clears counts through actual read updates

#### Scenario: Profile editing

- **WHEN** the user selects Edit profile
- **THEN** the form loads current saved values, preserves unchanged optional fields, supports cancellation, saves through the existing API and returns to Me

### Requirement: Icon actions for partner and conversation rows

Partner and conversation rows SHALL use a compact chat icon instead of a visible Chat or View label, while preserving accessible action labels and opening the selected private conversation.

#### Scenario: Open a conversation through the icon

- **WHEN** a user taps a partner or recent conversation's chat icon
- **THEN** the existing create-or-open conversation behavior is executed for that row's peer
- **AND** the control remains identifiable to assistive technology

### Requirement: Fresh room invitation candidates

An open host invitation picker SHALL refresh authenticated online idle candidates every five seconds while the room screen is focused and foreground. It SHALL retain loaded pages during refresh, exclude existing room members, and expose a manual refresh for empty or failed results. Server eligibility SHALL remain authoritative.

#### Scenario: A partner becomes available after the picker opens

- **WHEN** an eligible peer becomes online and idle while the host invitation picker is open
- **THEN** the peer is included by a subsequent foreground refresh without closing and reopening the picker
- **AND** background or closed pickers do not continue candidate requests

### Requirement: Branded restoration and revised mobile layouts

The client SHALL show the approved branded loading page while restoring a session, without adding a minimum delay or additional network requests. Login and room creation SHALL follow the latest approved layouts while retaining their existing validation and API operations. Successful empty Partners and Messages lists SHALL show a centered soft Refresh control; failed requests SHALL retain actionable error feedback.

#### Scenario: Restore session

- **WHEN** authentication is restoring on the index, sign-in or guarded route
- **THEN** the branded loading page is visible until the existing session result determines navigation

#### Scenario: Empty and failed lists

- **WHEN** a main list successfully returns no rows
- **THEN** its centered heading and Refresh action remain visible
- **AND** refresh executes the existing authenticated list request
- **WHEN** that request fails
- **THEN** a localized actionable error remains visible

#### Scenario: Revised room settings

- **WHEN** the owner changes level, capacity, password or schedule choices
- **THEN** the revised cards invoke the same validated creation behavior and retain a usable opaque submit footer during keyboard display

### Requirement: Compact page headers and Discover toolbar

Mobile page headers SHALL omit introductory subtitles and collapse the space previously reserved for them. Discover SHALL display a centered title and a second row containing the All filter, current room count, source decoration and create action. The count SHALL remain derived from actual list/pagination state. Existing list refresh, creation navigation, form validation, consent and operational feedback SHALL remain functional.

#### Scenario: Open an account or utility page

- **WHEN** a user opens profile, authentication, history, vocabulary, restrictions or room information
- **THEN** the page title is displayed without introductory subtitle copy or its empty reserved space
- **AND** the page's existing actions and validation remain available

#### Scenario: Updated Discover toolbar

- **WHEN** the foreground room list loads or refreshes
- **THEN** its current count is shown beside the All pill and decoration without requiring a page reload
- **AND** the create action opens the existing creation route
