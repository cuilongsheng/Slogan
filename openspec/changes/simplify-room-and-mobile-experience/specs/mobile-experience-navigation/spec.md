## Purpose

Define a simple personal entrance and input visibility on the mobile phone, so that users can find restriction appeals, vocabulary and real account exit, while ensuring that current input and submission can still be operated after the system keyboard pops up.

## ADDED Requirements

### Requirement: There are only three entrances to the personal center.

"My" MUST only displays three business entrances: "My Restrictions and Appeals", "My Vocabulary" and "Exit". The first two items enter the corresponding actual functions. Exit MUST call the existing logout process and clear the local session credentials.

#### Scenario: User logs out of account

- **WHEN** Logged-in user clicks to log out
- **THEN** Return to the login portal and the local authorization credentials are cleared. When the back-end revocation cannot be confirmed, the server-side revocation must not be claimed to have been completed.

### Requirement: The keyboard does not block input operations

The mobile version MUST keep the focused input box and corresponding send or submit operations visible when the system keyboard appears, and allow scrolling to subsequent form fields.

#### Scenario: Create room input near bottom field

- **WHEN** Android user focuses bottom field and keyboard pops up
- **THEN** The current input and submission operations can be seen and operated, and the layout is restored after the keyboard is closed.

### Requirement: The new version of the mobile phone has the same visual appearance

The mobile terminal MUST implement the page structure, style and interaction state according to the latest confirmed Figma original nodes, and no additional entries or decorations may be added based on the old implementation.

#### Scenario: Personal center and design comparison

- **WHEN** View personal center
- **THEN** Shows three entrances and navigation consistent with streamlined personal center design
