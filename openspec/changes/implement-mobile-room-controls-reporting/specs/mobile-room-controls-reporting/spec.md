## ADDED Requirements

### Requirement: Current member operation

The mobile voice room MUST displays the current server members and room host identities. Room host MUST be able to confirm the removal of other members and select an online successor when exiting; any member MUST be able to select other members to submit reports. All commands MUST use the current authentication identity and OpenAPI contract, showing failure and retrieval status.

#### Scenario: Room host remove member

- **WHEN** Room host confirms removal of a current member
- **THEN** The client submits the member ID and the observed credential version, and refreshes the member list after success.

#### Scenario: Room host re-invites removed members

- **WHEN** The current room host opens the removed members list and chooses to re-invite
- **THEN** The server only provides the removed members of this room and their current versions to the current room host. The client submits the version and retrieves the list; the old room host and ordinary members are not allowed to read the list.

#### Scenario: Room host Select successor to exit

- **WHEN** Room host Select successor from current online members and confirm exit
- **THEN** The client will submit the successor member ID with the exit command and will not rewrite the room host identity by itself.

#### Scenario: Member report

- **WHEN** A member selects another member in the same room, a valid category, and a description of 1–2000 characters, then submits the report.
- **THEN** The client only displays the acceptance ID returned by the server, retains the form in case of failure, and reuses the request ID for the same safe retry.

### Requirement: Ordinary room invitation

Room host MUST be able to select users from the inviteable candidates on the server to send ordinary invitations; retain the candidates and errors when the invitation fails, and do not claim that the target has joined or occupied a seat.

#### Scenario: Invite candidate users

- **WHEN** Room host Select one to invite users and submit
- **THEN** The client uses the new request ID to send the invitation and display the real server result
