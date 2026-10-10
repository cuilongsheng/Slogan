# room-invitations Specification

## Purpose

Define a closed loop in which room host sends ordinary room invitations to friends or currently idle users, invitees process the invitations, and re-verify when joining, so that the invitations can be discovered but cannot bypass room and account rules.

## Requirements

### Requirement: Only the current room host can send ordinary room invitations

The system MUST only allow the current room host of the room to invite its own friends or users who currently appear in the list of inviteable users. The target MUST not be the room host or the current room member; the system MUST reject the invitation when both parties are blocked in either direction, the target account or information is unavailable, does not meet age requirements, is subject to current security restrictions, or the room has been canceled, ended, or is entering the end stage.

#### Scenario: Invite idle friends

- **WHEN** The current room host invites a qualified and currently idle friend to join the room.
- **THEN** The system saves a well-targeted pending invitation and returns minimal results to the room host

#### Scenario: Non-room host direct invitation

- **WHEN** Ordinary members bypass the client and directly request to invite users
- **THEN** The system rejects the request and does not create an invitation

#### Scenario: Invite unavailable target

- **WHEN** Room host invites users who are restricted, underage, have incomplete information, are already in the room, or have a blocked relationship with them
- **THEN** The system returns a consistent result that the target cannot be invited and does not reveal the specific privacy status.

### Requirement: Ordinary invitation does not replace the removed member’s re-invitation

The system MUST separate regular social invitations from `host-controls`'s removed member re-invitations. Users who were in the `REMOVED` lifecycle in the target room cannot be reinstated through a normal invitation. The room host MUST use the existing re-invite process.

#### Scenario: Normal invitation target has been removed

- **WHEN** Room host invites members who have been removed from the room through the normal invitation portal
- **THEN** The system rejects ordinary invitations and members still cannot re-enter using old credentials or ordinary joining entrances.

### Requirement: Invited users can only read and process their own invitations

The system MUST return to the caller the pending invitations sent to me and the minimum room and room host information using limited cursor paging, and allow me to refuse. The room host and other users may not read or reject on behalf of the invitee; invitations MUST no longer be returned as available invitations after the room is canceled, ended, entry is ending, or both parties are blocked.

#### Scenario: Check my invitation

- **WHEN** Authenticated users check their room invitations by page
- **THEN** The system only returns invitations that can still be processed and target me.

#### Scenario: Decline invitation

- **WHEN** The invitee declined his pending invitation
- **THEN** The invitation entered the rejection final state and can no longer be used to join.

### Requirement: The invitation does not reserve a quota and must be re-verified when joining.

The system MUST not reserve room capacity for creating invitations. When an invited user uses the invitation through the existing joining portal, the system MUST re-verify the invitation target, room status, capacity, password, rule confirmation, account, age, security restrictions and blocking relationship in the same joining transaction; only after all are passed, the allowed membership is established or restored and the invitation is consumed. Failed joins must not consume invitations by mistake.

#### Scenario: The room is full after invitation

- **WHEN** The room capacity is full when the invited user joins
- **THEN** The system refuses to join and does not create a membership. The invitation does not grant excess quota.

#### Scenario: Password room invitation

- **WHEN** The invited user joined a still password-protected room using a valid invitation but did not provide the correct password
- **THEN** The system refuses to join. The invitation cannot bypass password verification.

#### Scenario: Qualified invited users to join

- **WHEN** The invited user submitted a valid invitation and passed all existing join verifications
- **THEN** The system atomically establishes membership, consumes invitations and returns existing room joining results

### Requirement: The invitation write operation is safe to retry

The system MUST require sending and rejecting invitations to carry the caller-generated UUID request identifier. The same caller retries with the same identification and content MUST return the original invitation or original final state; changing the room, target or action reuse identification MUST return a stable conflict. There can only be one pending ordinary invitation for the same room, room host and target at the same time.

#### Scenario: Concurrent duplicate invitations

- **WHEN** Room host concurrently and repeatedly invites the same target to the same room
- **THEN** The system keeps only one pending invitation and returns the same result for the same idempotent command

#### Scenario: Reuse request identifier change target

- **WHEN** Room host invites another user or another room using an existing request ID
- **THEN** The system returns a conflict and does not change the original invitation.

### Requirement: Invitations do not reveal private relationships or room credentials

The system MUST only return the minimum information required to complete the process to the inviting parties, and does not disclose the friend relationship, blocking direction, room password digest, LiveKit credentials or other member information. The invitation itself must not generate live voice credentials or automatically join the room.

#### Scenario: Invitation sent successfully

- **WHEN** Room host successfully created a normal room invitation
- **THEN** The response does not contain the target user's precise presence information, blocking information, or room-sensitive credentials
