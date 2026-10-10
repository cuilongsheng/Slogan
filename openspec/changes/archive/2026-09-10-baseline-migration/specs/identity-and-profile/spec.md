## Purpose

Define the identity authentication, first data initialization and adult access boundaries that users must complete before entering the voice room product to prevent uncompleted data or underage accounts from entering the current version of the room.

## ADDED Requirements

### Requirement: Third-party account login

The system MUST support users to log in through WeChat or Google accounts; create a platform account when successfully authenticating for the first time, and associate it back to the same third-party identity for subsequent authentications.

#### Scenario: First third-party login

- **WHEN** User completes authentication through WeChat or Google for the first time
- **THEN** The system creates a platform account and guides the user to complete the first data initialization

#### Scenario: There is already a third-party identity to log in again

- **WHEN** The associated third-party identity has been authenticated again.
- **THEN** The system logs in to the corresponding platform account and no duplicate accounts are allowed to be created.

### Requirement: First data initialization

The system MUST require users who log in for the first time to fill in their avatar, name, gender, nationality or city, hobbies, CEFR English level, and date of birth; they are not allowed to browse, create, or join rooms without completing the information.

#### Scenario: Data not completed

- **WHEN** The logged in user has not completed the required information.
- **THEN** The system only allows him to continue to complete the information and does not allow him to enter the room business.

#### Scenario: Data completed

- **WHEN** All required information submitted by the user passed verification
- **THEN** The system marks this as profile complete and allows qualifying room operations to proceed

### Requirement: Adult access boundary

The system MUST perform age verification based on the birth year and month filled in by the user; users under the age of 18 are not allowed to create, join rooms, or accept room invitations.

#### Scenario: Under 18 years old

- **WHEN** The user age verification result is less than 18 years old
- **THEN** The system refuses to create, join a room, or accept room invitations, and displays an age restriction description.

#### Scenario: Over 18 years old

- **WHEN** The user is over 18 years old and meets other access conditions
- **THEN** The system allows it to enter the room services supported by the current version
