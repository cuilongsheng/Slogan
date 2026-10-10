## ADDED Requirements

### Requirement: Current room members can actively request private expression assistance

The mobile terminal MUST provide text and short voice entries for currently active voice room members, submit them to the existing expression auxiliary API, and only display the returned English expressions, optional expressions, and AI possible error prompts to the requester; MUST NOT automatically play or publish the results to the room.

#### Scenario: Text request successful

- **WHEN** The current member submitted a valid native language text and the server successfully returned the expression
- **THEN** The page only displays the results on the member's pop-up layer and maintains the room and wheat position status.

### Requirement: Private short voice messages comply with consent and media isolation

The client MUST obtain valid consent before recording, and ask the user to confirm this processing before each audio submission. MUST turn off the local room microphone before recording, and record for up to 30 seconds. MUST stop and release recording resources when canceling or leaving.

#### Scenario: User's first recording

- **WHEN** The current consent status is REQUIRED or REVOKED, and the user opens the short voice portal
- **THEN** The page displays the processing purpose and allows the user to actively accept or cancel. Cancellation does not start recording.

#### Scenario: The user is still in the room when recording

- **WHEN** User starts private recording
- **THEN** The client first confirms that the room microphone is turned off before starting local recording. Audio is only uploaded through private requests.

### Requirement: Errors and retries maintain request consistency

The client MUST assign a UUID to each input. If the same input fails and retries, the original UUID will be used. If the input is changed or re-recorded, a new UUID will be used. Permissions, quotas, provider and network failures MUST give a recoverable status without affecting human speech.

#### Scenario: Retry after lost network response

- **WHEN** User retries the same text or recording
- **THEN** The client re-requests using the original request UUID and original content, and does not generate a second business request.
