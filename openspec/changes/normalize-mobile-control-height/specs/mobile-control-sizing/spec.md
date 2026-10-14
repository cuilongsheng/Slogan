## Purpose

Provide consistent, readable mobile input and action dimensions across pages and overlays while preserving their existing product operations.

## ADDED Requirements

### Requirement: Regular controls have consistent default height

Mobile single-line form inputs and regular action buttons and composer send/microphone controls MUST have a 46 logical-pixel visual height. Text and placeholders MUST remain fully visible. Large page actions MUST retain their approved responsive maximum width of 342. Selection controls (including language, level, capacity, access, room mode, profile preferences, filters and report categories), navigation bars, avatar/member/list targets and inline text links retain their separately designed geometry.

#### Scenario: Open a form or action overlay

- **WHEN** a user opens authentication, profile editing, room creation, room password, invitation, update or regular action controls
- **THEN** single-line inputs and regular actions have the same 46px height and readable content
- **AND** selected, disabled and busy states preserve the same geometry and existing operations

### Requirement: Personal identity follows the revised arrangement

Me MUST show the avatar to the left of a display-name column with language actions immediately under the name. Existing menu, reporting, supported update and logout operations MUST remain accessible.

#### Scenario: Open personal center

- **WHEN** the authenticated user opens Me
- **THEN** avatar and name/language controls use the revised side-by-side arrangement without a page heading
- **AND** language selection continues to persist and language options retain their original dimensions while action buttons follow the shared sizing requirement
