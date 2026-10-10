# room-history-notes Specification

## Purpose

Provides records of rooms that the user has actually attended or reserved, as well as private handwritten notes after the actual session, allowing users to review communication experiences without exposing the private content of other members, and without relying on recording, transcription or automatic summary.

## Requirements

### Requirement: My room and reservation history

The system MUST only return room records that the caller has actually attended or made reservations, supports limited paging, distinguishes actual room entry and reservation only, and returns the current status of the room and personal records, without disclosing other people's reservations or notes. Read MUST not grant rejoin or room host management permissions.

#### Scenario: Personal page query

- **WHEN** Authenticated users query their own history
- **THEN** The system paging returns rooms with actual room check-in or reservation relationships. The same room is not repeated, and rooms that are not related to other users do not appear.

#### Scenario: No check-in for reservation

- **WHEN** The user has only reserved a room but has no actual membership
- **THEN** The history clearly says appointment only, not marking it as actual participation

### Requirement: Notes after private meeting

The system MUST allow users who have actually participated in ended rooms to save and read their own plain text notes; only reservation-only, unrelated users or other members MUST not be able to read and write on their behalf. Historical members will still retain their post-meeting record qualifications even if they later leave or are removed.

#### Scenario: Save my notes

- **WHEN** Historical members of closed rooms submitted valid private notes
- **THEN** The system saves my content, and other room members read their independent notes.

#### Scenario: Not participating or not finished yet

- **WHEN** A user with only reservations and no actual participation relationship requests a note, or a member attempts to save it before the session ends.
- **THEN** The system refuses the operation and does not generate notes or change room entry qualifications.

### Requirement: Concurrent editing and clearing

The system MUST prevent old versions from being written to overwrite updated notes, and repeating the same save does not add duplicate content; after clearing the notes, the system MUST continue to prevent old requests from reviving old text. Illegal or extremely long content MUST be rejected.

#### Scenario: Competing save at both ends

- **WHEN** Two different editors submitted concurrently with the same old version
- **THEN** At most one new editor commits, another receives a version conflict, and the submitted content remains intact

#### Scenario: Old requests are late after clearing

- **WHEN** The user has cleared the notes and the previous old save request is late
- **THEN** The system rejects old writes and does not restore cleared text
