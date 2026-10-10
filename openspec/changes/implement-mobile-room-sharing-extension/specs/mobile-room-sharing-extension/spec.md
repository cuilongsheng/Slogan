## ADDED Requirements

### Requirement: Room sharing uses a stable server link

The mobile terminal MUST read the server-side sharing URL from the room details and provide executable sharing operations. Web MUST be able to copy the URL, and the native side MUST be able to call the system sharing panel; if it fails, you can still manually select the link. The share action MUST not contain authentication credentials, room passwords, or member data.

#### Scenario: Copy instant room sharing link

- **WHEN** User chooses to share in real-time room details
- **THEN** The client copies the stable sharing URL returned by the server and reports success or failure.

### Requirement: Room host extends the end time in the voice room

The current room host MUST be able to select 15, 30 or 60 minutes and confirm the extension. The client MUST retain the request identifier for the same submission until the result is confirmed. After success, the client MUST display the server end time and real-time synchronization status and retrieve the room details. Non-room hosts are not allowed to see the extended entrance.

#### Scenario: Retry with same extension

- **WHEN** Room host confirmed that it encountered a network error after the 15-minute extension and tried again.
- **THEN** The client submits using the same UUID and minutes, which does not form a second business extension.

#### Scenario: Real-time synchronization is temporarily unavailable

- **WHEN** Extend API returns updated end time and `providerStatus` is `PENDING` or `UNAVAILABLE`
- **THEN** The client displays the submitted new time and the synchronization pending recovery status, and does not declare the extension failure.
