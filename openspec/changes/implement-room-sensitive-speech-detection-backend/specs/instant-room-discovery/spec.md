## MODIFIED Requirements

### Requirement: Create instant room

The system MUST allow users who have completed the profile, are over 18 years old, and are not in a platform restricted state to create instant rooms; the room host MUST set CEFR, theme, and a maximum number of 2 to 6 people, you can choose `PUBLIC` or `LINK_ONLY` visibility, you can explicitly choose whether to enable sensitive speech recognition when creating, and the default room duration is 2 hours. Existing client requests that do not submit visibility MUST be processed as `PUBLIC`; existing client requests that do not submit sensitive speech recognition fields MUST be processed as close. Sensitive speech recognition selections MUST be immutable after creation.

#### Scenario: Qualified users create rooms

- **WHEN** Qualified user submitted a valid live room configuration without specifying visibility or specifying `PUBLIC`
- **THEN** The system immediately creates and opens a public room, and generates a clear end time and stable sharing entrance.

#### Scenario: Qualified users create linked rooms

- **WHEN** Qualified user submits valid configuration and specifies `LINK_ONLY`
- **THEN** The system immediately creates and opens the linked room, generates a stable sharing entrance, and the room does not appear in the public discovery list

#### Scenario: Create a room with sensitive speech recognition enabled

- **WHEN** Qualified user explicitly enabled sensitive speech recognition in a valid create request
- **THEN** The system saves the immutable enabled status and makes the room information before joining clearly display the processing conditions

#### Scenario: Unqualified user creates a room

- **WHEN** The user has not completed the profile, is under 18 years old, is in platform restricted status, or submitted with unknown visibility
- **THEN** The system refuses to create a room and returns the corresponding reason

### Requirement: Room list and details

The system MUST provide a public live room list and room details that allow access, showing at least room visibility, theme, CEFR, current number of people and upper limit, start time, end time, room host nickname, password status, and sensitive speech recognition enabled status. The public list MUST support CEFR precise filtering and standardized subject query, and exclude `LINK_ONLY` rooms; details MUST provide a stable sharing entrance for legal sharing operations.

#### Scenario: Browse to join the room

- **WHEN** Qualified user opens instant room list or allowed room details without submitting filter criteria
- **THEN** The system displays currently available public room information, real-time capacity and sensitive speech recognition status, and maintains the existing default paging behavior

#### Scenario: Filter by CEFR and subject

- **WHEN** Qualified users submit valid CEFR and non-empty topic queries to browse instant rooms
- **THEN** The system only returns the current public rooms that match both CEFR and standardized theme conditions, and provides stable paging results bound to the filter conditions.

#### Scenario: The linked room does not enter the public list

- **WHEN** Qualified users browse the real-time room public list and there are linked rooms that meet other conditions
- **THEN** The system does not return the linked room, but users with valid sharing entries can still parse minimal information containing sensitive voice recognition status
