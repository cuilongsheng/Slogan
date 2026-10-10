## Purpose

Define the room host's minimum management capabilities for members and rooms, as well as the room host permission transfer rules when actively exiting and disconnecting from the network, to avoid the continued existence of unmanaged voice rooms.

## ADDED Requirements

### Requirement: Room host remove member

The system MUST allow the room host to view current members and move specified members out of the room; removed members MUST not actively rejoin the same room using old credentials.

#### Scenario: Room host remove member

- **WHEN** Room host Select the current member and confirm removal
- **THEN** The system disconnects the member, invalidates his or her old room entry voucher, and records the removal event.

### Requirement: Room host re-invites removed members

The system MUST allow removed members to rejoin the same room only when the room host actively invites and the invitees still meet the account, room status and capacity conditions.

#### Scenario: Valid re-invitation

- **WHEN** Room host invited a removed member and the room is still open, there are vacancies, and the member is not restricted by the platform
- **THEN** The system issues new membership qualifications and allows them to re-enter

#### Scenario: Invitation cannot bypass restrictions

- **WHEN** The invited members are restricted by the platform, the room has ended or the room is full
- **THEN** The system refuses to rejoin and returns the corresponding reason

### Requirement: Room host transfers permissions when exiting actively

The system MUST provide the current online member selector before the room host actively exits; when the room host specifies a member, it is handed over to the member; when the room host is not specified, it is handed over to the second member in the current joining sequence; when there is no successor member, the room is closed.

#### Scenario: Designated successor member

- **WHEN** Room host actively logs out and selects an online member
- **THEN** The system first transfers the room host permission to the member, and then completes the exit of the original room host.

#### Scenario: No successor designated

- **WHEN** Room host actively exited but did not select members and there are other online members
- **THEN** The system transfers the authority to the current second microphone

#### Scenario: No successor members

- **WHEN** Room host actively exited and there are no other online members in the room
- **THEN** The system closes the room

### Requirement: Wheat position sequence

The system MUST display the wheat positions in the order in which members successfully join the room; after a member leaves, the remaining members move forward in the original order.

#### Scenario: Second Mai leaves

- **WHEN** Currently, the second Mai has left and there will still be online members in the future.
- **THEN** Subsequent members are moved forward according to the original joining order and the default succession order is updated.

### Requirement: Room host disconnection and reconnection window

The system MUST treat room host network disconnection and active exit differently; a 60-second reconnection window will be retained after disconnection, and room host permissions will be retained when reconnecting within the window. After timeout, the room will be transferred or closed according to the default takeover order.

#### Scenario: Room host reconnects in window

- **WHEN** Room host restores connection within 60 seconds after network disconnection
- **THEN** Room host continues to hold the original room host permissions and no transfer occurs

#### Scenario: Room host reconnection timeout

- **WHEN** Room host network disconnected for more than 60 seconds
- **THEN** The system hands over the room host in the order of the current wheat position; the room is closed when there is no member who can take over.
