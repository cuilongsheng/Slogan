## Purpose

Specifies how mobile users who have passed the qualification, password and rule checks can actually enter the voice room, participate in real-person audio exchanges that are muted by default, and receive feedback consistent with the server facts when refreshing, disconnecting, exiting, and ending the room.

## ADDED Requirements

### Requirement: Explicit join and seat restoration

The client MUST only submit the confirmed rules and room password after the user actively chooses to enter the room. The client MUST obtain the room-limited real-time credentials after the server joins successfully. The client MUST only establish a real-time connection to the current room. Join failures MUST show an understandable reason and return or retry path, and passwords and live credentials MUST not be put into URLs, normal persistence storage, or logs.

#### Scenario: Completed moving in

- **WHEN** Qualified user completes equipment check and actively chooses to enter available rooms
- **THEN** The client uses the room's rule confirmation and optional password to establish membership, obtain real-time credentials, connect to the target room and display the current session

#### Scenario: Join refused

- **WHEN** Wrong password, capacity is full, room ended, account restricted or rule confirmation invalid
- **THEN** The client does not connect to the real-time room, indicating the reason for the server's rejection and allowing the user to return to the corresponding step or room list

#### Scenario: Page refresh

- **WHEN** The user already has a valid membership in the room when the browser is refreshed or the native page is rebuilt.
- **THEN** The client rereads the membership from the server and re-applies for a short-term credential to restore the connection without requiring re-entering the room password.

### Requirement: Default mute and member facts

The client MUST keep the local microphone off when the connection is established and only publish audio after the user actively switches. Membership, order, nickname, English level, and room host role MUST come from server-side member facts; online and speaking status MUST be based on live connection status, and fictitious members MUST not be shown.

#### Scenario: Two members communicating

- **WHEN** Two members are connected to the same voice room and each actively turns on the microphone.
- **THEN** Both parties can hear each other's audio and see their respective microphones and speaking status.

#### Scenario: First connection

- **WHEN** The user just completed the live connection but did not trigger the microphone operation
- **THEN** The local device does not publish microphone audio, and the UI displays a muted state.

### Requirement: Interrupt, exit and end convergence

The client MUST display the connecting, reconnecting, available, failed, and room end statuses. The user actively exits MUST requests the server to leave and disconnect local audio; the room ends or the qualification is invalidated MUST stops local connections and audio and prohibits silent reentry with old credentials. For exit results that have been submitted but provider cleanup is still to be completed, the interface MUST be based on the business status submitted by the server.

#### Scenario: Network interruption

- **WHEN** The real-time connection is temporarily interrupted but the server membership is still valid
- **THEN** The client displays the reconnection status and exit entrance, and synchronizes member and room status after recovery.

#### Scenario: Exit actively

- **WHEN** Member confirms to exit the current room
- **THEN** The client requests to leave, stop local audio and return to the discovery page; the room host takes over or ends based on the server result.

#### Scenario: Room ends

- **WHEN** The room was terminated or expired by the room host, or the old voucher was revoked
- **THEN** The client stops real-time connection and displays the ended page. The old credentials cannot be restored to the room.

#### Scenario: Connection failed after obtaining the certificate

- **WHEN** membership has been created but the real-time connection or provider is not available yet
- **THEN** The client retains clear retry and exit entrances, and does not mistakenly report failed connections as having entered and make sounds.
