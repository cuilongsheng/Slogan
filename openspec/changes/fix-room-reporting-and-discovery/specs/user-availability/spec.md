## ADDED Requirements

### Requirement: Foreground discovery renews the querying user's online signal

An eligible authenticated available-people request MUST renew only the caller's short-term online signal before reading candidates. It MUST not renew candidate users, bypass occupancy/restriction/blocking rules or expose precise online timestamps. Coordination failure MUST be reported as unavailable rather than a successful empty result.

#### Scenario: Active trial accounts visit discovery

- **WHEN** two independently authenticated eligible users query available people while idle
- **THEN** each request renews its own online signal and the other user's valid signal may appear in subsequent lists even if an earlier standalone heartbeat failed
