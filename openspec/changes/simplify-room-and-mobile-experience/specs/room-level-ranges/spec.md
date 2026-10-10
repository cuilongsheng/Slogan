## Purpose

Defines instant and reserved rooms with range selection, human-readable presentation, and compatibility with existing single-level configurations, allowing the room host to express appropriate participant level ranges instead of being forced to select a single-level label.

## ADDED Requirements

### Requirement: Rooms are in English level range

When creating new instant and reserved rooms, MUST support expressing the suitable range with the upper and lower limits of the CEFR level, such as B1–B2; the range MUST be directly visible on the creation page, and the creation, details, list, and backend MUST be displayed consistently. Inputs with a lower limit higher than the upper limit MUST be rejected.

#### Scenario: Create range room

- **WHEN** Qualified users select B1–B2 for instant or reserved rooms and submit
- **THEN** The room saves the range and displays B1–B2 on each end

#### Scenario: Input inversion range

- **WHEN** User submits a range where the lower limit is higher than the upper limit
- **THEN** The server refused to create and did not generate a room.

### Requirement: Old rooms and old clients continue to be valid

The system MUST be compatible with existing single-level rooms and old client single-level requests, and maintain the original qualification and capacity rules; the range selection MUST not modify the user's personal English level.

#### Scenario: Old client creates single-level rooms

- **WHEN** The old client submitted the original legal B1 configuration
- **THEN** The create request is still valid, the room is shown as B1 and the user profile has not changed

### Requirement: The mobile phone creation page uses three fixed level ranges

The mobile instant and reservation creation UI MUST only provide three directly visible options: A1～A2, B1～B2, C1～C2, and do not select the lowest/highest level separately. When creating a new room on a mobile phone, it MUST use the public default value and turn off the audio processing of the two rooms, and do not display the corresponding setting items; the existing room and other legal client scope contracts remain unchanged.

#### Scenario: One selection range

- **WHEN** The user clicks C1～C2 and creates an instant or reserved room
- **THEN** The upper and lower request limits are C1/C2, visibility is PUBLIC, and the two room audio processing flags are false.
