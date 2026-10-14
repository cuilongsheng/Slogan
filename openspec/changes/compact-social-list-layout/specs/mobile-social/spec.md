## ADDED Requirements

### Requirement: Partner and conversation lists share compact divider rows

Partners and Messages SHALL render the approved compact divider layout with centered 16px headings, left avatars, bounded two-line text and right circular chat icons. Partners SHALL omit a redundant availability subtitle. Existing authenticated availability, message previews, unread indicators, paging, refresh and conversation commands SHALL remain functional. Missing avatar images SHALL have a visible styled fallback rather than an empty space.

#### Scenario: Open Partners
- **WHEN** an eligible user opens a populated Partners list
- **THEN** actual available peers use divider rows with level/availability details and an icon action opening the existing conversation operation

#### Scenario: Read a recent conversation
- **WHEN** a user opens Messages with recent conversations
- **THEN** the same row layout displays actual peer names, previews and unread counts
- **AND** tapping opens the conversation and long pressing retains the existing history-management action

#### Scenario: Missing avatar or long copy
- **WHEN** an avatar is missing or fails, or a display name/message is long
- **THEN** the row has a visible initial fallback and bounds its text without horizontal overflow or increased row height

### Requirement: Main tabs use the revised shared bottom bar

All four main tabs SHALL use the confirmed compact bottom bar with a consistent 61px height, 24px icons, 11px labels, white background and color-only selected state. The bar SHALL preserve existing navigation, accessible selection and unread-message feedback.

#### Scenario: Switch main tabs
- **WHEN** the user switches Discover, Partners, Messages or Me
- **THEN** the same compact bar geometry is retained and only the active tab's icon/label use the selected color
- **AND** unread-message feedback remains visible without a selection circle
