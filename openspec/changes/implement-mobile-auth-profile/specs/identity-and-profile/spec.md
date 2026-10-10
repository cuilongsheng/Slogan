## MODIFIED Requirements

### Requirement: Third-party account login

The system MUST support users to log in through WeChat or Google accounts; create a platform account when successfully authenticating for the first time, and associate it back to the same third-party identity for subsequent authentications. After the browser Google login is successful, the system MUST resume login when the page is refreshed within the same browser session, and clear the browser session when exiting; the refresh credentials MUST be managed by the backend through the `HttpOnly` Cookie and MUST not be stored in the browser's ordinary persistent storage.

#### Scenario: First third-party login

- **WHEN** User completes authentication through WeChat or Google for the first time
- **THEN** The system creates a platform account and guides the user to complete the first data initialization

#### Scenario: There is already a third-party identity to log in again

- **WHEN** The associated third-party identity has been authenticated again.
- **THEN** The system logs in to the corresponding platform account and no duplicate accounts are allowed to be created.

#### Scenario: Restore login after refreshing the browser

- **WHEN** Browser Google refreshes the page within the same browser session after successful login
- **THEN** The system restores identity and navigates to the user's current profile status via a server-side protected refresh session

#### Scenario: The first data pre-fill is retained after the browser is refreshed

- **WHEN** Google name or avatar suggestions are returned when logging in for the first time, and the user refreshes the profile page in the same tab
- **THEN** The system only restores non-credential information suggestions for accounts on the same platform, and does not display suggestions from another account to the current user.

#### Scenario: Browser exit

- **WHEN** Logged-in user logged out in browser preview
- **THEN** The system revokes the server session and clears the browser refresh cookie. The system remains logged out after refreshing the page.

### Requirement: First data initialization

The system MUST require users who log in for the first time to fill in their avatar, name, gender, nationality or city, interests and hobbies, CEFR English level range and date of birth; they are not allowed to browse, create or join rooms without completing the information. Newly submitted data MUST support the three level ranges A1–A2, B1–B2, and C1–C2; historical single-level data MUST remain readable.

#### Scenario: Data not completed

- **WHEN** The logged in user has not completed the required information.
- **THEN** The system only allows him to continue to complete the information and does not allow him to enter the room business.

#### Scenario: Data completed

- **WHEN** All required information submitted by the user passes verification, and CEFR is a supported level range
- **THEN** The system marks this as profile complete and allows qualifying room operations to proceed

#### Scenario: Historical single-level data

- **WHEN** The user saved A1, A2, B1, B2, C1 or C2 single-level data before this change
- **THEN** The system can still read its information and qualification status, and the original value must not be lost due to the introduction of interval values.
