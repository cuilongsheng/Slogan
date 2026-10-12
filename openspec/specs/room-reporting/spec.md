# room-reporting Specification

## Purpose

Allow actual room participants to report a room itself and let authorized safety staff review a room case without creating an accusation against an unrelated participant.

## Requirements

### Requirement: Room reports identify the room rather than an accused member

The system MUST accept a room report from an authenticated user with actual retained joined membership. A room report MUST contain its room, reporter, category, bounded description and idempotency identifier, without an accused user. Equivalent retries MUST return the same receipt; changed content under the same identifier MUST conflict. Unknown rooms and users without actual membership MUST be rejected.

#### Scenario: Host reports their own room

- **WHEN** an actual room host submits a valid room report
- **THEN** a room case is created without treating the host as an accused member or rejecting it as a self-report

#### Scenario: Duplicate room submission

- **WHEN** a participant repeats equivalent normalized room-report content with the same identifier
- **THEN** the original receipt is returned, while changed content or a changed member target conflicts

### Requirement: Room cases have scoped evidence and cannot sanction an unspecified user

Authorized backoffice viewers MUST see that a case targets a room. Room cases MUST retain existing case assignment, review, dismissal and non-punitive resolution behavior. Evidence MUST stay scoped to the reported room, and personal restrictions or account disabling MUST be rejected when the case has no accused user.

#### Scenario: Personal sanction on a room case

- **WHEN** an officer attempts a user restriction or account disable for a room case
- **THEN** the request is rejected without creating a restriction, choosing a participant or changing an account

### Requirement: Room overflow has the requested actions

The room overflow menu MUST contain Report room, Leave room and Share room link. Reporting MUST open a room report form; leaving MUST retain host handoff only when required; sharing MUST retain the existing external link behavior.

#### Scenario: Report from overflow

- **WHEN** a participant selects Report room from the three-dot menu
- **THEN** the room report form opens directly with no member selection
