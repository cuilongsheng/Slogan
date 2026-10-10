## Purpose

Defines the shortest interaction in which the user actively presses and holds to speak their native language and obtains private English expressions after releasing it, ensuring room audio isolation during recording, allowing continued communication after stopping, and avoiding repeated confirmations and irrelevant mode operations.

## ADDED Requirements

### Requirement: Press and hold to speak native language and release to generate English

After the permissions and valid usage are met, the user MUST be able to press and hold the recording and release it to automatically submit and generate the main English expression; the page MUST not require confirmation of uploading, selecting a tone, or switching input modes after recording. The maximum front-end recording MUST be 10 seconds. Stop and submit after the limit is reached.

#### Scenario: Member presses and releases

- **WHEN** With valid permission and consent, members press and hold the entrance to speak their native language and release it
- **THEN** Automatically generate and show only the main English expressions to this member without additional upload confirmation.

#### Scenario: Recording time limit reached

- **WHEN** User presses and holds recording continuously for 10 seconds
- **THEN** Automatically stop and only submit once, subsequent releases will not resubmit.

### Requirement: Private recording and room microphone isolation

The client MUST start private recording after confirming that the room microphone is muted, and turn on the room microphone after releasing the phone and private recording has stopped, without waiting for translation to return; MUST not start recording when muting is not possible. The room microphone MUST not be re-enabled when a member has left the room, the room has ended, or the permission has been revoked.

#### Scenario: Privacy isolation during recording

- **WHEN** Member starts private recording
- **THEN** Other members cannot hear the private native language recording. After releasing and stopping the recording, room communication can continue.

#### Scenario: Translation failed

- **WHEN** Translation request after release failed
- **THEN** Provide concise retry feedback, private recording stops, room communication does not wait for translation service to resume

### Requirement: Cancellation and permission failure do not leave recordings behind

Canceling, page closing, application interruption, or leaving the room MUST stop and release private recording resources; canceled recordings MUST not be automatically uploaded, and the same audio retry MUST use the original request identifier to avoid repeated deductions.

#### Scenario: The user closes the page while recording

- **WHEN** The user closes the translation interface during the recording process
- **THEN** The recording stops and the audio segment is not submitted, and the temporary resources are released.
