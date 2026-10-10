## MODIFIED Requirements

### Requirement: Submit a basic report

The system MUST allow room members to submit basic report records containing room, reporter, reportee, time, category and text description. Reports, unique safety cases, and initial assignments when available MUST be submitted in the same database transaction; unavailability of a safety officer MUST not cause reports to be lost. A successful response MUST maintain compatibility with existing report acceptance fields and return a case ID that can be used for follow-up tracking.

#### Scenario: A member submitted a valid report

- **WHEN** Room members select the reporting object, category and submit instructions
- **THEN** The system saves the report record and the unique `OPEN` security case, and returns the report and case submission results

#### Scenario: No safety officer available at time of submission

- **WHEN** A user who has no account available and holds the role of safety officer when submitting a valid report
- **THEN** The system atomically saves reports and unallocated cases and returns success, and does not discard reports due to temporary unavailability of allocations.

#### Scenario: Case creation failed

- **WHEN** The report record can be written but the security case or necessary association cannot be submitted.
- **THEN** The entire acceptance transaction failed and the system does not leave accepted reports without cases.

#### Scenario: Safe retry of the same request

- **WHEN** The reporter retries a successful report using the same request ID and the same canonical content
- **THEN** The system returns the original report and original case identification and does not create duplicate reports, cases or initial assignments
