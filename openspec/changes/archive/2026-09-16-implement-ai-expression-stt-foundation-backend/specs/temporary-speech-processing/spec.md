## Purpose

Define consent, vendor qualifications, data minimization and fault isolation boundaries for short-term speech-to-text processing so that AI short speech and subsequent room-level STT can share a clear and auditable basis for privacy without forming a recording or full transcript archive.

## ADDED Requirements

### Requirement: Voice processing consent is saved by purpose and version

The system MUST allow authenticated users to view, accept, and withdraw voice processing consent for specific processing purposes and save the user, purpose, description version, provider category, server time, and current status. Note that after a version change, the old consent MUST not authorize processing of the new version; withdrawal only prevents future processing and does not delete the minimum consent audit facts that still need to be retained.

#### Scenario: Accept current instructions

- **WHEN** The user clearly accepts the current AI short voice processing instructions
- **THEN** The system saves the currently valid consent and version facts that can be queried

#### Scenario: Withdrawing future consent

- **WHEN** User withdraws consent for AI short voice processing
- **THEN** Subsequent short voice request denied, both minimum consent and withdrawal facts remain auditable

#### Scenario: Description version update

- **WHEN** The processing description version requested by the server is higher than the version last accepted by the user
- **THEN** The system requires the user to explicitly agree again before allowing new voice processing.

### Requirement: Each short voice request requires prompt confirmation.

The system MUST require confirmation of this processing prompt for each AI short voice request in addition to persistent consent, and MUST not be confirmed by the client for other users. Text expression requests MUST not rely on speech processing for consent.

#### Scenario: Agree and confirm this prompt

- **WHEN** The user has currently valid consent and confirmation for this short voice processing prompt
- **THEN** The system allows the request to enter the audio verification and temporary STT process

#### Scenario: Missing current confirmation

- **WHEN** The user has given persistent consent but has not confirmed this processing prompt
- **THEN** The system refuses audio processing and does not send data to the STT provider

### Requirement: Original audio and full transcription must not be persisted

The system MUST temporarily hold the original audio and full transcript only within a single request, and MUST not write it to PostgreSQL, Redis, object storage, queue payloads, audit events, or application logs. The system MUST not provide the ability to read, playback, or restore audio or full transcripts after processing completes, fails, times out, or terminates.

#### Scenario: STT and expression generated successfully

- **WHEN** Short speech completes temporary transcription and generates expressions
- **THEN** The system releases audio and complete transcription, saving only allowed input summary, size, duration, status and usage facts

#### Scenario: Service failure during processing

- **WHEN** Process failed during audio reception, STT, or expression generation
- **THEN** Request can converge from minimum status fact to failed or indeterminate, but audio and full transcription are not recoverable

### Requirement: Only STT providers that meet the data policy can be enabled

The system MUST only enable STT providers that declare processing areas, data usage, maximum temporary retention period, and the ability to delete or not retain. The configured temporary data limit of the provider MUST not exceed seven days, and priority is given to the mode of deleting immediately after the completion of this processing or not retaining it; when the necessary policy configuration, key or security endpoint is missing, the system MUST prohibit enabling voice processing.

#### Scenario: provider configuration meets the boundary

- **WHEN** The provider configuration is complete and the declared temporary retention period does not exceed seven days.
- **THEN** The system can enable this provider and include declaration categories into user descriptions and minimal call facts

#### Scenario: provider retention period is too long or configuration is incomplete

- **WHEN** The provider statement is retained for more than seven days, lacks deletion capability instructions, or lacks necessary security configurations.
- **THEN** The system refuses to enable short speech processing without exposing credential values

### Requirement: STT call uses least privilege and replaceable boundaries

The system MUST only send the audio, optional source language, and controlled identification parameters required for this request to the currently configured STT provider, but not the real name, contact information, other member information, room passwords, or LiveKit credentials. Changing the provider MUST not change the public short voice request and failure contract.

#### Scenario: Send short voice for recognition

- **WHEN** Qualified audio entered temporary STT
- **THEN** The provider request contains only the data required to identify and associated identifiers that cannot be inferred to be personally identifiable.

#### Scenario: Switch configured provider

- **WHEN** Operation and maintenance switch to a provider that meets the same capabilities and data policies
- **THEN** Client continues to use the same public contract and stable error semantics

### Requirement: STT failure must not affect the real voice

The system MUST classify and record STT timeouts, quota exhaustion, provider unavailability, deletion confirmation failures, and temporary coordination failures and safely downgrade them. Fault MUST not stop or record LiveKit room audio, change room status, membership, room host, or microphone position, nor automatically penalize any user.

#### Scenario: STT provider is not available

- **WHEN** The user's active short voice request encountered an STT provider failure.
- **THEN** The system returns results that can be changed to text input, and the existing human voice continues to work.

#### Scenario: Temporary coordination is not available

- **WHEN** The system cannot reliably perform frequency or concurrency protection for voice requests
- **THEN** System stops new temporary voice processing and keeps room processes available

### Requirement: Speech processing observation information must not contain content

The system MUST record the request status, stage, provider category, time taken, audio bytes, provider return duration, usage, error category, and cleanup results required for diagnosis, but MUST not record the original audio, full transcription, original text, full provider response, key, or user contact information.

#### Scenario: Call failure requires diagnosis

- **WHEN** STT call timed out or returned an error
- **THEN** Operations and maintenance can see the stage, time-consuming and normalized error categories, but cannot recover user speech content from logs or audits

#### Scenario: Check my consent status

- **WHEN** User queries current voice processing consent
- **THEN** The response only returns the purpose, description version, status and time, not historical audio, transcription or provider credentials.
