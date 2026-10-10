## Purpose

Define how users can save post-session keywords or short expressions that they can read as private word entries, and continue to maintain personal learning content in a paging, editable, deletable, collectible, and concurrently safe manner.

## ADDED Requirements

### Requirement: Users can only add words to the wordbook from the summary that can be read by themselves.

The system MUST allow authenticated users to select the `READY` room summary entries that they have the right to read to add to their personal vocabulary books. Added MUST. The text and type allowed for copying are user private content, and the ability to read the content of other members is not established. The same request with the same idempotent ID MUST not be created repeatedly. Changing the payload reuse ID MUST conflicts.

#### Scenario: Add entries from readable summary

- **WHEN** Actual participants choose valid keywords or short expressions in the summary that they can read
- **THEN** The system creates a wordbook entry owned by the current user and returns the stable identification, version and collection status

#### Scenario: Replay the same join request

- **WHEN** User replays the exact same join request using the same idempotent ID
- **THEN** The system returns the original results and does not create repeated entries

#### Scenario: Join from unreadable summary

- **WHEN** The user selected a room that has not participated in the room, a summary that has not yet been completed, or a summary entry that does not exist.
- **THEN** The system rejects the request without disclosing other users, room candidates, or internal generation status

### Requirement: The word list only returns my content

The system MUST provide the current user with a stable keyset-paged personal vocabulary list, and support filtering by collection status and entry type. The response MUST only contains entries that currently exist for me, and does not return other users' saving behavior or room member information.

#### Scenario: View my vocabulary book in pages

- **WHEN** User queries wordbook using valid limits and cursor
- **THEN** The system returns my entries and the next page cursor in a stable order, without repeating or skipping existing entries outside the concurrency boundary.

#### Scenario: Filter by collection and type

- **WHEN** User submits valid collection status or keyword/short expression type filtering
- **THEN** The system only returns my entries that meet the conditions at the same time, and the cursor is bound to the filtering conditions.

#### Scenario: User has no entries

- **WHEN** User queries empty word book
- **THEN** The system returns an empty list and an empty next page cursor, and does not automatically save the room summary content.

### Requirement: Users can edit their own entries concurrently and securely

The system MUST allow entry owners to edit display text and personal paraphrases or comments within the allowed length, and use version preconditions to prevent old writes from overwriting new content. Editing MUST not modify the source room summary or entries saved by other users from the same summary.

#### Scenario: Edit with current version

- **WHEN** Owner submitted valid text or personal notes in current version
- **THEN** The system saves the standardized content, incremental version and returns the update result

#### Scenario: Old version edited late

- **WHEN** Two editors competing for submission based on the same old version
- **THEN** At most one edit is successful, the other receives a stable version conflict and the submitted content remains intact

#### Scenario: Edit directly by non-owner

- **WHEN** User attempts to edit another user's entry by guessing the ID
- **THEN** The system rejects the operation and does not return the entry's content or owner information.

### Requirement: Users can favorite or delete their own entries

The system MUST allow the entry owner idempotent to set favorite status and delete his own entry. The entry MUST no longer appear in reads or lists after deletion, and late edit or favorite commands for older versions MUST not restore it.

#### Scenario: Set favorite status

- **WHEN** The owner has set or unfavorited a valid entry
- **THEN** The system returns to the target collection state, and repeated settings of the same state will not produce duplicate entries.

#### Scenario: Delete entry

- **WHEN** The owner deletes the currently existing wordbook entry
- **THEN** The system removes the user's private copy, but the shared room summary and other user entries remain unchanged

#### Scenario: Old command late after deletion

- **WHEN** Old version edit or favorite command arrived after entry deleted
- **THEN** The system rejected the old command and may not restore deleted content

### Requirement: The word book must not be automatically exposed or diffused

The system MUST only create personal wordbook entries after the user explicitly selects them, and may not automatically import the entire room summary, display it to the room host or other members, write private post-meeting notes, or use it for security judgment.

#### Scenario: Room summary completed

- **WHEN** The summary after the room meeting becomes `READY`
- **THEN** The system does not automatically create wordbook entries for any member, waiting for each user to select independently.

#### Scenario: Other members save the same entry

- **WHEN** Multiple members each selected the same shared summary entry
- **THEN** The system creates personal copies that are isolated from each other. Editing, favorites or deletions by any member will not affect others.
