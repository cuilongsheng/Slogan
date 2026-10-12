## Purpose

Define the approved phase-one profile, language, shared authentication, durable maintenance, and guarded production delivery boundaries so that local implementation and verified release evidence remain distinct.

## ADDED Requirements

### Requirement: Missing provider avatars do not block account setup

The system MUST supply a trusted default avatar when an external provider has no valid picture and MUST allow authenticated users to select and replace a bounded supported image. Gender, city, and birth fields remain optional; the adult confirmation remains required.

#### Scenario: Provider omits its picture

- **WHEN** an authenticated new user completes the required profile fields and adult confirmation
- **THEN** the application-owned default picture allows completion without an external avatar URL

### Requirement: Language preference is explicit and persistent

The application MUST allow Chinese or English selection, persist it across restarts, and use device language only when the user has not selected a preference.

#### Scenario: English preference on a Chinese device

- **WHEN** a user selects English and restarts the application
- **THEN** product text remains English without changing their profile or device settings

### Requirement: Production release has durable execution and migration gates

Enabled background maintenance MUST have explicit managed scheduling independent of HTTP process lifetime. Production schema upgrades MUST be guarded by target verification, encrypted backup, forward-compatible migration, and post-release evidence. PR jobs MUST NOT mutate production schemas.

#### Scenario: Request finishes before maintenance

- **WHEN** an HTTP request schedules durable work and its API instance stops
- **THEN** the independent consumer can complete or retry the work without asking the user to wait

### Requirement: Shared authentication throttles fail predictably

OAuth exchange and refresh throttling MUST apply across API instances and MUST return a stable unavailable response when the configured shared limiter cannot operate.

#### Scenario: Requests reach different instances

- **WHEN** one source exceeds its authentication allowance across multiple instances
- **THEN** subsequent requests are throttled using the same shared quota
