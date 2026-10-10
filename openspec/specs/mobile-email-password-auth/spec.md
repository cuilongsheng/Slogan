# mobile-email-password-auth Specification

## Purpose

Define the interface process for username and password authentication on the mobile phone, email verification after registration, and password retrieval, so that data navigation after login, web page refresh recovery, and native session storage comply with the existing authentication contract and security boundaries.

## Requirements

### Requirement: Login with username and password

The mobile version MUST provide username and password login according to the confirmed login design, and keep Google login available. After successfully logging in with a verified account, MUST navigate according to the server data status; refresh the web page MUST restore the session and refresh the credentials MUST remain in the HttpOnly Cookie.

#### Scenario: Login with verified account

- **WHEN** The user submitted the correct username and password
- **THEN** The system establishes a session and enters the data page, age restriction page or room list according to the data status.

#### Scenario: Bad credentials

- **WHEN** User submitted incorrect username or password
- **THEN** The system displays a unified error and does not establish a session

#### Scenario: Browser refresh

- **WHEN** Refresh after logging in with the web page password
- **THEN** The system restores the same session through HttpOnly Cookie and does not write the refresh credentials to the browser's normal storage.

### Requirement: Registration and email verification

The mobile terminal MUST provide username, email, and password registration, display the email pending verification status, support resending after the cooling period and use a single verification token for confirmation; return to login after confirmation, and do not directly establish a business session.

#### Scenario: Register and verify

- **WHEN** The user submits valid and unoccupied information and confirms it using the email link
- **THEN** The system prompts that the verification is completed and allows login using username and password.

#### Scenario: Unverified login

- **WHEN** User attempts to log in when their email address is not verified
- **THEN** The system does not establish a session and guides it to complete the verification

### Requirement: Retrieve and reset password

The mobile terminal MUST provide the process of requesting reset through the registered email address and setting a new password using a single token; the acceptance result MUST not reveal whether the email address exists.

#### Scenario: Apply for retrieval

- **WHEN** The user submits an email in a valid format
- **THEN** The system displays the same acceptance result regardless of whether the email address exists or not.

#### Scenario: Reset successful

- **WHEN** The user submits a new password that complies with the policy through a valid email link
- **THEN** The system prompts for password update and allows return to login.
