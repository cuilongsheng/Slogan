# safety-case-management Specification

## Purpose

Define the closed loop of case creation, assignment, query, evidence and processing after the report enters the backend, so that every safety decision is based on viewable and durable facts and manually confirmed by the safety officer who still has authority.

## Requirements

### Requirement: Each accepted report forms a unique security case

The system MUST create one and only one security case for each successfully accepted report. The case MUST have a stable identifier, source report, reported user, room, creation time, current status, and optionally the current safety officer, with `OPEN` as the initial processing status.

#### Scenario: Query the case after the report is accepted

- **WHEN** A valid report was successfully accepted for the first time
- **THEN** The system can query the unique `OPEN` case through the returned case ID, and the case points to the report, room and reported user

#### Scenario: The same report request is safely retried

- **WHEN** The reporter retries a successful report using the same request ID and the same canonical content
- **THEN** The system returns the original report and original case identification, and does not create a second report or second case.

### Requirement: New cases are automatically assigned and can be restored to unassigned status

The system MUST give priority to allocating new cases to the safety officer who currently holds `SAFETY_OFFICER` and has an available account with the smallest number of open cases, and uses the deterministic rule of sustainable rotation when the load is the same. When a safety officer is not available, the system MUST retain unassigned cases that can be queried and reassigned through a retryable recovery process when a safety officer becomes available.

#### Scenario: assigned to the safety officer with the lowest load

- **WHEN** There are multiple safety officers available when a new case is created and one of them has the smallest number of open cases.
- **THEN** The system assigns the case to the safety officer and saves the traceable assignment time

#### Scenario: The same load continues to rotate

- **WHEN** Multiple available safety officers have the same number of open cases and multiple cases are created consecutively
- **THEN** The system allocates in a deterministic rotation order and does not permanently assign parallel cases to the same person.

#### Scenario: No safety officer available yet

- **WHEN** Users who have no account available and hold the role of safety officer when accepting reports
- **THEN** The system still successfully saves the report and `OPEN` case, marking the case as unassigned and not forging a handler

#### Scenario: Assigned safety officer disqualified

- **WHEN** The current handler of the open case has lost the safety officer role or the account has become unavailable.
- **THEN** The recovery process clears invalid assignments and hands the case to the currently available safety officer, and repeated execution will not produce multiple current handlers.

### Requirement: Case inquiry follows background separation of responsibilities

The system MUST allow the current platform administrator to view all cases, and allow the current safety officer to view cases assigned to itself and unassigned cases. When the platform administrator does not have the role of safety officer, MUST NOT advance the case or perform safety disposal; safety officer MUST NOT obtain role management or full administrative audit permissions due to case permissions.

#### Scenario: Administrator views all cases

- **WHEN** The current platform administrator queries cases in pages and submits valid status, time or filtered by reported users.
- **THEN** The system returns a stable sorted minimal case summary and a next page cursor

#### Scenario: safety officer View work queue

- **WHEN** The current safety officer queries his own case queue
- **THEN** The system only returns cases assigned to the person and those that are currently unassigned, and does not return cases assigned to other safety officers.

#### Scenario: Attempt to handle case when only administrator role

- **WHEN** Users who only hold the role of platform administrator directly request to start, close, reject or punish
- **THEN** The system returns a stable permission denial and the case and user status remain unchanged

### Requirement: safety officer explicitly receives and advances case status

The system MUST only allow currently available safety officers to pick up unassigned cases, start processing the cases they are responsible for, and advance the cases from `OPEN` to `UNDER_REVIEW`. The case can only enter the final state with `RESOLVED` or `DISMISSED`. The final state case cannot be started again or a second final decision can be made.

#### Scenario: safety officer receives unassigned cases

- **WHEN** The current safety officer picks up an unassigned `OPEN` case
- **THEN** The system atomically sets the current handler and returns the case consistent with the persistent state

#### Scenario: Two safety officers collected at the same time

- **WHEN** Two safety officers received the same unassigned case concurrently
- **THEN** The system only accepts one current handler, another request returns a stable conflict and must not overwrite the winning result

