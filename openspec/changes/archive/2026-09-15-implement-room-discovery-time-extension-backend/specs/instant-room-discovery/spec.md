## MODIFIED Requirements

### Requirement: Create instant room

The system MUST allow users who have completed their profile, are over 18 years old, and are not in a platform-restricted state to create instant rooms; the room host MUST set CEFR, theme, and a maximum number of 2 to 6 people, and can choose `PUBLIC` or `LINK_ONLY` visibility. The default room duration is 2 hours. Existing client requests that have not committed visibility MUST be processed as `PUBLIC`.

#### Scenario: Qualified users create rooms

- **WHEN** Qualified user submitted a valid live room configuration without specifying visibility or specifying `PUBLIC`
- **THEN** The system immediately creates and opens a public room, and generates a clear end time and stable sharing entrance.

#### Scenario: Qualified users create linked rooms

- **WHEN** Qualified user submits valid configuration and specifies `LINK_ONLY`
- **THEN** The system immediately creates and opens the linked room, generates a stable sharing entrance, and the room does not appear in the public discovery list

#### Scenario: Unqualified user creates a room

- **WHEN** The user has not completed the profile, is under 18 years old, is in platform restricted status, or submitted with unknown visibility
- **THEN** The system refuses to create a room and returns the corresponding reason

### Requirement: Public rooms and password rooms

The system MUST support both `PUBLIC` and `LINK_ONLY` instant room visibility, allowing no password or a 4-digit password, respectively. Visibility only determines the public discovery method, and passwords continue to be used as independent room entry conditions; the system MUST clearly display visibility and password status in allowed room information.

#### Scenario: Join a public room

- **WHEN** Qualified users join a password-less public room that is not full and has not ended.
- **THEN** The system does not require the room host to approve one by one and continue the room check-in process.

#### Scenario: Access the linked room through the sharing portal

- **WHEN** The user uses a valid sharing entrance to open an unfinished link room
- **THEN** The system returns the minimum room information and allows the user to continue logging in and performing existing room entry verification

#### Scenario: Join password room

- **WHEN** Qualified user submits correct 4-digit password for any visibility password room
- **THEN** The system continues to execute the check-in process

#### Scenario: Wrong password

- **WHEN** User submitted wrong room password
- **THEN** The system refuses to join and the correct password must not be revealed

### Requirement: Room list and details

The system MUST provide a public live room list and room details that are allowed to be accessed, showing at least room visibility, theme, CEFR, current number of people and upper limit, start time, end time, room host nickname and password status. The public list MUST support CEFR precise filtering and standardized subject query, and exclude `LINK_ONLY` rooms; details MUST provide a stable sharing entrance for legal sharing operations.

#### Scenario: Browse to join the room

- **WHEN** Qualified user opens instant room list or allowed room details without submitting filter criteria
- **THEN** The system displays currently available public room information and real-time capacity status, and maintains the existing default paging behavior.

#### Scenario: Filter by CEFR and subject

- **WHEN** Qualified users submit valid CEFR and non-empty topic queries to browse instant rooms
- **THEN** The system only returns the current public rooms that match both CEFR and standardized theme conditions, and provides stable paging results bound to the filter conditions.

#### Scenario: The linked room does not enter the public list

- **WHEN** Qualified users browse the real-time room public list and there are linked rooms that meet other conditions
- **THEN** The system does not return the linked room, but users with valid sharing entries can still parse its minimum information
