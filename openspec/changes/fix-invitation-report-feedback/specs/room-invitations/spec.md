## ADDED Requirements

### Requirement: Foreground invitees receive actionable room invitations

Eligible signed-in users on the main pages MUST see new pending room invitations in an in-app dialog without opening a separate social page or refreshing manually. Joining MUST explicitly use the invitation and existing room admission, preserving password, capacity, account, safety and removed-member rules. Declining MUST persist the existing decline command. A dismissed invitation MUST remain accessible without repeatedly interrupting the same account session. Invitations MUST not automatically move a user out of an active room or direct call.

#### Scenario: Receive and join from a main page
- **WHEN** a host invites an idle foreground user
- **THEN** that user sees the inviter and room topic and can directly enter the ordinary admission flow by pressing Join

#### Scenario: Decline or temporarily dismiss
- **WHEN** the invitee declines or dismisses the dialog
- **THEN** decline removes the pending invitation after server confirmation, while dismissal retains an accessible pending invitation without repeatedly opening its dialog

#### Scenario: Expired or blocked invitation
- **WHEN** a displayed invitation becomes unavailable or room admission fails
- **THEN** the app does not show a successful join and preserves a useful error or authoritative unavailable state

### Requirement: The host sees authoritative pending invitation state

The current host MUST be able to read minimal pending invitations for its room. The picker MUST show a disabled Invitation sent action for those targets, including after closing/reopening or reentering the room. In-flight and confirmed sends MUST prevent repeated commands. Declined, consumed or cancelled invitations MUST no longer be represented as pending. This query MUST reject other users and former hosts without disclosing invitation targets.

#### Scenario: Reopen the invitation picker
- **WHEN** the current host reopens a picker after sending an invitation
- **THEN** the pending target remains marked Invitation sent and cannot be invited again while pending

#### Scenario: Unauthorized pending-state query
- **WHEN** an ordinary member or former host requests pending invitations for a room
- **THEN** the request is rejected without invitation records
