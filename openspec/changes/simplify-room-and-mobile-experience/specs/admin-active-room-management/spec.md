## Purpose

Define the current status boundary and readable card display of the backend operation room list, allowing administrators to directly grasp the information of ongoing and reserved rooms, and avoid completed records, technical labels and folding interactions from interfering with daily management.

## ADDED Requirements

### Requirement: The background business page uses the full content width

All business pages in the background MUST fill the available content area on the right side of the sidebar, retain normal margins, table scrolling, and elastic layer boundaries, and do not use a fixed maximum content width to leave a large blank space on the large screen.

#### Scenario: View the operation page on a large screen

- **WHEN** The user opens the room, case, appeal, downgrade event, role or audit page on the large screen
- **THEN** The content area expands with the viewport and keeps the table/card readable, with only normal margins on the right

### Requirement: Only display currently operating rooms

Backend room management MUST only display ongoing and reserved rooms, ended and canceled rooms MUST be removed from this list; list counting, filtering and paging MUST be based on the same status collection, and historical facts used for auditing and other purposes MUST not be deleted.

#### Scenario: Room ends

- **WHEN** The ongoing room ends and the list is refreshed
- **THEN** This room no longer appears, and the paging and counting of other current rooms remain correct.

### Requirement: Cards directly display understandable information

The card MUST not need to be expanded to display the information required for the operation of the room; the type MUST use the user language, such as an instant room or a reserved room; the UUID MUST not be displayed as the main room identification.

#### Scenario: Administrator browse card

- **WHEN** The administrator opens room management
- **THEN** You can directly see the topic, Chinese type, status, level range, number of people, time and existing operation statistics without clicking on the details to collapse the entrance.
