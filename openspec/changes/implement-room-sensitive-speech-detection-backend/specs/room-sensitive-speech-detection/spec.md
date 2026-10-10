## Purpose

Define how an explicitly enabled live voice room can temporarily identify sensitive expressions with member consent, send only minimal risk reminders to the current room host, and leave auditable risk and downgrade facts within the boundaries of no recording, no saving of full transcripts, and no automatic penalties.

## ADDED Requirements

### Requirement: Room-sensitive speech recognition must be explicitly enabled by the room host at creation time

The system MUST only perform temporary processing on rooms that explicitly enable sensitive speech recognition when they are created, and display whether it is enabled or not in the minimum information allowed to be returned in the room list, details, and sharing portal. This selection MUST be immutable after room creation; existing client requests that do not submit this field MUST be processed as closed.

#### Scenario: Create a recognition-enabled room

- **WHEN** Qualified room host creates a room and explicitly enables sensitive speech recognition
- **THEN** The system saves the enabled status and clearly displays the need for voice processing consent in the room information visible before joining.

#### Scenario: The existing client has not submitted the switch

- **WHEN** Qualified room host created a room using an existing request that did not submit sensitive speech recognition fields
- **THEN** The system creates a room with this capability turned off and does not process its members' audio

#### Scenario: Try to switch after room creation

- **WHEN** The room host or other caller attempted to turn sensitive speech recognition on or off after the room was created.
- **THEN** The system rejects the modification to prevent members from changing the processing purpose without re-selecting.

### Requirement: Enable the room to only allow members with consent for the current purpose to join.

The system MUST verify that the member has accepted the current version of the room's secure voice processing instructions before issuing or renewing live access credentials for an enabled room. Denied, missing, expired or withdrawn consent MUST prevent joining or renewal but may not result in reports, cases, restrictions or account penalties.

#### Scenario: Members have been agreed to join

- **WHEN** Eligible members have accepted the current version of the room's secure voice processing instructions and joined the enabled room
- **THEN** The system continues to perform existing password, capacity, shielding and security restriction verification, and allows joining after all conditions are passed.

#### Scenario: Member not allowed to join

- **WHEN** Member does not have a currently valid Room Security Voice Processing Consent
- **THEN** The system returns a stable consent required result and does not create membership or real-time access credentials.

#### Scenario: Member in the room withdraws consent

- **WHEN** Enable members in the room to withdraw consent for room secure voice processing
- **THEN** The system stops the member's subsequent audio processing, revokes his subsequent real-time access, and disconnects him from the room, without recording the result as a security penalty.

#### Scenario: Turn off identified rooms

- **WHEN** Member joins a room without sensitive speech recognition enabled
- **THEN** The system does not require consent for this processing purpose and does not initiate room audio processing

### Requirement: Room audio and full transcription only allow temporary streaming

The system MUST only handle live microphone audio from currently consenting members in the enabled room, and only retain the audio and full transcription for a short window in memory. The system MUST not write raw audio, full transcripts, segmented text, or retrievable content to PostgreSQL, Redis, object stores, queue loads, audit events, or application logs, and MUST not provide read, playback, search, or recovery capabilities.

#### Scenario: Streaming window processing completed

- **WHEN** A temporary audio window completes identification and risk judgment
- **THEN** The system releases the audio and full transcript for this window, retaining only the minimum allowed call, risk, or degradation facts

#### Scenario: worker or provider failed midway

- **WHEN** Process, network, coordinator, or provider failed while room audio was being processed
- **THEN** Temporary content is not recoverable, live voice remains available, and is downgraded to the minimum allowed message record

#### Scenario: Unauthorized member's audio track appears

- **WHEN** The media handler observed that there is no currently valid agreed participant audio track
- **THEN** The system does not send this audio track to the STT provider and triggers member access convergence without saving its content

### Requirement: Use versioning rules for risk judgment and limit repeated reminders

