# user-blocking Specification Delta

## MODIFIED Requirements

### Requirement: Block and isolate social interactions in any direction

The system MUST enforce two-way isolation in friend requests, friend lists, find-a-mate idle user lists, regular room invitations, 1-to-1 text messages, and voice requests: as long as either party blocks the other, neither party can see each other's social discovery entries, establish friend relationships, send regular room invitations, send new text messages, or initiate and connect 1-to-1 voice calls. Historical conversation records are retained according to their existing visibility, but historical conversations cannot be used to bypass blocking. The server MUST recheck blocking facts on every write or connect decision and cannot rely solely on client list filtering.

#### Scenario: The blocked user directly initiates a request

- **WHEN** The blocked user bypasses the client and directly sends friend requests, general room invitations, text messages or voice requests to the blocked person.
- **THEN** The system returns consistent target unavailability results without exposing the shielding direction

#### Scenario: Block both parties from querying the free list

- **WHEN** Either party can query the free user list of friends or partners
- **THEN** Neither party can see the other party's social discovery entries and availability status

#### Scenario: Access historical sessions after blocking

- **WHEN** Block one of the parties to open the previous conversation history and try to send a new message or initiate a voice message
- **THEN** The system allows reading of its originally visible history, but denies new interactions

#### Scenario: There is a pending voice request when blocking occurs

- **WHEN** Either party blocks the other party and there are unaccepted voice requests between the two parties.
- **THEN** The request is invalid, and the old request cannot be accepted or media access qualification can be obtained in the future.
