## MODIFIED Requirements

### Requirement: Room ends

The system MUST end the room immediately when the room host actively ends or the room reaches the scheduled end time, notify all online members, disconnect the current voice session, and refuse ordinary joining or re-entry with old credentials, without providing additional grace.

#### Scenario: Room host end room

- **WHEN** Room host Confirm to end the current room
- **THEN** All members received the end result and the voice session cannot be restored

#### Scenario: The room reaches the scheduled end time

- **WHEN** The current time reaches the scheduled end time of the room
- **THEN** The system immediately ends the room and disconnects all online members, and no member can resume the session with old credentials
