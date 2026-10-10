## Purpose

Define the responsibilities of the three entrances of mobile rooms, idle partners and messages, and display invitations or private chat actions based on the current identity in the partner list to avoid duplication of room lists and unauthorized invitations.

## ADDED Requirements

### Requirement: The bottom entrances each carry independent content

The system MUST allow "Discover" to display discoverable rooms, "Find Partners" to display eligible idle users, "Messages" to display personal conversations and friend portals, and "My" to display personal information; "Find Partners" and "Messages" MUST not display room lists repeatedly.

#### Scenario: User switching entrance

- **WHEN** User switches from "Discover" to "Find Partners" or "Message"
- **THEN** The system displays the corresponding user list or personal message content, and clearly identifies the currently selected entrance.

### Requirement: Find partners only display visible idle users

The system MUST follow the qualifications and two-way blocking boundaries of `user-availability` and display the minimum user information and idle status allowed to be disclosed in limited paging; the precise online time, location, device, room activity or blocked users MUST not be exposed.

#### Scenario: Browse idle partners

- **WHEN** Qualified users open "Find a Partner"
- **THEN** The system only displays idle users that are currently allowed to be seen, and provides a clear empty status when the list is empty.

#### Scenario: Idle status change

- **WHEN** Users in the list have entered valid rooms or their online qualifications have expired.
- **THEN** The system no longer regards this user as an idle object that can be invited immediately, and subsequent operations are still reviewed by the server.

### Requirement: Partner actions are distinguished by room host identity

The system MUST only provide the "invite in" action to the current room host of the target room, and follow the target and room verification of `room-invitations`; qualified users can initiate text chats or request 1-to-1 voice from partner profiles. Non-room hosts are not allowed to use the partner list to send room invitations, and room host identities are not allowed to bypass single chat restrictions.

#### Scenario: The current room host invites idle users

- **WHEN** The current room host selects qualified idle users in its own open room and clicks "Invite to Room"
- **THEN** The system enters the existing room invitation process, and the invitation does not pre-occupy the room quota.

#### Scenario: Ordinary users choose idle partners

- **WHEN** Non-room host selects an idle user who can interact
- **THEN** The system provides text chat and voice request entrances, and does not display the room host invitation operation.

#### Scenario: Invitation beyond authority

- **WHEN** Non-current room host bypasses the interface to submit a room invitation
- **THEN** The system rejects the request and does not create an invitation
