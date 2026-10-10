## MODIFIED Requirements

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
