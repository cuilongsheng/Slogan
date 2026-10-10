## Purpose

Define the authentication entrance and email deactivation status of the first round of web trial, so that recruiters and overseas experiencers can use the normal process through the preset password account or Google, directly access the closed route, and get accurate feedback in Chinese and English, without seeing emails that have not been sent or obtaining background overrides.

## ADDED Requirements

### Requirement: The web portal follows real authentication capabilities

Mobile Web MUST retain the username, password and configured Google login when the trial email is closed, and hide the email registration and retrieval entrance; the normal mailbox mode maintains the original process. When the authentication capability is unknown or the query fails, the email action MUST not be opened and static success MUST not be displayed. The front end MUST consume unique API contracts and existing authentication status, and do not use hidden entrances as server-side security boundaries.

#### Scenario: Trial login page

- **WHEN** Mobile webpage receives password and Google available, email closed authentication capabilities
- **THEN** Provide normal password and Google login, no operable email registration/retrieval entrance is presented, navigate according to server data status after success

#### Scenario: Capability query failed

- **WHEN** Authentication capability cannot be determined
- **THEN** Displays the recoverable status and does not open email actions, does not declare that the email has been sent or the authentication configuration is successful.

### Requirement: Close the email page to provide clear feedback and do not automatically send requests

When the email is closed, directly access the registration, verification, retrieval, reset or email binding page MUST display the corresponding Chinese and English prompts that the current trial is unavailable and return to the login entrance, and do not perform email requests or automatically consume link tokens. Link fragment MUST be promptly removed from the address bar in accordance with existing privacy rules. UI MUST reuse the visual language of the confirmation page and do not fake the status of pending receipt, email success or email verification.

#### Scenario: Directly open the old email link

- **WHEN** User opens verification/reset link with token in trial with email closed
- **THEN** Clear sensitive fragments, display unavailable and return to login, do not confirm token, do not display verified/reset successful

#### Scenario: Chinese and English deactivation page

- **WHEN** Chinese or English users can directly open any close email process page
- **THEN** Give consistent, understandable deactivation feedback in appropriate language, do not send email requests, and return to normal password or Google login

### Requirement: There is a normal session and real-time authorization for background use.

The backend MUST reuse the existing username, password and Google browser entrance, and use the current backend identity/role to determine visible routes after logging in; mobile accounts without backend roles or ordinary Google visitors MUST be in a permissionless state and do not return or display backend data. The browser refresh credentials MUST remain in the HttpOnly Cookie, and the access token is only in memory; the empty verification time projected by the password account source MUST not cause page crashes or false positives for email verification.

#### Scenario: Two background accounts enter separately

- **WHEN** Administrator and safety officer log in in separate browser sessions using their respective usernames and passwords
- **THEN** Each obtains the final role of the server and has the authority to route. Requery the permissions after refreshing. No identity or session is shared.

#### Scenario: Ordinary account can directly access the backend

- **WHEN** Any mobile experience account or Google user without a administrative role can directly open background protected routing
- **THEN** Displays no permission status, the server rejects admin data; changing the client role cannot obtain permissions

#### Scenario: Experience source can be displayed and session is secure

- **WHEN** Experience user query login method or refresh browser session
- **THEN** Correctly handle unverified email sources and empty times, without exposing placeholder mailboxes or writing refresh tokens to ordinary browser storage
