## Purpose

Define a 1-to-1 real-time voice request and acceptance process that is independent of multi-person rooms, ensure that both parties receiving the call have explicit consent to obtain media access qualifications, and handle rejection, timeout, and abnormal end.

## ADDED Requirements

### Requirement: Voice chat must be requested and accepted first

The system MUST only allow users who meet the account, age, profile, security and two-way blocking conditions to initiate 1-to-1 voice requests. The system MUST not issue connectable media credentials before the called party explicitly accepts; the called party can refuse, and the request MUST not be accepted after timeout.

#### Scenario: Accept voice request

- **WHEN** The valid called party clicked Accept on the unexpired request and both parties are still qualified
- **THEN** The system creates a voice chat that only two parties can join and issues limited access qualifications respectively.

#### Scenario: Rejected or timed out

- **WHEN** The called party rejected the request or the request expired
- **THEN** The system terminates the request, does not connect the voice, and does not issue valid media credentials to either party.

#### Scenario: Change of eligibility before acceptance

- **WHEN** Either party was blocked, restricted, offline, or in an incompatible active voice session at the time of acceptance
- **THEN** The system refuses to connect and displays an understandable unavailable result

### Requirement: Single voice chat only allows two valid participants

The system MUST restrict single chat media members to the requesting parties to prevent third parties from joining or reusing expired credentials; the same user MUST not concurrently occupy incompatible multi-person rooms and single chat voice qualifications.

#### Scenario: A third person tried to join

- **WHEN** Non-requesting parties hold or forge single chat IDs to try to obtain access qualifications
- **THEN** The system refuses to join and does not disclose the participant's private information

#### Scenario: Concurrent calls

- **WHEN** The same user receives or initiates conflicting voice requests at the same time.
- **THEN** The system can establish at most one valid single chat voice session, and other requests will get stable busy or invalid results.

### Requirement: The end and abnormal status can be restored without retaining the call content.

The system MUST allow any participant to end the private chat and promptly invalidate the old access qualification; the reconnection or end status should be displayed when the network is disconnected. The system MUST not record, save full transcripts, or write single chat audio into text conversation history by default.

#### Scenario: Participants voluntarily terminated

- **WHEN** Any participant ends the valid private chat
- **THEN** Both parties exited the media session, the old qualifications cannot be used for continued access, and the message list can retain the minimum call event

#### Scenario: Network disconnected

- **WHEN** One party's media connection is abnormally disconnected
- **THEN** Both parties see limited reconnection or end feedback. After the recovery window is exceeded, the session ends and resources are cleared.
