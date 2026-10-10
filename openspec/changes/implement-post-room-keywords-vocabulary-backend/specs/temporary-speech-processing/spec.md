## MODIFIED Requirements

### Requirement: Voice processing consent is saved by purpose and version

The system MUST allow authenticated users to view, accept, and withdraw voice processing consent for specific processing purposes and save the user, purpose, description version, provider category, server time, and current status. AI short voice, room safe voice processing and post-meeting keyword processing MUST be used for three different purposes; consent for one purpose shall not authorize another purpose. Note that after a version change, the old consent MUST not authorize processing of the new version; withdrawal only prevents future processing and does not delete the minimum consent audit facts that still need to be retained.

#### Scenario: Accept current instructions

- **WHEN** The user clearly accepts the current AI short voice processing instructions
- **THEN** The system saves the currently valid consent and version facts that can be queried

#### Scenario: Accept the current room safety voice instructions

- **WHEN** The user clearly accepts the current room security voice processing instructions
- **THEN** The system only saves the current valid consent that can be queried for this purpose, and does not grant AI short voice or post-meeting keyword purposes at the same time.

#### Scenario: Accept the current post-meeting keyword description

- **WHEN** The user clearly accepts the current post-meeting keyword voice processing instructions
- **THEN** The system only saves the currently valid and queryable consent for this purpose, and does not grant AI short voice or room security purposes at the same time.

#### Scenario: Withdrawing future consent

- **WHEN** User withdraws consent for AI short voice processing
- **THEN** Subsequent short voice request denied, both minimum consent and withdrawal facts remain auditable

#### Scenario: Withdrawing secure voice consent in an enabled room

- **WHEN** User withdraws room secure voice processing consent in a room with sensitive voice recognition enabled
- **THEN** Subsequent audio processing stops immediately and live access to the room is converged, both minimum consent and withdrawal facts remain auditable

#### Scenario: Withdrawing post-meeting keyword consent in an enabled room

- **WHEN** The user withdraws the corresponding voice processing consent in a room where post-meeting keywords are enabled
- **THEN** Subsequent audio processing stops immediately and real-time access to the room is converged, and existing anonymous final summary and minimum consent facts are not retroactively overwritten.

#### Scenario: Description version update

- **WHEN** The processing description version requested by the server is higher than the version last accepted by the user
- **THEN** The system requires the user to explicitly agree again before allowing new voice processing for the corresponding purpose.

### Requirement: Original audio and full transcription must not be persisted

The system MUST temporarily hold the original audio and full transcript only for the short window of a single short voice request or room streaming, and MUST not write it to PostgreSQL, Redis, object storage, queue payloads, audit events, or application logs. The temporary working set of keywords after the meeting MUST only contain candidate aggregations with no membership, no word order, and bounded. The system MUST not provide read, playback, search, or recovery capabilities for audio or complete transcripts after processing completes, fails, times out, or terminates.

#### Scenario: STT and expression generated successfully

- **WHEN** Short speech completes temporary transcription and generates expressions
- **THEN** The system releases audio and complete transcription, saving only allowed input summary, size, duration, status and usage facts

#### Scenario: Room streaming window completes judgment

- **WHEN** Enable security identification of room short audio window to complete temporary transcription and risk judgment
- **THEN** System releases audio and full transcription, saving only minimal allowed facts without original text on hit or downgrade

#### Scenario: Room streaming window generates post-meeting candidates

- **WHEN** Enable post-meeting keyword room short audio window to complete temporary transcription and candidate extraction
- **THEN** The system releases audio and complete transcription, and only temporarily retains candidate aggregations with no member ownership, no word order and an upper limit on the number of members.

#### Scenario: Service failure during processing

- **WHEN** Process failed during audio reception, STT, risk assessment, candidate extraction, or expression generation
- **THEN** Request or streaming capability can converge from minimal state to failed, degraded, or indeterminate, but audio and full transcripts are not recoverable

### Requirement: STT call uses least privilege and replaceable boundaries

The system MUST send only the audio, optional source language, and controlled identification parameters required for the current short voice request or room streaming window to the currently configured STT provider, not real names, contact information, other member data, room passwords, or LiveKit credentials. Room streaming calls MUST use short-term association identifiers that cannot be reversed to identify individuals. Changing the provider MUST not change the public short voice request, room joining conditions, security reminders, post-meeting summary or failed contracts.

#### Scenario: Send short voice for recognition

- **WHEN** Qualified audio entered temporary STT
- **THEN** The provider request contains only the data required to identify and associated identifiers that cannot be inferred to be personally identifiable.

#### Scenario: Send room streaming window for identification

- **WHEN** Members have agreed to create processable windows in rooms where any room voice processing purpose is enabled
- **THEN** The provider only receives the window, controlled parameters and short-term association identification, but does not receive member information or room credentials.

#### Scenario: Switch configured provider

- **WHEN** Operation and maintenance switch to a provider that meets the same capabilities and data policies
- **THEN** Client continues to use the same public contract and stable error semantics

### Requirement: STT failure must not affect the real voice

The system MUST classify and record STT timeouts, quota exhaustion, provider unavailability, deletion confirmation failures, and temporary coordination failures and safely downgrade them. Fault MUST not stop or record LiveKit room audio, change room status, membership, room host, or microphone position, nor automatically penalize any user. Room-level processing failures MUST clearly record the affected purpose, scope, and recovery status, and audio during the failure MUST not be over-recorded after recovery.

#### Scenario: STT provider is not available

- **WHEN** The user's active short voice request encountered an STT provider failure.
- **THEN** The system returns results that can be changed to text input, and the existing human voice continues to work.

#### Scenario: Room streaming STT not available

- **WHEN** Room-enabled streaming STT encountered timeout, quota exhausted, or provider unavailable
- **THEN** The system logs downgrades without content for affected purposes, stops or backs off new processing windows, and keeps human voices available

#### Scenario: Post-meeting summary generation is not available

- **WHEN** Temporary identification or candidate aggregation failure prevents safe generation of post-meeting summaries
- **THEN** The system returns to a stable summary unavailable state, does not block the end of the room and does not make up for the discarded audio.

#### Scenario: Temporary coordination is not available

- **WHEN** The system cannot reliably perform frequency, concurrency, or room streaming coordination protection for voice requests
- **THEN** System stops new temporary voice processing and keeps room processes available
