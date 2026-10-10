## Purpose

Allow users who actually participated in the room to view the keyword generation results after the meeting and independently maintain their own private vocabulary.

## ADDED Requirements

### Requirement: The mobile version only provides post-meeting summary entry for qualified historical rooms.

The mobile version MUST only display the summary entry in the history records where the person actually participated and the room has ended. The page MUST clearly display the `DISABLED`, `PENDING`, `READY`, and `UNAVAILABLE` statuses, and only `READY` displays server entries; MUST not display recordings, complete transcriptions, or member attributions.

#### Scenario: Appointment records only

- **WHEN** The user views the history of reservations only and no-shows.
- **THEN** Do not display the post-meeting keyword entry

#### Scenario: Generation not completed yet

- **WHEN** Qualified users view `PENDING` summary
- **THEN** Page explanation is still being generated and active refresh is allowed, candidate entries are not displayed

### Requirement: Personal vocabulary is explicitly imported and managed by the user

The mobile version MUST only import after the user explicitly clicks a single entry in the `READY` summary, and keep the idempotent flag for failed retries. My vocabulary list MUST provide paging, type and collection filtering; editing, collection and deletion MUST include the current version. In case of conflict MUST leave unsaved draft and do not claim command success.

#### Scenario: Retry after import result is uncertain

- **WHEN** The user encountered a network failure when importing a single keyword and tried again.
- **THEN** The same `clientRequestId` is used in two requests, and other entries are not automatically imported.

#### Scenario: Old version editor

- **WHEN** The server returns a version conflict when the user edits vocabulary.
- **THEN** The page retains input and prompts to manually load the latest list. Old versions do not automatically overwrite the server.
