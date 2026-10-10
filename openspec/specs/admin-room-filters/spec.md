# admin-room-filters Specification

## Purpose

Enables back-end personnel who have the right to view operating room details to locate rooms based on real server data, and obtain consistent and reviewable full query results when combining filtering and page turning.

## Requirements

### Requirement: The background room list supports combination filtering

The backend room list MUST allow users with `OPERATIONS_DETAILS_READ` permissions to use a combination of topics containing query or full room UUIDs, room status, visibility, and creation time lower bounds. Topic query MUST remove leading and trailing blanks and ignore case; when there is no filtering, MUST retain the original inverted list semantics. Unauthorized users MUST not read rooms via filter parameters.

#### Scenario: Combined query room

- **WHEN** Authorized user submission topic, status, visibility and creation time lower bound
- **THEN** Only return rooms that meet all conditions at the same time, and maintain a stable reverse order of creation time and room ID.

#### Scenario: Search for complete room identification

- **WHEN** Authorized user to submit complete room UUID
- **THEN** Query the room corresponding to this ID, do not use UUID as a normal topic search

#### Scenario: No permission to query

- **WHEN** Accounts without operation details permission submit any filter conditions
- **THEN** The server refused and did not return room information.

### Requirement: Room filtering and cursor binding

The background room list MUST bind a paging cursor to the normalized filter conditions. After changing any condition, the client MUST return to the first page; using the cursor of the old condition to query the new condition MUST be rejected, and the page results MUST not be mixed. When there are no results, MUST display an empty state instead of the design draft sample data.

#### Scenario: Stable page turning

- **WHEN** The user requested the next page using the same set of filter conditions and the previous page cursor.
- **THEN** Return to subsequent records in this range without repeating the room on the previous page

#### Scenario: Misuse of cursor after switching conditions

- **WHEN** User used old filter cursor for new filter criteria
- **THEN** The server returned a verification error, and the client requeried from the first page.
