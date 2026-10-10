## MODIFIED Requirements

### Requirement: Voice processing consent is saved by purpose and version

The system MUST allow authenticated users to view, accept, and withdraw voice processing consent for specific processing purposes and save the user, purpose, description version, provider category, server time, and current status. AI short voice and room safe voice processing MUST be used for different purposes; consent for one purpose does not authorize the other. Note that after a version change, the old consent MUST not authorize processing of the new version; withdrawal only prevents future processing and does not delete the minimum consent audit facts that still need to be retained. The system MUST return the currently valid description version when querying the consent status of each purpose, so that the client can display and submit a description version consistent with the server. The status response must not return the other user's consent facts or provider credentials.

#### Scenario: Accept current instructions

- **WHEN** The user clearly accepts the current AI short voice processing instructions
- **THEN** The system saves the currently valid consent and version facts that can be queried

#### Scenario: Accept the current room safety voice instructions

- **WHEN** The user clearly accepts the current room security voice processing instructions
- **THEN** The system only saves the current valid consent that can be queried for this purpose, and does not grant the AI short voice purpose at the same time.

#### Scenario: Withdrawing future consent

- **WHEN** User withdraws consent for AI short voice processing
- **THEN** Subsequent short voice request denied, both minimum consent and withdrawal facts remain auditable

#### Scenario: Withdrawing secure voice consent in an enabled room

- **WHEN** User withdraws room secure voice processing consent in a room with sensitive voice recognition enabled
- **THEN** Subsequent audio processing stops immediately and live access to the room is converged, both minimum consent and withdrawal facts remain auditable

#### Scenario: Description version update

- **WHEN** The processing description version requested by the server is higher than the version last accepted by the user
- **THEN** The system requires the user to explicitly agree again before allowing new voice processing for the corresponding purpose.

#### Scenario: First time using voice expression assistance

- **WHEN** The user has not accepted the current voice expression assistance instructions and read his or her consent status.
- **THEN** The response contains the `REQUIRED` status and the current description version. The client can submit this version after clearly displaying the purpose.
