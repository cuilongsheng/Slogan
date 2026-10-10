## MODIFIED Requirements

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
