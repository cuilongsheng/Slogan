# identity-and-profile Specification

## Purpose

Define the identity authentication, first data initialization and adult access boundaries that users must complete before entering the voice room product to prevent uncompleted data or underage accounts from entering the current version of the room.

## Requirements

### Requirement: Third-party account login

The system MUST support users to log in through WeChat or Google accounts; create a platform account when successfully authenticating for the first time, and associate it back to the same third-party identity for subsequent authentications.

#### Scenario: First third-party login

- **WHEN** User completes authentication through WeChat or Google for the first time
- **THEN** The system creates a platform account and guides the user to complete the first data initialization

#### Scenario: There is already a third-party identity to log in again

- **WHEN** The associated third-party identity has been authenticated again.
- **THEN** The system logs in to the corresponding platform account and no duplicate accounts are allowed to be created.

### Requirement: First data initialization

The system MUST require first-time users to provide a valid avatar, display name, at least one interest, and a CEFR English level before browsing, creating, or joining rooms. Gender, nationality/city, and birth year/month MUST be optional. An omitted optional value MUST NOT cause a required-field error or be replaced with fabricated personal data. If birth information is supplied, both year and month MUST be supplied together and validated. New users MUST explicitly confirm that they are at least 18 years old before completing initialization; the confirmation MUST NOT be preselected.

#### Scenario: Data not completed

- **WHEN** a logged-in user has not completed the required information or adult confirmation
- **THEN** the system allows continued profile completion and does not allow room operations, with a specific explanation of the missing requirement

#### Scenario: Data completed

- **WHEN** the required information and adult confirmation are valid and all three optional details are omitted
- **THEN** the system completes the profile without requiring gender, location, or a birth date and applies the adult access boundary

#### Scenario: Optional details supplied

- **WHEN** the user supplies optional personal details
- **THEN** the system validates and saves those values without silently inventing or altering personal information

### Requirement: Adult access boundary

The system MUST preserve adult-only room creation, joining, and invitation acceptance. For a completed profile without a supplied birth date, the server MUST use the persisted explicit adult confirmation. When a birth year/month is present, the existing conservative month-based age calculation MUST take precedence: an underage birth date MUST NOT be overridden by an adult assertion. A previously recorded underage birth date MUST NOT be cleared or bypassed through ordinary profile submission to evade the boundary. Existing completed profiles with valid birth information MUST retain their existing eligibility without fabricated confirmation history. All eligibility consumers MUST apply the same decision.

#### Scenario: Under 18 years old

- **WHEN** the supplied or previously recorded birth information identifies the user as under 18
- **THEN** the system refuses room creation, joining, and invitation acceptance even if adult confirmation is true and displays the age restriction explanation

#### Scenario: Over 18 years old

- **WHEN** the user's existing birth information establishes adult eligibility and all other access conditions are met
- **THEN** the system permits supported room services without requiring the user to re-enter an existing completed profile

#### Scenario: Birth date omitted with explicit confirmation

- **WHEN** a new user omits birth information, explicitly confirms adult age, and completes required profile information
- **THEN** the server persists the confirmation and consistently permits adult-qualified room operations if other eligibility conditions are met

#### Scenario: Confirmation absent or forged locally

- **WHEN** the server has neither a valid adult birth date nor a persisted adult confirmation
- **THEN** client-side state or direct requests MUST NOT grant room or invitation eligibility

### Requirement: Actionable profile form feedback

The mobile web and Android profile forms MUST clearly identify required and optional inputs. Invalid inputs MUST receive localized field-specific messages beside the affected input, including the correction needed; a generic completion error MUST NOT be the sole feedback. Corrected field errors MUST clear, entered values MUST survive failures, and the first invalid field MUST be brought into view. Server validation violations MUST map to the corresponding fields. Non-field failures MUST show an actionable form-level message without disclosing provider details.

#### Scenario: Missing display name

- **WHEN** the user continues without a valid display name
- **THEN** the form identifies the display-name field and explains its 2–40 character requirement without blaming omitted optional fields

#### Scenario: Invalid optional birth information

- **WHEN** the user enters only one birth component, an invalid month, or a future birth date
- **THEN** the form identifies the offending birth input and explains how to correct or clear both optional fields

#### Scenario: Invalid preferences

- **WHEN** the user submits without an interest or CEFR selection
- **THEN** the form identifies each missing selection beside its control and preserves the first-step entries

#### Scenario: Server rejects a field

- **WHEN** the profile endpoint rejects a recognized field
- **THEN** the form displays the matching localized field error, keeps the user's entries, and supports correction without restarting login
