# basic-safety-reporting Specification

## Purpose

Defines the first technical verification version of basic reporting, key event auditing and server-side permission protection, so that room host operations and member life cycles can be tracked and cannot be restricted by the client interface alone.

## Requirements

### Requirement: Submit a basic report

The system MUST allow current or historical room members who have passed existing identity authentication to report other members who have joined the same room, save the room, reporter, reported person, server submission time, category and text description, and return the submission results. Categories MUST be limited to harassment/abuse, discrimination/hate, sexually explicit/vulgar content, spam, and other. The description MUST contain 1–2000 Unicode code points after trimming leading and trailing whitespace. The reporter and submission time MUST be determined by the server, and client forgery is not accepted. Reports, unique safety cases, and initial assignments when available MUST be submitted in the same database transaction; unavailability of a safety officer MUST not cause reports to be lost. A successful response MUST maintain compatibility with existing report acceptance fields and return a case ID that can be used for follow-up tracking.

#### Scenario: A member submitted a valid report

- **WHEN** Room members select the target of the report, one of the five valid categories and submit a valid explanation
- **THEN** The system saves the report record and the unique `OPEN` security case, and returns the report ID, server submission time and case ID

#### Scenario: Historical members submitted reports

- **WHEN** The reporter has left or been removed, or the room has ended, but both the reporter and the person being reported have actually joined the room and the reporter still passes the current identity authentication
- **THEN** The system allows submission and will not reject it due to current membership status, room end, or both parties being offline.

#### Scenario: Room host as the reporting target

- **WHEN** A member submitted a valid report on the current or historical room host of the same room
- **THEN** The system saves according to the same rules as other members and does not require approval by the reported room host.

#### Scenario: Forged reporting identity or time

- **WHEN** The client additionally specifies the reporter or server submission time in the submission content.
- **THEN** The system rejects illegal fields and does not save reports or successful audit events.

#### Scenario: Invalid category or description

- **WHEN** The category is not within the five fixed categories, or the description is empty, contains only blanks, or exceeds 2000 Unicode code points
- **THEN** The system returns a stable verification error and does not save the report or successful audit event.

#### Scenario: No safety officer available at time of submission

- **WHEN** A user who has no account available and holds the role of safety officer when submitting a valid report
- **THEN** The system atomically saves reports and unallocated cases and returns success, and does not discard reports due to temporary unavailability of allocations.

#### Scenario: Case creation failed

- **WHEN** The report record can be written but the security case or necessary association cannot be submitted.
- **THEN** The entire acceptance transaction failed and the system does not leave accepted reports without cases.

#### Scenario: Safe retry of the same request

- **WHEN** The reporter retries a successful report using the same request ID and the same canonical content
- **THEN** The system returns the original report and original case identification and does not create duplicate reports, cases or initial assignments

### Requirement: Critical room event audit

The system MUST record reporting, member removal, member re-invitation, room host handover, room host disconnection and room end events, and retain necessary information such as event subject, operator, time, cause or result. A successful report submission MUST also generate an audit event that can be associated with the report; both the report record and the successful audit event MUST be saved or both failed, and only one party MUST succeed.

#### Scenario: Room host performs management actions

- **WHEN** Room host remove members, re-invite members, transfer permissions or end the room
- **THEN** The system generates traceable audit events

#### Scenario: Real-time connection status changes

- **WHEN** Real-time voice service notifies members to join, leave, abnormal disconnection or room end
- **THEN** The system associates the event with the corresponding room and member and updates the necessary status

#### Scenario: Report successfully audited

- **WHEN** The system successfully accepted a report
- **THEN** The audit event is associated with the report, room, reporter and reported person, and records the category, server submission time and submission success result

#### Scenario: Report or audit save failed

- **WHEN** Failed to save the report or any step corresponding to the audit event
- **THEN** The system does not return successful credentials, and there are no separately saved reports or successful audit events.

### Requirement: Server permission verification

The system MUST verify all room joining, room host management, invitation and end operations on the server side and MUST not rely solely on client hidden buttons or local state.

#### Scenario: Non-room host directly calls the room host management interface

