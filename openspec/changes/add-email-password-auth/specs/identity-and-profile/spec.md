## ADDED Requirements

### Requirement: Username and password registration for email verification

The system MUST require a unique username, valid email address, and password on registration. Usernames contain 3–20 Latin letters, digits, or underscores; passwords contain 8–128 characters. Submission leads to the email-verification-pending state.

#### Scenario: Submit available registration information

- **WHEN** The user submits an unoccupied user name, an unoccupied valid email address and a password that complies with the security policy
- **THEN** The system displays the "Verification email has been sent" status, target email address and resend entry

#### Scenario: Email verification completed

- **WHEN** The user completed verification using email verification information that is still valid
- **THEN** The system guides the user to enter the first data initialization

#### Scenario: Username or email address has been used

- **WHEN** The user submits registration using the registered username or email address
- **THEN** The system displays a recoverable occupancy error near the corresponding field.

#### Scenario: Unverified account trying to continue

- **WHEN** An account that has not completed email verification attempts to enter the room service after the first data initialization.
- **THEN** The system denies access and allows the user to resend the verification email

### Requirement: Login with username and password

The system MUST allow accounts that have completed email verification to log in using usernames and passwords, and MUST not reveal whether the username exists through error prompts.

#### Scenario: Log in with correct credentials

- **WHEN** Verified account submitted correct username and password
- **THEN** The system establishes a login session and enters the first data initialization or room service according to the data completion status.

#### Scenario: Login using incorrect credentials

- **WHEN** User submitted a non-existent username or wrong password
- **THEN** The system refuses to log in and displays a unified prompt that does not distinguish between wrong user names or passwords.

#### Scenario: Account login with unverified email address

- **WHEN** The username and password are correct but the email address has not been verified yet
- **THEN** The system does not establish a complete login session and provides an entrance to resend the verification email.

### Requirement: Retrieve password via email

The system MUST provide an interface for retrieving passwords through registered email addresses, and allow users to return to the login page from the acceptance results.

#### Scenario: Request to reset password

- **WHEN** The user submits an email address to request password retrieval.
- **THEN** The system displays unified acceptance results that do not reveal whether the email address has been registered.

#### Scenario: Reset password using valid credentials

- **WHEN** User submitted a new security policy compliant password using reset credentials that are still valid and unused
- **THEN** The system displays the result that the password has been updated and allows the user to return to login.

#### Scenario: Invalid or expired reset credentials used

- **WHEN** User submitted invalid, used, or expired password reset credentials
- **THEN** The system displays that the link is invalid or expired, and allows the user to re-initiate password retrieval.

## MODIFIED Requirements

### Requirement: Third-party account login

The system MUST support users logging in through WeChat or Google accounts; WeChat login on the mobile side uses a QR code for scanning by another device and handles waiting, success, expiration, and refresh status; Google login uses the account selection interface and handles selection, cancellation, and failure; a platform account is created when the first successful authentication is performed, and subsequent authentications are linked back to the same third-party identity.

#### Scenario: Generate WeChat login QR code

- **WHEN** The user chooses WeChat to log in on the mobile terminal
- **THEN** The system displays the limited-time QR code for scanning by another device, instructions for use, and the current waiting status.

#### Scenario: WeChat QR code login successful

- **WHEN** The user completed the confirmation through another device within the validity period of the QR code
- **THEN** The system completes the corresponding WeChat identity authentication and creates an account or logs in to an existing account according to the account status

#### Scenario: WeChat QR code expired

- **WHEN** The WeChat login QR code has expired and the confirmation has not been completed.
- **THEN** The system stops waiting and allows the user to refresh the QR code or return to other login methods.

#### Scenario: Select Google Account

- **WHEN** The user selects Google login and confirms an account on the account selection screen
- **THEN** The system completes the corresponding Google identity authentication and creates an account or logs in to an existing account according to the account status

#### Scenario: Google sign-in canceled or unable to complete

- **WHEN** User canceled account selection or Google authorization failed
- **THEN** The system returns to the login page and displays the retry feedback without creating a login session.

#### Scenario: First third-party login

- **WHEN** User completes authentication through WeChat or Google for the first time
- **THEN** The system creates a platform account and guides the user to complete the first data initialization

#### Scenario: There is already a third-party identity to log in again

- **WHEN** The associated third-party identity has been authenticated again.
- **THEN** The system logs in to the corresponding platform account and no duplicate accounts are allowed to be created.
