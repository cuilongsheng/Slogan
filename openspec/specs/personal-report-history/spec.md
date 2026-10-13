# personal-report-history Specification

## Purpose

Give reporters a durable, privacy-scoped record of their own submitted complaints and their actual processing progress without exposing internal moderation data.

## Requirements

### Requirement: Reporters can retrieve only their own report history

Authenticated users MUST receive bounded cursor-paginated history of only reports they submitted, including room, member and direct-message reports. Entries MUST include the receipt/case identifier, category, submission time, minimal context and current case progress. The response MUST exclude internal evidence, private message content, review notes, assignee identities and sanction details. Requests MUST not accept a different reporter identity.

#### Scenario: Ownership isolation and pagination
- **WHEN** a reporter lists its history across pages
- **THEN** only its own records are returned in stable newest-first order without duplicates, including its direct-message reports

#### Scenario: Missing authentication
- **WHEN** an unauthenticated caller requests personal report history
- **THEN** the request is rejected without any report data

### Requirement: Visible progress comes from the actual moderation case

The personal history MUST distinguish received, under review, resolved and dismissed states using the corresponding server case status. Final states MUST include their actual decision time when available. Opening or refreshing the history MUST show current server progress; failed refresh MUST preserve already loaded records with retry feedback.

#### Scenario: Review changes after submission
- **WHEN** authorized moderation changes the case from received to under review or a final state
- **THEN** the reporter sees that state after foreground refresh without resubmitting the complaint

### Requirement: Report submission has a durable and discoverable confirmation

Successful room, member and direct-message report submission MUST show a clear received confirmation, case identifier and a path to My reports. Failed submission MUST preserve the draft and stable retry identifier and MUST not claim success. Closing a receipt MUST not remove the server history.

#### Scenario: Close and later find a complaint
- **WHEN** the reporter closes a successful submission confirmation and opens My reports
- **THEN** the same receipt and actual case progress remain available
