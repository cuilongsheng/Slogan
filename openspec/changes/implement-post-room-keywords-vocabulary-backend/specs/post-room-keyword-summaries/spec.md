## Purpose

Define how an explicitly enabled voice room can form a post-meeting summary of keywords and short expressions without member attribution within independent consent and data minimization boundaries, and allow actual participants to safely read the stable generated results after the room ends.

## ADDED Requirements

### Requirement: The post-meeting keyword must be explicitly enabled by the room host when creating the room

The system MUST only process audio for this purpose for instant or reserved rooms that explicitly enable the post-meeting keyword when they are created, and display whether it is enabled in the room information visible before joining. This selection MUST be immutable after room creation; existing client requests that do not submit this field MUST be processed as closed.

#### Scenario: Create a room with post-meeting keywords enabled

- **WHEN** Qualified room host creates an instant or reserved room and explicitly enables post-meeting keywords
- **THEN** The system saves the immutable enabled status and clearly displays the need for corresponding voice processing consent before members join.

#### Scenario: Not enabled when created

- **WHEN** Room host did not submit the post-meeting keyword field or explicitly turned off the ability
- **THEN** The system creates a room that does not process audio for this purpose. After the room ends, it returns to `DISABLED` summary status.

#### Scenario: Try to switch after room creation

- **WHEN** The room host or other caller attempted to enable or disable post-meeting keywords after the room was created.
- **THEN** The system rejects the modification and the processing purpose shown to the member remains unchanged.

### Requirement: Enable room to require independent post-meeting keyword processing consent

The system MUST verify that the member has accepted the current version of the post-meeting keyword voice processing instructions before issuing or renewing a live access credential for an enabled room. This consent MUST be isolated from AI short voice and room security identification purposes; missing, expired, or withdrawn consent MUST prevent joining or renewal, but may not result in reporting, restrictions, or penalties.

#### Scenario: Members have been agreed to join

- **WHEN** Qualified members have accepted the current version of the post-meeting keyword processing instructions and joined the enabled room
- **THEN** The system allows joining after the existing password, capacity, shielding and security restrictions are verified.

#### Scenario: Member not allowed to join

- **WHEN** The member does not have a currently valid post-meeting keyword processing consent
- **THEN** The system returns a stable consent required result and does not create membership or real-time access credentials.

#### Scenario: Member in the room withdraws consent

- **WHEN** Enable members in the room to withdraw consent for post-meeting keyword processing
- **THEN** The system stops the member's subsequent audio processing, revokes his subsequent real-time access and disconnects him from the room, and does not record the result as a security penalty.

#### Scenario: Consent for one purpose cannot substitute for another purpose

- **WHEN** The room has both security identification and post-meeting keyword enabled and members only accept one of the purposes.
- **THEN** The system requires members to complete the current consent for another purpose before allowing joining or renewal.

### Requirement: Only anonymous and bounded temporary candidates are allowed during the session

The system MUST extract English keywords and short expression candidates from provisional transcriptions of currently agreed members, and remove member attribution, speaking time, and sentence-by-sentence order before saving the final summary. Temporary candidates MUST have an upper limit on number, length, and lifetime, and MUST not contain userIds, memberships, live identities, complete original sentences, or contiguous content that can restore a complete conversation.

#### Scenario: Temporary window generation candidate

- **WHEN** Enable temporary transcription of rooms containing qualified English keywords or short expressions
- **THEN** The system only accumulates normalized text, type, and aggregate counts and does not preserve speaker or sentence order

#### Scenario: Candidate contains private or extremely long content

- **WHEN** The candidate exceeds the allowed length, contains contact information, or cannot be safely separated from the original sentence
- **THEN** The system discards this candidate and does not write the original text to the summary, log, or diagnostic event

#### Scenario: Security risk signal already exists

- **WHEN** There is a sensitive voice risk event or room host reminder in the same room
- **THEN** The system shall not generate learning keywords reversely from risk events, reports or case evidence.

### Requirement: Generate a single stable summary after the room ends

The system MUST generate at most one room-level summary after completion for each enabled room with status `PENDING`, `READY`, or `UNAVAILABLE`. Successful rollup MUST contain room themes, stable ordering of deduplicated keywords and short expressions, and delete the temporary working set after the final result is submitted; a second rollup MUST not be created by repeating end events or generation retries.

#### Scenario: End normally and complete the generation

- **WHEN** Enable room end and there are enough qualified candidates
- **THEN** The system updates the rollup atom to `READY`, returning stable entry order and making the temporary working set unreadable or recoverable

#### Scenario: Not enough candidates

- **WHEN** Candidates that enable room ending but do not meet the minimum quality and quantity requirements
- **THEN** The system converges the summary to `UNAVAILABLE` without generating holes or speculative content.

#### Scenario: End event received repeatedly

- **WHEN** The same room end command, event or generation task is processed repeatedly
- **THEN** The system reuses the same summary status and results, without duplicating entries or changing completed content.

### Requirement: Only actual participants can read the post-meeting summary

The system MUST only allow users who have actually participated and the room has ended to read the room summary. Historical members who left early or were removed can still be read; only reservation-only, invited but not joined, unrelated users or other administrative roles cannot be read through the normal interface.

#### Scenario: Summary of successful reading of historical members

- **WHEN** Summary of actual participants reading status `READY` after the room ends
- **THEN** The system returns the room theme, generation time, keywords and short expressions, but does not return members, speaking time or complete original sentences.

#### Scenario: Generation is still in progress or unavailable

- **WHEN** Summary of actual participants reading `PENDING` or `UNAVAILABLE`
- **THEN** The system returns a stable state and understandable unavailable results, and does not return temporary candidates or internal errors

#### Scenario: Read by non-participant

- **WHEN** Room summary requested by reservation only, invitation only or unrelated users
- **THEN** The system denies access without disclosing summary status, content other than topics, or participation relationships.

### Requirement: Summary failure must not affect the room and live voice

The system MUST normalize logging and safely degrade provisional identification, candidate extraction, aggregation, and final post-generation failures. The fault MUST not stop live speech, prevent the room host from ending the room, change membership, room host, or security cases, or reprocess audio that was not retained during the fault after recovery.

#### Scenario: Processing dependencies in session are not available

- **WHEN** Room-enabled STT, candidate extraction, or temporary aggregation persists unavailable
- **THEN** The system stops or backs off new post-conference candidate processing and keeps live voice available

#### Scenario: Generation failed after completion

- **WHEN** The room has ended but the final summary cannot be completed safely
- **THEN** The system converges the summary to `UNAVAILABLE`, deletes the deletable temporary working set without blocking the end of the room
