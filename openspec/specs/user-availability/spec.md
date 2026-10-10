# user-availability Specification

## Purpose

Define temporary online and idle projections of inviteable users, so that friends and strangers can only see whether they are currently inviteable, but cannot obtain precise online duration, location or room activity details.

## Requirements

### Requirement: Idle status is determined by a combination of recent online and room facts

The system MUST treat the user as an inviteable idle user only if the user has an unexpired authenticated online signal, an account and profile are available, meets age requirements, has no current security restrictions, and is not currently in any valid room membership. Client assertion cannot override room or security persistent facts.

#### Scenario: Online and not in the room

- **WHEN** Qualified user with unexpired online signal and no current active room membership
- **THEN** The system projects it as an idle user that can be invited.

#### Scenario: Online user enters the room

- **WHEN** The user still has a recent online signal but already has a current valid room membership.
- **THEN** The system will no longer show it as idle immediately

#### Scenario: Online signal expired

- **WHEN** The user does not renew the online signal and reaches the server expiration boundary.
- **THEN** The system treats it as offline and no longer appears in the inviteable list.

### Requirement: Online signals are saved for a short period of time and can be refreshed

The system MUST allow authenticated clients to refresh their short-term online signals, and the server controls the expiration time. The refresh response MUST return the server expiration time and the next recommended refresh time; the system MUST not use the heartbeat count or precise time as public user data, nor MUST it rely on the timestamp submitted by the client to determine validity.

#### Scenario: Refresh my online signal

- **WHEN** Authenticated user sends valid online heartbeat
- **THEN** The system refreshes short-term signals according to the server time and only returns the minimum status required by the user.

#### Scenario: Forging other user or client time

- **WHEN** The caller tried to refresh the signal for other users or submit custom effective time and expiration time
- **THEN** The system rejects illegal fields and does not change any other user status

### Requirement: Invitable user list to protect privacy

The system MUST use limited cursor paging to return the minimum public information and idle Boolean value of the currently inviteable user to the authenticated and qualified user. Strangers can appear in the list, but responses MUST not include precise online time, IP, location, device, session, current or historical room details; users blocked in either direction MUST be hidden from each other.

#### Scenario: Stranger query can invite users

- **WHEN** Qualified users query the current list of inviteable users
- **THEN** The system returns the minimum information of idle users that is allowed to be displayed. It does not require that both parties are already friends.

#### Scenario: Unqualified caller query

- **WHEN** Query list of users whose account is unavailable, information is incomplete, does not meet the age requirement, or is subject to current security restrictions
- **THEN** The system rejects the request and does not return other user status

### Requirement: Temporary coordinated failsafe downgrade

The system MUST treat persistent accounts, profiles, security restrictions, and room relationships as qualification facts; it MUST not display user errors as idle when temporary online coordination is unavailable or the status is uncertain, and it MUST not affect the live voice and check-out process of the user's existing room.

#### Scenario: Online status facility not available

- **WHEN** The system cannot reliably read or refresh temporary online signals
- **THEN** The inviteable status is safely downgraded to unavailable or empty list, and the existing room process continues to work.