The system MUST use identifiable versions of controlled risk rules to classify temporary transcripts into allowed risk categories and severity levels, and to deduplicate and limit duplicate results within the same room, member, category, and time window. Rule results MUST only indicate signals that require attention from the room host or safety officer, and MUST not declare a confirmed violation.

#### Scenario: Temporary content hits controlled rules

- **WHEN** Enable temporary transcription of rooms to meet current risk rules
- **THEN** The system generates a minimum risk signal including rule version, risk category, severity level, member, room and server time, and does not save the original hit text.

#### Scenario: Repeated hits in a short period of time

- **WHEN** The same member hits the same risk category repeatedly within the deduplication window
- **THEN** The system merges or suppresses duplicate reminders and retains count or last occurrence time without content

#### Scenario: Rule miss

- **WHEN** Temporary transcription does not meet current risk rules
- **THEN** The system releases temporary content and does not save "safe" conclusions or sentence-by-sentence recognition records

### Requirement: Risk reminders are only sent to the current room host at the time of sending.

The system MUST only send a minimum reminder to the current room host of the room where the risk occurs at the time of delivery. Reminder MUST only include the room, member, risk category, severity level, occurrence time and recommended manual verification information required for locating and handling, and MUST not include the original audio, complete transcription, hit original text or other member data.

#### Scenario: Risk signal successfully alerted room host

- **WHEN** Minimal risk signal generated and current room host is online
- **THEN** The system only delivers reminders to the current room host. Ordinary members and the original room host cannot receive the reminder.

#### Scenario: Reminder that room host takes over during delivery

- **WHEN** The risk reminder has not yet been delivered and the room host has taken over legally.
- **THEN** The system delivers according to the latest room host fact or invalidates the old delivery, and does not leak reminders to the previous room host.

#### Scenario: The current room host is temporarily offline

- **WHEN** The current room host cannot receive real-time reminders when the risk signal is generated.
- **THEN** The system retains the limited expected delivery fact without content and tries again without broadcasting it to other members.

### Requirement: Automatic risk signals must not directly perform safety treatment

The system MUST prohibit individual or aggregate risk signals from automatically removing members, muting, ending rooms, creating or advancing cases, creating restrictions, disabling accounts, or changing the conclusion of a report. The room host can only be manually operated through the existing room host management and reporting portal, and the safety officer can only manually decide the punishment through the existing case process.

#### Scenario: High severity risk signal generation

- **WHEN** The system generates risk signals with the highest severity level
- **THEN** The system still only sends minimal reminders and saves allowed facts, and does not automatically change member, room, case or account status

#### Scenario: Room host takes action based on reminder

- **WHEN** Room host proactively uses the ability to remove members or report after viewing the reminder
- **THEN** The system processes this independent manual command according to existing permissions, idempotent and audit rules

### Requirement: The security capability downgrade must be queryable and does not affect the real person’s voice.

The system MUST log security capability degradation events without content when media subscriptions, streaming STT, rule execution, deduplication coordination, or room host reminders are continuously unavailable, and allow the current safety officer, platform administrator, and auditor to query by room, time, component, and status paging. Downgrade MUST not stop the LiveKit human voice, and do not change the room status, membership, room host or microphone position.

#### Scenario: STT provider is not available

- **WHEN** Streaming STT for enabled room times out, runs out of credits, or remains unavailable
- **THEN** The system stops or backs off new processing windows, records degradation scope and time, and keeps human voice available

#### Scenario: Downgrade recovery

- **WHEN** The affected component repasses the health check and resumes processing
- **THEN** The system records the recovery time and final status, does not re-record the audio during the fault, and does not claim that the period has been checked.

#### Scenario: safety officer query downgrade

- **WHEN** The current safety officer uses valid filters and cursors to query safety capability degradation events
- **THEN** The system returns a stable sorted minimal event and next page cursor, without returning speech content, transcription, or provider credentials

#### Scenario: No administrative role query downgrade

- **WHEN** Ordinary users directly request security capability downgrade events
- **THEN** The system denies access without disclosing room or infrastructure status
