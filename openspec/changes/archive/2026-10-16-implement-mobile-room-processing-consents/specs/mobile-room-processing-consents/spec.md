## Purpose

Allow users to clearly select the purpose of room voice processing on the mobile phone and independently control their consent before joining.

## ADDED Requirements

### Requirement: Both room voice processing purposes are turned off by default and visible before joining.

The mobile phone MUST independently select sensitive speech recognition and post-meeting keywords when building a house instantly and by reservation, both of which are turned off by default; room discovery and details MUST display the selection saved on the server before joining. When the server rejects the unavailable capability, the page MUST be displayed as unavailable and MUST not be regarded as successfully created.

#### Scenario: No processing purpose selected

- **WHEN** The user created a room and did not enable any voice processing purpose.
- **THEN** Request to explicitly submit two closing values, and the room will continue with normal human voice.

### Requirement: To join an enabled room, you must accept the current instructions one by one.

The mobile terminal MUST read the current consent status and version of the two purposes from the server, and only require the purpose enabled in the room. Users MUST proactively click Accept, and old versions, withdrawn or lack of consent MUST block access to device preparation and joining respectively. Retrying the same command on failure MUST retain the request ID.

#### Scenario: Only agree to one purpose

- **WHEN** If two items are enabled in the room at the same time, the user can only accept one of them.
- **THEN** The page still does not allow entry to the room.

### Requirement: Users can independently withdraw future processing

Personal privacy page MUST display the current status of each purpose and provide purpose-by-purpose withdrawal. Retraction MUST use the current server specification version and independent request identifier; the page MUST not interpret retraction as deletion of historical audits or generated security cases.

#### Scenario: Withdraw post-meeting keyword consent

- **WHEN** The user actively withdraws the keyword purpose after the meeting and the server confirms it
- **THEN** The page shows withdrawal status, and future processing qualifications are subject to the server.
