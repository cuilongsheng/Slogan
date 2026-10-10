# room-discovery-sharing Specification

## Purpose

Define public discovery, link visibility, combinable filtering and sharing entry boundaries for instant and scheduled voice rooms, allowing users to safely find rooms from lists or external links without bypassing any account and room entry rules.

## Requirements

### Requirement: Room visibility remains consistent across room types

The system MUST save `PUBLIC` or `LINK_ONLY` visibility for live and reserved rooms. `PUBLIC` rooms can enter the corresponding public list, `LINK_ONLY` rooms MUST not enter any public discovery lists; visibility MUST not change room passwords, capacity, reservations, or membership rules.

#### Scenario: Create a public reservation room

- **WHEN** Qualified room host creates a reservation room and selects `PUBLIC`
- **THEN** The system saves public visibility, and the room appears in the reservation room list when it meets the current status and filter conditions.

#### Scenario: Create a link to reserve a room

- **WHEN** Qualified room host creates a reservation room and selects `LINK_ONLY`
- **THEN** The system saves the link visibility and generates a sharing entry, but does not return to the room in the public list of reserved rooms.

#### Scenario: Password and visibility combination

- **WHEN** Room host Create a public room or linked room with password
- **THEN** The system saves both visibility and password status and continues to require the correct password when actually joining or making an appointment

### Requirement: Public rooms support CEFR and topic filtering

The system MUST allow qualified users to filter in combination with a valid CEFR rating and an optional subject query in the public list of live and reserved rooms. CEFR MUST match exactly; subject queries MUST remove leading and trailing whitespace and use case-insensitive inclusive matching. MUST maintain the existing sorting and paging semantics of the corresponding list when filtering is not committed.

#### Scenario: Filter only by CEFR

- **WHEN** User submitted `B1` in the public room list
- **THEN** The system only returns rooms whose CEFR is `B1`, which are currently discoverable and belong to the room type in this list.

#### Scenario: Combination filter theme

- **WHEN** User submitted valid CEFR and subject query containing uppercase and lowercase or leading and trailing whitespace
- **THEN** The system filters the standardized subject content and CEFR at the same time, and returns stable sorting results.

#### Scenario: Illegal filtering

- **WHEN** User submitted unknown CEFR, blank topic, overlong topic, or broken paging cursor
- **THEN** The system returns a stable verification error and does not execute the unqualified query

### Requirement: Filter paging cannot mix contexts

The system MUST enable public list paging cursors to bind room type, visibility, and normalization filters. The cursor is only valid under the original query conditions. List page turning MUST maintain the existing deterministic sorting. Rooms in the wrong range MUST not be skipped or repeatedly returned due to switching filter conditions.

#### Scenario: Use the same conditions to turn pages

- **WHEN** The user submits the cursor returned from the previous page with the original room type and filter conditions.
- **THEN** The system returns the next page of the filtered results without repeating the items on the previous page.

#### Scenario: Cursor and filter are inconsistent

- **WHEN** The user uses the cursor under a certain CEFR, topic or room type for different query conditions
- **THEN** The system returns a stable checksum error and does not return mixed range data.

### Requirement: Each room has a stable and non-enumerable shared entrance

The system MUST generate a high-entropy stable sharing identifier for each instant room and reservation room that is independent of the internal room identifier, and can generate a sharing URL under the configured domain name accordingly. Sharing portals are stable for the same room while the room is available, and must not contain members, passwords, authentication credentials, provider identification, or information that can be used to infer personal identity.

#### Scenario: Get room sharing entrance

- **WHEN** Authenticated users view details of rooms they have access to
- **THEN** The system returns the stable shared URL of the room, and repeated reading will not generate multiple different entries.

#### Scenario: Compare the shared entrance of two rooms

- **WHEN** The system returns shared entrances for the two rooms respectively.
- **THEN** Two entrances use different unpredictable sharing IDs and the IDs are not equal to the internal room ID

### Requirement: The sharing portal only discloses the minimum room information

The system MUST allow unlogged callers to use a valid share ID to resolve the minimum information that can still access the room, including the room ID required for internal entry, room type, status, visibility, theme, CEFR, number of people and upper limit, start and end time, room host nickname, and password status. The response MUST not contain member lists, bookers, passwords, user contact information, live credentials, or internal provider data.

#### Scenario: Not logged in to open a valid sharing link

- **WHEN** A non-logged-in user opens a valid sharing portal that is still available for reservation, available for joining, or open.
- **THEN** The system returns the minimum room information so that the client can display the room and guide you to log in or continue entering the room.

#### Scenario: The sharing ID does not exist or the room is no longer accessible

- **WHEN** The caller uses an unknown sharing ID, or the corresponding room has been canceled, is ending, or has ended.
- **THEN** The system returns stable non-existence or unavailability results without disclosing historical members and termination reasons.

### Requirement: The shared entrance cannot be used as a room check-in voucher

The system MUST continue to perform existing login, profile, age, security restrictions, room status, reservations, rule confirmation, password and capacity verification after sharing portal resolution. Holding a shared ID does not generate reservation, membership, real-time credentials or room host management rights.

#### Scenario: Restricted users can join by sharing a link

- **WHEN** Users who are restricted by the platform hold a valid sharing ID and directly request to join or obtain real-time credentials
- **THEN** The system denies based on existing restrictions and does not create membership or issue credentials

#### Scenario: The password room is accessed through a shared link

- **WHEN** The user parsed the shared entrance of the password-protected room but did not submit the correct password.
- **THEN** The system only allows viewing the minimum password status and refuses to continue when making an appointment or actually joining.

#### Scenario: The link room is full

- **WHEN** The user accesses the linked room through the sharing portal, but the actual quota and reserved seat rules determine that there is no available quota.
- **THEN** The system refuses to make a reservation or join, and the capacity of the sharing portal cannot be expanded.
