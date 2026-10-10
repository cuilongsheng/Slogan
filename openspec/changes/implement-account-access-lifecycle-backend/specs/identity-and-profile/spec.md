## ADDED Requirements

### Requirement: Verified mobile phone number can establish platform identity

The system MUST allow users to create or log in to the platform account through valid international mobile phone number OTP verification, and allow first-time mobile phone number users to enter the data initialization and adult access process consistent with third-party login. Mobile phone number verification only proves control of the number and must not be described as proof of true identity or age.

#### Scenario: Initialize data after first login with mobile phone number

- **WHEN** The user establishes a platform account through mobile phone number OTP for the first time
- **THEN** The system returns the data incomplete status and continues to block room services until the data and age verification are completed.

#### Scenario: Mobile phone number cannot replace age information

- **WHEN** The user has verified the mobile phone number but has not filled in the qualified date of birth.
- **THEN** The system still requires the completion of birth date and adult verification, and will not automatically determine adult due to mobile phone number verification.

### Requirement: Multiple verified logins share one user profile

The system MUST allow the same userId to have multiple verified login methods in mobile phone number, Google and WeChat. The same profile, adult status, room history, wordbook, and security boundaries MUST be returned when logging in via any of the bound methods. Profiles or users MUST not be duplicated for each login method.

#### Scenario: Log in through the second login method

- **WHEN** The user has bound the second login method to his account and used it to complete authentication.
- **THEN** The system logs in the original userId and returns the original information and onboarding status

#### Scenario: Provider suggested information is similar to existing account

- **WHEN** New OAuth identity returns email, nickname, or avatar suggestions that are the same as an existing account
- **THEN** The system is not allowed to automatically bind or merge based on this. Only a clear login binding process can add login methods.

### Requirement: Canceled accounts are hidden from normal identity and data reading

The system MUST make it impossible for the `DELETED` account to read exposed private data through normal current user, public profile, room discovery, friends, idle, or invitations. Preserved security and audit facts can only be read by explicit background restricted capabilities.

#### Scenario: Ordinary users can read canceled account information

- **WHEN** Ordinary users request canceled account information through old relationships or guessed userIds
- **THEN** The system returns stable non-leak results and does not return avatar, display name, city, interests, mobile phone number or login method
