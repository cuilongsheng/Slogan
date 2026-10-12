## ADDED Requirements

### Requirement: Admission removes redundant waiting without bypassing authorization

The system MUST confirm membership through the existing authorized admission operation, without a separate preliminary detail request for ordinary admission. A fresh creation response may be reused only for its authenticated account. Admitted room content MUST appear while voice connects, with an understandable in-room connection state. Display-data requests MUST not delay connection completion. Password, consent, eligibility, capacity, generation and final provider-room authorization MUST remain authoritative.

#### Scenario: Ordinary admission

- **WHEN** an eligible user selects a room and supplies any required password
- **THEN** the membership response provides admission context and voice preparation runs without a repeated frontend detail request

#### Scenario: Created room

- **WHEN** the creator immediately enters their freshly created room
- **THEN** current-account creation context is reused while the server still independently confirms credential authorization

### Requirement: Explicit exit returns locally without waiting for remote cleanup

Explicit leave or explicit host end MUST stop local audio and return to discovery immediately without a fullscreen waiting or terminal result page. Exit intent MUST be retained and delivered independently of the disposed room screen, with account-bound recovery and retry of uncertain outcomes. Local navigation MUST not falsely assert server completion. End notifications MUST return participants to discovery. Provider cleanup MUST run after the durable room-state transaction and MUST not delay the end response.

#### Scenario: Slow exit delivery

- **WHEN** the exit API or media disconnect remains pending
- **THEN** the user is already on discovery and background delivery retains the intended room, generation and successor

#### Scenario: Account change during retry

- **WHEN** an exit intent is pending and the active authenticated account changes
- **THEN** the previous account's intent is not executed with the new account's credentials

#### Scenario: Provider outage during host end

- **WHEN** the host ends a room while provider cleanup is slow or unavailable
- **THEN** the durable room-end result returns and existing backend recovery retries cleanup without a frontend waiting page
