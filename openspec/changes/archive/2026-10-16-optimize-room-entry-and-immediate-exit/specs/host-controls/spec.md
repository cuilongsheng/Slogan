## MODIFIED Requirements

### Requirement: Room host transfers permissions when exiting actively

The system MUST support a validated designated online successor through the host exit operation. Normal one-action exit MUST NOT require a member-selector confirmation. When no successor is designated, the system MUST atomically transfer host authority to the first eligible connected member in joining order; when none remains, it MUST close the room. An invalid designated successor MUST be rejected rather than silently accepted.

#### Scenario: Designated successor member

- **WHEN** the host specifies an eligible connected successor
- **THEN** authority transfers atomically and the former host leaves

#### Scenario: No successor designated

- **WHEN** the host exits without selecting a successor and another eligible connected member remains
- **THEN** authority transfers to the first such member in joining order without another frontend confirmation

#### Scenario: No successor members

- **WHEN** the host exits and no eligible connected successor remains
- **THEN** the room closes and durable provider cleanup follows
