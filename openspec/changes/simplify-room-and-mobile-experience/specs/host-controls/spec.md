## MODIFIED Requirements

### Requirement: Room host transfers permissions when exiting actively

The system MUST provide the current online member selector and require explicit selection of the successor member when the room host actively exits and there are still available online members; after the selection is completed, the server MUST submit the permission transfer first and then complete the exit of the original room host. When there is no takeover member, the business room MUST be closed and allowed to exit directly without waiting for the external media room to be deleted.

#### Scenario: Designated successor member

- **WHEN** Room host actively logs out and selects an online member
- **THEN** The system first transfers the room host permission to the member, and then completes the exit of the original room host.

#### Scenario: No successor designated

- **WHEN** Room host actively exited but did not select members and there are other online members
- **THEN** The page requires selecting a successor member, and the server does not silently hand over to the default second microphone.

#### Scenario: No successor members

- **WHEN** Room host actively exited and there are no other online members in the room
- **THEN** The system closes the business room and completes the exit. Media cleanup is handled asynchronously by the backend.

## ADDED Requirements

### Requirement: Normal exit does not reuse the join or reconnect page

Ordinary members MUST be able to exit directly without room host handover selection or repeated confirmation. After a member logs out, he or she MUST return to the room discovery page without showing room entry, reconnection or rejoining processes.

#### Scenario: Ordinary members exit

- **WHEN** Ordinary members click to exit
- **THEN** The local room audio stops. After exiting, the discovery page returns and the joining status interface does not appear.

### Requirement: Business exit does not wait for media cleanup

The system MUST return business success after a persistent commit member exits, room host transfer, and applicable business room closure. LiveKit cleanup failed or is temporarily unavailable. The submitted exit MUST not be changed to failure. The backend MUST be responsible for persistent retries and consistency convergence; the old credentials before exit MUST not restore business membership.

#### Scenario: Last person logged out and LiveKit is unavailable

- **WHEN** The last member exited and the LiveKit delete operation timed out or failed
- **THEN** The user gets the business exit successfully and leaves the page. The business room can no longer be joined, and the backend continues to clean up.

#### Scenario: Business response lost

- **WHEN** Exit transaction completed but response lost and client retried with original member generation
- **THEN** Returns the original exit fact and does not affect the user's membership in subsequent generations.
