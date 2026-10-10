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

The system MUST provide reconnection status, exit capability, and understandable error feedback when a member network is abnormal.

#### Scenario: Ordinary members are temporarily disconnected from the Internet

- **WHEN** The real-time connection of ordinary members is temporarily interrupted.
- **THEN** Client shows reconnection status and resumes its room session after connection is restored

### Requirement: Room ends

The system MUST notify all online members when the room ends, disconnect the current voice session, and deny normal join or re-entry with old credentials.

#### Scenario: Room host end room

- **WHEN** Room host Confirm to end the current room
- **THEN** All members received the end result and the voice session cannot be restored

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
