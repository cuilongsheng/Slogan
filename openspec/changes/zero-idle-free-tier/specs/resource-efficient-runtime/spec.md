## Purpose

Keep Preview idle resource consumption bounded while preserving prompt authorization changes and durable realtime recovery across releases.

## ADDED Requirements

### Requirement: Single managed background owner

The system SHALL fence managed work and further scheduling by a monotonically increasing release generation and one logical database owner.

#### Scenario: Obsolete delivery

- **WHEN** an old generation is delivered after owner activation
- **THEN** it performs no domain recovery or continuation scheduling

### Requirement: Idle recovery is bounded

The system SHALL publish committed changes promptly and use only one logical bounded safety fallback for missed wakeups (15 minutes while online or pending, 60 minutes after confirming no presence, rooms or work); no realtime self-chain or subscriber-free reader SHALL run.

#### Scenario: No work exists

- **WHEN** there are no users, rooms, commands or outbox rows
- **THEN** only the documented fallback existence probe runs and no full recovery, metrics aggregation or snapshot is constructed

### Requirement: Efficient authorization preserves revocation

The system SHALL reuse a verified request context and check minimal mutable authorization state within 15 seconds on idle streams and before event delivery.

#### Scenario: Session is revoked or account restricted

- **WHEN** authorization changes during an open stream
- **THEN** subsequent delivery observes the change without downloading whole credential or profile relations

### Requirement: Presence and durable events remain correct

The system SHALL retain 90-second presence expiry, approximately 45-second renewal, immediate stream wakeups, replay and idempotent outbox/command recovery.

#### Scenario: Publisher retry

- **WHEN** publication fails after a committed mutation
- **THEN** durable work remains available to a bounded fallback and duplicate delivery remains safe

### Requirement: Unchanged metrics are reused

The system SHALL reuse completed metric windows only when algorithm and source version are unchanged, and SHALL recompute after late source mutations.

#### Scenario: Late event changes an old window

- **WHEN** data arrives after a completed computation
- **THEN** a later computation observes a changed source version and refreshes the result

### Requirement: Adaptive idle safety cadence

The system SHALL use shared idempotency windows for active and empty fallback cadences and SHALL restore the active cadence on business work or the first live presence expiry check without adding recurring heartbeat polls.

#### Scenario: Transition from empty to online and back

- **WHEN** a previously empty system receives a live presence lease or pending work
- **THEN** business work immediately, or the first live expiry check within its 90-second lease deadline, restores the 15-minute safety cadence
- **AND** continued expiry checks do not repeatedly activate extra fallback chains
- **AND** a later safety check confirming empty state restores the 60-minute cadence
- **AND** a bounded partial presence repair reports remaining indexed leases rather than falsely confirming empty state
