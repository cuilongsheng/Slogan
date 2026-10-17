# voice-session Specification

## Purpose

Define the observable real-time voice conversation behavior in the real-time room, including default mute, member status, network reconnection and access boundaries after the room ends, ensuring that the session state maintains understandable and consistent boundaries between the client and the server.

## Requirements

### Requirement: Real-time voice communication

The system MUST allow at least two members who have successfully joined the room to publish and subscribe to microphone audio and display member nicknames, CEFR, room host identity, and microphone status.

#### Scenario: Two members completed voice communication

- **WHEN** Two members have joined the same open room and turned on their microphones separately
- **THEN** Both parties can publish and receive each other's real-time audio

### Requirement: Mute by default when joining

The system MUST disable a member’s microphone by default when they enter the room. The member decides when to enable or mute it again.

#### Scenario: New member enters the room

- **WHEN** The user successfully joined the voice room
- **THEN** Its initial microphone status is mute and can be actively switched

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

### Requirement: Room ends

The system MUST end the room immediately when the room host actively ends or the room reaches the scheduled end time, notify all online members, disconnect the current voice session, and refuse ordinary joining or re-entry with old credentials, without providing additional grace.

#### Scenario: Room host end room

- **WHEN** Room host Confirm to end the current room
- **THEN** All members received the end result and the voice session cannot be restored

#### Scenario: The room reaches the scheduled end time

- **WHEN** The current time reaches the scheduled end time of the room
- **THEN** The system immediately ends the room and disconnects all online members, and no member can resume the session with old credentials

### Requirement: Current version does not handle room audio

The system MUST not process room audio in the `0.0.1` room and subsequent rooms where sensitive speech recognition is not explicitly enabled. Rooms that are explicitly enabled and all joining members meet current processing consents may temporarily process short audio windows to identify risky expressions, but any version MUST not produce playable recordings, full transcripts, public replays, or member-searchable speech content.

#### Scenario: Live voice communication

- **WHEN** Members communicate in the `0.0.1` room
- **THEN** The system only transmits real-time speech and does not generate playable room recordings, complete transcriptions, or sensitive word recognition

#### Scenario: Communicating in subsequent rooms without recognition enabled

- **WHEN** Members are communicating in a room where sensitive speech recognition is not enabled
- **THEN** The system does not send the room audio to the STT provider and does not generate a risk alert.

#### Scenario: Communicate in explicitly enabled rooms

- **WHEN** Members have consented to communicate in rooms where sensitive speech recognition is explicitly enabled
- **THEN** The system can temporarily handle short windows according to room safety voice specifications, but does not provide recording, full transcription, public playback or content search
