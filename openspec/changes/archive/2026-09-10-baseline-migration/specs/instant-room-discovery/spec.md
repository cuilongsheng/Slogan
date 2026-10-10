## Purpose

Define the discovery, creation, capacity and joining qualifications of the current version of the instant voice room, so that adult users who have completed the information can form a runnable small room communication entrance.

## ADDED Requirements

### Requirement: Create instant room

The system MUST allow users who have completed their profile, are over 18 years old, and are not restricted by the platform to create instant rooms; the room host MUST set CEFR, theme, and a maximum number of people from 2 to 6 people, and the default room duration is 2 hours.

#### Scenario: Qualified users create rooms

- **WHEN** Qualified user submits valid instant room configuration
- **THEN** The system immediately creates and opens the room and generates a clear end time.

#### Scenario: Unqualified user creates a room

- **WHEN** The user has not completed the information, is under 18 years old, or is in a platform restricted state
- **THEN** The system refuses to create a room and returns the corresponding reason

### Requirement: Public rooms and password rooms

The system MUST support public instant rooms and instant rooms with 4-digit passwords, and clearly display the password status in the room information.

#### Scenario: Join a public room

- **WHEN** A qualified user joins a public room that is not full and has not ended.
- **THEN** The system does not require the room host to approve one by one and continue the room check-in process.

#### Scenario: Join password room

- **WHEN** Qualified user submits correct 4-digit password for password room
- **THEN** The system continues to execute the check-in process

#### Scenario: Wrong password

- **WHEN** User submitted wrong room password
- **THEN** The system refuses to join and the correct password must not be revealed

### Requirement: Room list and details

The system MUST provide real-time room lists and details, showing at least the theme, CEFR, current number of people and upper limit, start time, end time, room host nickname and password status.

#### Scenario: Browse to join the room

- **WHEN** Qualified user opens room list or room details
- **THEN** The system displays currently available room information and real-time capacity status

### Requirement: Concurrency capacity boundary

The system MUST ensure that the number of people who successfully join concurrently will not exceed the upper limit set by the room host.

#### Scenario: Join concurrently when there is only one quota left

- **WHEN** Two or more eligible join requests compete for the last spot at the same time
- **THEN** At most one request is successful, and the remaining requests receive the result that the room is full.
