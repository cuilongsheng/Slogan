## MODIFIED Requirements

### Requirement: Wheat position sequence

The system MUST display the current wheat position in the order in which members successfully enter the room this time; after a member leaves, the remaining members move forward in the original order. When ordinary members re-enter after leaving, they MUST be ranked behind all online members at that time.

#### Scenario: Second Mai leaves

- **WHEN** Currently, the second Mai has left and there will still be online members in the future.
- **THEN** Subsequent members are moved forward according to the original order and the default succession order is updated.

#### Scenario: Ordinary members re-enter after leaving

- **WHEN** Ordinary members successfully enter the same room that is still open after leaving on their own initiative.
- **THEN** The system will queue the member to the end of the current wheat position and will not restore the wheat position before leaving.