- **WHEN** Ordinary members bypass the client and directly request to remove members, transfer room host or end the room
- **THEN** The system rejects the request and does not change the room status

### Requirement: Real-time voucher for limited rooms

The system MUST only issue short-term, real-time voice credentials limited to the target room and target identity to users who pass the verification.

#### Scenario: Legal join request

- **WHEN** User passes account, rule confirmation, password, capacity and room status verification
- **THEN** The system issues a short-term voucher that can only be used for this room.

#### Scenario: Reentry using old credentials

- **WHEN** A user who has been removed or whose room has ended attempts to reconnect using old credentials
- **THEN** The system refuses to restore the room membership

### Requirement: Reporting qualifications are verified by the server

The system MUST verify the valid identity of the reporter and the persistent fact that both parties have joined the same room, and MUST reject reports of self, submissions from people who have not joined the room, reports of cross-room subjects, and identities that were only invited but never joined. Ordinary members and room hosts MUST follow the same rules; room hosts, clients, and real-time online status cannot grant additional reporting qualifications.

#### Scenario: Unauthenticated or expired session

- **WHEN** The caller who did not provide valid identity authentication or whose session has expired directly requested to submit a report.
- **THEN** The system returns authentication failure and does not write a report or successful audit event.

#### Scenario: No valid room relationship

- **WHEN** The room does not exist, the reporter has never joined the room, or the person being reported has never joined the room
- **THEN** The system returns a consistent reporting context unavailable error, does not reveal other room membership relationships and does not save records.

#### Scenario: Report yourself

- **WHEN** A legitimate room member selects himself as the person to be reported
- **THEN** The system returns an invalid reporting object error and does not save the record.

#### Scenario: You cannot forge qualifications when offline

- **WHEN** The caller only holds a room link, invitation, or client-claimed online status, but no actual joining fact
- **THEN** The system rejected its reporting request

### Requirement: Report submission can be safely retried

The system MUST accept a caller-generated UUID request identifier for each commit and deduplicate it within the same reporter scope. Retries with the same identification and the same standardized content MUST return the original report identification and time, and only generate one report and one successful audit; when the same identification is bound to different rooms, objects, categories or descriptions, MUST return stable conflicts. Different whistleblowers using the same request identifier MUST be isolated from each other.

#### Scenario: Retry or concurrent submission after response loss

- **WHEN** The same reporter sends the same request ID and content concurrently or repeatedly
- **THEN** All successful responses point to the same report and time, and there is only one persistent record and one successful audit each.

#### Scenario: Reuse identifier to modify content

- **WHEN** The same reporter submitted different valid content using the existing request ID.
- **THEN** The system returns a conflict, does not modify the original report and does not generate a new successful audit.

#### Scenario: Different whistleblowers use the same identifier

- **WHEN** Two qualified whistleblowers submitted a report using the same request ID
- **THEN** The system saves each report separately and does not return the other party's record.

### Requirement: Reported content remains private and does not trigger penalties

The system MUST return only minimal submission credentials to the submitter and not disclose the report text and whistleblower information in ordinary responses, logs, room event broadcasts, or notifications. Audit MUST save the associated identification and necessary categories and results, and do not copy the report text, audio, or transcribe. Submitting a report MUST not change the room status, membership status, or account permissions, nor does it mean that a violation has been determined.

#### Scenario: Return the minimum submission result

- **WHEN** Report submitted successfully or retry successfully
- **THEN** The business response only contains the report identification, submission time and case identification for follow-up tracking, and does not return other reports, the private information of the person being reported or the text of the report.

#### Scenario: Report without notifying the person being reported

- **WHEN** Member submits report
- **THEN** The system does not broadcast the report content, report identity, or send report notification to the room host or the person being reported.

#### Scenario: Security log and failure response

- **WHEN** Report submission, verification failure or persistence failure is recorded
- **THEN** Logs and error responses do not contain report text, authentication credentials, SQL or other private information

#### Scenario: Failure to implement punishment for reporting

- **WHEN** One or more reports were accepted
- **THEN** Room status, room host ownership, membership and account permissions remain unaffected by report submission actions
