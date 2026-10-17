## MODIFIED Requirements

### Requirement: Private updates retain account isolation

Conversation and unread events SHALL reach only authenticated participants or the affected owner. Events SHALL carry invalidation scope and opaque recovery identifiers and MAY carry a minimal typed change kind and opaque resource reference only in an authorized private audience. Such references SHALL not disclose unrelated resources. Events SHALL NOT carry message bodies, peer presence timestamps, room occupancy details, access tokens or session credentials. Qualification, blocking and visibility/read boundaries SHALL remain enforced by the authoritative query and write APIs. An expired or revoked session SHALL lose stream access; old account events SHALL not update a newly signed-in account.

#### Scenario: Third actor observes a private conversation

- **WHEN** one participant sends a message or changes a personal read/hide boundary
- **THEN** the relevant participants receive only their applicable invalidation
- **AND** an unrelated authenticated actor receives no private-conversation event or message data

#### Scenario: Session expires or is revoked

- **WHEN** a connection's credential expires or its session becomes invalid
- **THEN** that connection terminates within its authorization lease and new connections must authenticate again
