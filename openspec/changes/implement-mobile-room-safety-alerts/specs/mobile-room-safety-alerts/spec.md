## Purpose

Define the mobile phone voice room to only present minimal security reminders to the current room host, and recover with server-side facts when real-time events are lost or identities change.

## ADDED Requirements

### Requirement: Only the current room host can view the minimum risk reminder

The client MUST only query and display risk reminders within the retention period after sensitive speech recognition is enabled and the server confirms the identity of the current room host. Reminder MUST only include controlled category, severity, associated members, occurrence time, number of times and recommended manual verification information. Voice, complete transcription or original text hits MUST not be displayed, and disposal MUST not be automatically triggered.

#### Scenario: Room host View reminder

- **WHEN** The current room host enters the enabled room and opens the reminder
- **THEN** The client displays the minimum reminder from the current room host exclusive API, allows pressing the cursor to continue reading, and clearly marks the need for manual verification

#### Scenario: Ordinary members have entered or the room is not enabled

- **WHEN** Non-room host enters the room or room recognition is not enabled
- **THEN** The client does not query or display the room host risk reminder

### Requirement: Real-time event and reconnection server-side fact completion

The client MUST only accept LiveKit security alerts for known versions of the current room and read the authoritative list through the current room host API. Reminders that are still in the retention period MUST be filled in after room entry, reconnection, and role takeover; unknown versions or other room signals MUST be ignored.

#### Scenario: Directional signal received online

- **WHEN** The current room host received a legal security reminder data packet
- **THEN** The client re-queries the server reminder and removes duplicate displays by id

#### Scenario: Data packet lost after reconnection

- **WHEN** The current room host is disconnected and the connection is restored.
- **THEN** The client re-confirms the room host qualification and completes the reminder through query

### Requirement: Clear reminder when room host permission expires

The client MUST clear local reminders and cursors after the server role changes, leaves the room, ends the room, or the reminder query is rejected; expired requests MUST not repopulate old reminders.

#### Scenario: Room host takes over

- **WHEN** The previous room host loses the room host role and the new room host takes over
- **THEN** The reminder status of the previous room host will be cleared immediately. The new room host can query the retention reminder after confirming the role.
