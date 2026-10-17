## MODIFIED Requirements

### Requirement: Network reconnection feedback

The system MUST provide reconnection status, exit capability, and understandable error feedback when the member network is abnormal; during the 60-second reconnection window of the room host, current members MUST continue to communicate and resume existing sessions, but the system MUST suspend users who have not yet obtained membership to join.

#### Scenario: Ordinary members are temporarily disconnected from the Internet

- **WHEN** The real-time connection of ordinary members is temporarily interrupted.
- **THEN** Client shows reconnection status and resumes its room session after connection is restored

#### Scenario: Room host continues to communicate with existing members during the disconnection period

- **WHEN** The room host is in a 60-second reconnection window and other members remain connected or resume existing sessions.
- **THEN** These members can continue to communicate in real time and the room will not be handed over or ended immediately

#### Scenario: Suspend new members from joining during room host disconnection period

- **WHEN** A user who has not yet obtained membership in the room attempts to join within the room host's 60-second reconnection window.
- **THEN** The system denies this join, returns an understandable retry-later result, and does not create membership or live credentials.
