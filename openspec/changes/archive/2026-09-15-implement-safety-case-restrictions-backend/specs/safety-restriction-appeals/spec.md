## Purpose

Define user-visible information for temporary account restrictions, an appeal window and safety officer processing results, allowing users to state reasons within a fixed time while keeping penalties and audit facts traceable.

## ADDED Requirements

### Requirement: Users can view their own minimum restricted information

The system MUST allow authenticated users to view their temporary restriction history and current restrictions in effect. Each result MUST only contain restriction identification, level, user-visible reason, start time, end time, status, appeal deadline, and appeal status, and MUST not expose the whistleblower, backend processor, or internal evidence.

#### Scenario: Restricted users view current restrictions

- **WHEN** An authenticated user requests his or her restricted information
- **THEN** The system returns a historical summary of the current effective restrictions and stable paging, and indicates whether each item can still be appealed

#### Scenario: User restrictions on viewing others

- **WHEN** The user attempts to view other users' restrictions by modifying the path or parameters.
- **THEN** The system rejects the request and does not return whether the target user is restricted.

### Requirement: Only one time-limited appeal can be accepted for each temporary restriction.

The system MUST allow the restricted user to submit an appeal for this temporary restriction within 30 minutes from the restriction start time. Appeals MUST contain a caller-generated UUID request identifier and a non-null canonical reason; no new appeals may be accepted for permanently disabled, lifted restrictions, expired restrictions, or restrictions that have exceeded their deadline.

#### Scenario: Submit your first appeal within the window

- **WHEN** The restricted user submitted the first valid appeal of the restriction on or before `appealDeadlineAt`
- **THEN** The system saves a `PENDING` appeal and returns the stable appeal identification and submission time

#### Scenario: Submit appeal beyond the window

- **WHEN** The restricted user submitted his first appeal after `appealDeadlineAt`
- **THEN** The system returns a stable window closed result and does not create an appeal

#### Scenario: Appeal again for the same restriction

- **WHEN** This limit has been appealed and the user resubmits it using a new request ID.
- **THEN** The system returns a stable conflict and retains the original appeal

#### Scenario: Submit appeal against permanent ban

- **WHEN** The user attempts to appeal the permanent ban through the temporary restriction appeal interface
- **THEN** The system rejects the request and does not create an appeal

### Requirement: Appeal submission has stable idempotent and concurrent results

The system MUST return the original appeal result for the same user, the same request ID, and the same normalized content; the reuse request ID changes restrictions or reasons and MUST return a stable conflict. Concurrent first appeals MUST create at most one appeal.

#### Scenario: Retry the same appeal

- **WHEN** User retries a successfully submitted appeal using the same request ID and the same canonical reason
- **THEN** The system returns the original appeal without changing the submission time or creating duplicate records.

#### Scenario: First appeal submitted concurrently

- **WHEN** User concurrently submits multiple appeals with different request IDs for the same restriction
- **THEN** The system only accepts one request, and the remaining requests return stable conflicts.

### Requirement: safety officer manually handles pending appeals

The system MUST only allow the current safety officer to view and handle the `PENDING` appeal. safety officer MUST select `UPHELD` or `LIFTED` with valid reasons; retain the original restriction end time when maintaining, and immediately create an early release fact when lifting. The processing result MUST record the processor and server time, and the system MUST not promise an unconfirmed response time limit.

#### Scenario: safety officer maintains restrictions

- **WHEN** The current safety officer has decided to maintain the pending appeal with valid reasons.
- **THEN** The system sets the appeal to `UPHELD` and the limit end time remains unchanged

#### Scenario: safety officer passed the appeal and lifted the restriction

- **WHEN** The current safety officer has decided to cancel the pending appeal with valid reasons.
- **THEN** The system atom sets the appeal to `LIFTED` and saves the fact of early release. Subsequent access is only subject to other effective restrictions.

#### Scenario: Non-safety officer handles appeals

- **WHEN** Ordinary users, auditors, operations analysts, or users with only platform administrator roles directly request to handle appeals
- **THEN** The system returns a stable permission denial and appeals and restrictions remain unchanged.

#### Scenario: Concurrent processing of the same appeal

- **WHEN** Multiple safety officers submitted different appeal decisions concurrently
- **THEN** The system only submits one final result, and the remaining requests return stable conflicts consistent with the existing decision.

### Requirement: Appeal handling command remains idempotent

The system MUST require the appeal handling command to carry the UUID request identifier generated by the caller. Same safety officer Retrying the same decision with the same ID MUST return the original result; reuse request ID changes the appeal, result, or reason MUST return a stable conflict.

#### Scenario: Retry a passed appeal

- **WHEN** safety officer retries successful release decision with same request ID and same normalized content
- **THEN** The system returns the original appeal and cancellation results, without creating a second cancellation fact or changing the original time.
