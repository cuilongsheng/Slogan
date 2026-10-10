## MODIFIED Requirements

### Requirement: Each short voice request requires prompt confirmation.

The system MUST require confirmation of this processing prompt for each AI short voice request in addition to persistent consent, and MUST not be confirmed by the client for other users. The press-and-hold recording interface that clearly demonstrates the purpose and private scope of this application MUST allow the current user to actively press and hold the gesture to complete the current confirmation, and there is no need to confirm the upload again after releasing it; MUST not automatically confirm when there is no valid persistent consent, the explanation is not displayed, or there is no active recording gesture. Text expression requests MUST not rely on speech processing for consent.

#### Scenario: Agree and confirm this prompt

- **WHEN** The user has currently valid consent and actively presses and holds to record when this prompt is visible.
- **THEN** This gesture completes the current confirmation. After releasing, the request is allowed to enter the audio verification and temporary STT process.

#### Scenario: Missing current confirmation

- **WHEN** The user has given persistent consent but has not confirmed this processing prompt
- **THEN** The system refuses audio processing and does not send data to the STT provider
