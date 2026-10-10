# mobile-room-history-notes Specification

## Purpose

Allow logged-in users to review the rooms they actually participated in or only reserved on the mobile phone, and securely save post-meeting notes visible only to them in the ended rooms that meet the server qualifications.

## Requirements

### Requirement: Personal history list on mobile phone

The mobile terminal MUST use the personal history interface to display the room theme, type, status, time and personal relationship, clearly distinguishing `PARTICIPATED` and `RESERVED_ONLY`. Lists MUST provide loading, empty state, failure retries, refreshes, and server-side cursor paging; history MUST not be rendered with rejoin or room host management permissions.

#### Scenario: Made a reservation but did not check in

- **WHEN** The user views records that only made reservations but did not actually join.
- **THEN** The page is marked "Appointment only" and does not display the private note editing entrance.

### Requirement: Private notes retain version boundaries

The mobile version MUST only provide note entry when the person actually participates and the room has ended. Read and save MUST request authorization through the person, and carry the current server version when saving; notes can be cleared with pure blank content. MUST keep the local edits when it fails, and MUST not automatically overwrite the remote or discard the local draft when there is a version conflict.

#### Scenario: Save post-meeting notes

- **WHEN** Historical participants of the ended room modify valid notes and save them
- **THEN** The page displays the saved status using the new version and content returned by the server.

#### Scenario: Old version conflict

- **WHEN** Another device saves first, and the current device carries the old version for submission.
- **THEN** The page retains the local draft and prompts that the latest remote content can be manually loaded, and does not claim that the save was successful.
