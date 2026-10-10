## MODIFIED Requirements

### Requirement: Current version does not handle room audio

The system MUST not process room audio in the `0.0.1` room and subsequent rooms that are not explicitly enabled for any room voice processing purposes. Rooms that explicitly enable sensitive speech recognition or post-session keywords and all joining members meet corresponding current consents may temporarily process short audio windows to generate controlled risk signals or anonymous post-session candidates, but any version MUST not produce replayable recordings, full transcripts, public replays, or member-searchable speech content.

#### Scenario: Live voice communication

- **WHEN** Members communicate in the `0.0.1` room
- **THEN** The system only transmits real-time speech and does not generate playable room recordings, complete transcriptions, sensitive word recognition, or post-meeting keywords.

#### Scenario: Communicating in subsequent rooms without recognition enabled

- **WHEN** Members communicate in a room where sensitive speech recognition and post-meeting keywords are not enabled
- **THEN** The system does not send room audio to the STT provider, nor does it generate risk reminders or post-meeting summaries.

#### Scenario: Communicate in explicitly enabled rooms

- **WHEN** Members have consented to communicate in rooms where sensitive speech recognition is explicitly enabled
- **THEN** The system can temporarily handle short windows according to room safety voice specifications, but does not provide recording, full transcription, public playback or content search

#### Scenario: Communicate in a room where post-meeting keywords are explicitly enabled

- **WHEN** Members have agreed to communicate in the room where post-meeting keywords are explicitly enabled
- **THEN** The system can temporarily process short windows according to post-meeting keyword specifications and save anonymous final summaries, but does not provide recording, complete transcription, public playback or member attribution
