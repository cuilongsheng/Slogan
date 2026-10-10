## Purpose

Defines the first technical verification version of basic reporting, key event auditing and server-side permission protection, so that room host operations and member life cycles can be tracked and cannot be restricted by the client interface alone.

## ADDED Requirements

### Requirement: Submit a basic report

The system MUST allow room members to submit basic report records containing room, reporter, reportee, time, category and text description.

#### Scenario: A member submitted a valid report

- **WHEN** Room members select the reporting object, category and submit instructions
- **THEN** The system saves the report record and returns the submission result

### Requirement: Critical room event audit

The system MUST record reporting, member removal, member re-invitation, room host handover, room host disconnection and room end events, and retain necessary information such as event subject, operator, time, cause or result.

#### Scenario: Room host performs management actions

- **WHEN** Room host remove members, re-invite members, transfer permissions or end the room
- **THEN** The system generates traceable audit events

#### Scenario: Real-time connection status changes

- **WHEN** Real-time voice service notifies members to join, leave, abnormal disconnection or room end
- **THEN** The system associates the event with the corresponding room and member and updates the necessary status

### Requirement: Server permission verification

The system MUST verify all room joining, room host management, invitation and end operations on the server side and MUST not rely solely on client hidden buttons or local state.

#### Scenario: Non-room host directly calls the room host management interface

- **WHEN** Ordinary members bypass the client and directly request to remove members, transfer room host or end the room
- **THEN** The system rejects the request and does not change the room status

### Requirement: Real-time voucher for limited rooms

The system MUST only issue short-term, real-time voice credentials limited to the target room and target identity to users who pass the verification.

#### Scenario: Legal join request

- **WHEN** User passes account, rule confirmation, password, capacity and room status verification
- **THEN** The system issues a short-term voucher that can only be used for this room.

#### Scenario: Reentry using old credentials

- **WHEN** A user who has been removed or whose room has ended attempts to reconnect using old credentials
- **THEN** The system refuses to restore the room membership
