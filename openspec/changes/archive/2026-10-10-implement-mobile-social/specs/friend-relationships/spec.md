## MODIFIED Requirements

### Requirement: Friend request has controlled state transition

The system MUST only allow the recipient to accept or reject pending requests, and only the sender to withdraw pending requests. A request MUST not be overridden by another action after it enters the accept, reject, or withdraw final state; concurrent pending requests in the opposite direction MUST converge into a processable relational context. My pending request list MUST return the other party's current public nickname (can be empty), which is only used to identify the request and does not add additional relationship or activity information.

#### Scenario: Identification pending request

- **WHEN** User views pending friend requests sent to or from me
- **THEN** The list returns the current public nickname of the other party; it is empty when the nickname is unavailable and does not expose private information.

#### Scenario: Recipient rejected request

- **WHEN** Recipient rejected pending friend request
- **THEN** The request enters the rejection final state and does not establish a friend relationship.

#### Scenario: Sender withdraws request

- **WHEN** Sender withdraws pending request
- **THEN** The request enters the withdrawn final state and the recipient can no longer accept the request.

#### Scenario: Both parties send each other concurrently

- **WHEN** Two users send friend requests to each other at the same time
- **THEN** The system retains a unique pending relationship context and does not generate two sets of separately acceptable requests.