#### Scenario: Start the case I am responsible for

- **WHEN** The current handler started a `OPEN` case
- **THEN** The system updates the status to `UNDER_REVIEW` and records the server processing start time

#### Scenario: Operate cases responsible for other safety officers

- **WHEN** safety officer attempted to advance a case currently assigned to another active safety officer
- **THEN** The system returns a stable conflict or permission denial and the case status remains unchanged.

### Requirement: Case evidence package combines only permissible enduring facts

The system MUST provide an evidence package associated with a single case that contains report information, room membership and timeline facts available before and after the report occurred, room host management events, related reports, summary of past cases and restrictions, related minimum room risk events, security capability degradation events, and case handling records. Evidence packages MUST identify signals that are missing, downgraded, or do not yet exist, risk events MUST not be interpreted as confirmed violations, facts MUST not be generated, original audio, original audio, hits, or full transcripts MUST not be saved or returned, and authentication credentials or non-essential personal data MUST not be returned.

#### Scenario: View evidence package with complete existing facts

- **WHEN** The authorized administrator or case handler can view the case evidence package
- **THEN** The system returns allowed facts that can be correlated to source and time of occurrence, including reporting minimal risk and degrading events within the relevant time window, and organizes the results in a stable order

#### Scenario: Some evidence does not exist

- **WHEN** The case has no room host management events, past restrictions, risk events or other related signals
- **THEN** The system clearly returns that the corresponding set is empty or the signal is unavailable. It does not falsify risk conclusions and still allows manual processing of the case.

#### Scenario: Security capabilities were downgraded when reporting

- **WHEN** Report the degradation of voice security capability in the room within the associated time window
- **THEN** The evidence package identifies the affected components and time range, does not redact risk signals during this period, and does not claim that the content has been inspected.

#### Scenario: Non-case handler reads evidence

- **WHEN** A user who only holds the safety officer role but the case is assigned to another valid safety officer requests an evidence package
- **THEN** The system denies access and does not return reporting instructions, member information or risk events

### Requirement: Case conclusions must be submitted manually by the safety officer

The system MUST allow the current handler to submit a final conclusion only once for case `UNDER_REVIEW`. Dismissal MUST record reasons and does not create restrictions; case close MUST explicitly select no penalty, temporary restrictions, or qualified permanent ban, and submits the case conclusion, disposition facts, and successful audit as an atomic result. Any single report, keyword, or automated risk signal MUST not advance the case or impose penalties on its own.

#### Scenario: Case dismissed

- **WHEN** The current handler dismissed the case being handled with valid reasons
- **THEN** The system sets the case to `DISMISSED`, saves the processing record, and does not create account restrictions.

#### Scenario: Case closed but no penalty

- **WHEN** The current handler confirms that the case has been handled and chooses a no-punishment conclusion.
- **THEN** The system sets the case to `RESOLVED`, saves the reason, and keeps the user account in its original state.

#### Scenario: Automatic signal arrival

- **WHEN** The system receives a single report, a change in the number of related reports, or a keyword risk event that will be accessed in the future.
- **THEN** The system only provides signals for manual review and does not automatically change case final status, restrictions or user account status.

### Requirement: Case modification command has stable idempotent and concurrent results

The system MUST require that pick, start processing, close, and reject commands carry the UUID request identifier generated by the caller and the normalized reason or decision content. The same operator uses the same request ID to retry the same content and MUST return the original result; reusing the request ID to submit different content MUST return a stable conflict.

#### Scenario: Retry completed close command

- **WHEN** The same safety officer decided to retry a successful close command using the same request ID and the same normalization
- **THEN** The system returns the original case, disposition and audit related results without creating a second final decision or a second penalty

#### Scenario: Concurrent submission of different final decisions

- **WHEN** Multiple requests concurrently attempting to dismiss or close the same case
- **THEN** The system only submits one final state decision, and the remaining requests return stable conflicts consistent with the existing final state.
