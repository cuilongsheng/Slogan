## Purpose

Define the controlled creation of five independent experience accounts, complete mobile data, real background permissions and normal room roles, ensuring that repeated executions and failed recovery do not cover existing users or leak secrets, and provide cleanup boundaries that follow the last administrator, account deletion and audit rules.

## ADDED Requirements

### Requirement: Five independent accounts initialized through a controlled environment

The system MUST provide a controlled initialization entrance limited to the designated experience environment, and establish five independent identities: backend administrator, safety officer, and mobile A/B/C; each identity MUST have a unique user name, independent password hashing and controlled source mapping that conforms to existing policies. The entry MUST require explicit targets and matching environment identifiers, does not provide a public network initialization interface or default target database, and does not create rooms, room members, pre-release sessions or fixed global HOST roles.

#### Scenario: Initialize five identities

- **WHEN** Operator explicitly specifies allowed experience goals, five conflict-free identities, and compliant secret inputs
- **THEN** Accounts, information and mapping atoms are established as five independent ACTIVE identities, no emails, pre-issued tokens or persistent rooms; the output only gives the non-secret status

#### Scenario: Wrong target or illegal input

- **WHEN** No target specified, environment mismatch, secret/username non-compliance, slot duplication or identity occupied by unknown user
- **THEN** Reject initialization without changing the target account, credentials, profile or role, and do not echo sensitive input

### Requirement: Initialization retry does not overwrite or revive the identity

The system MUST identify retries based on the environment and the persistent mapping of five slots. Successful retries only check the registered identity and final status, and do not replace passwords, reset versions, overwrite user information, duplicate roles, or audit. Concurrent creation MUST not generate duplicate identities; retirement, account deletion, disabled or unknown role conflicts MUST be explicitly denied and permissions will not be automatically restored.

#### Scenario: Execute again after success

- **WHEN** The same environment and slot mapping are initialized again and the current identity/role meets the final state
- **THEN** Returns the same five identity verification results, does not repeatedly create or modify passwords, information, roles and successful audits

#### Scenario: Concurrency and Interrupts

- **WHEN** Concurrent execution of initialization in the same batch or recovery after execution interruption
- **THEN** The data stage can form a complete set of five identities at most; completed stages can be verified, unfinished role stages are clearly presented, and partial completions are not reported as overall success.

#### Scenario: The user was later deleted or revoked

- **WHEN** The registered account is retired, canceled, disabled, or its administrative role is subsequently legally revoked
- **THEN** Rerun initialization refuses to automatically resurrect the account or restore the character, and reports a stable conflict

### Requirement: Backend experience permissions are mapped to real roles

When initialization is completed, the backend administrator MUST only holds `PLATFORM_ADMIN`, the safety officer MUST only holds `SAFETY_OFFICER`, and the three mobile accounts MUST have no backend roles. Background authorization MUST be completed through the existing controlled bootstrap and audit role commands of authenticated administrators, retaining the reason, request identification, current permission review, idempotent and final administrator protection, without directly writing the role table or forging actors.

#### Scenario: The first administrator and independent safety officer

- **WHEN** The new target does not have an existing administrator, the operator completes bootstrap and completes role grant/revocation with a real administrator session
- **THEN** The final administrator and safety officer only hold the above-mentioned roles respectively. The three mobile accounts have no administrative roles. The audit can correspond to the real operators and system bootstrap at each step.

#### Scenario: There is no implicit super permission

- **WHEN** Only platform administrators perform safety officer exclusive actions, or only safety officer management roles/query full audits
- **THEN** The server refused according to the current permission matrix, and the permissions cannot be expanded because the account is used for experience.

#### Scenario: Normal account and old character token

- **WHEN** The mobile account directly calls the backend interface, or the backend user whose role has been revoked uses the old token to access the original permission interface.
- **THEN** The server rejects the latest persistent permissions and does not return admin data.

#### Scenario: An unknown administrator or role stage recovery already exists

- **WHEN** The initialization target already has an unknown administrator, or the batch of the final single-role administrator is restored again.
- **THEN** The former denies unauthorized takeover by default; explicit existing-admin mode retains its permissions and requires real administrator session authorization, or handles it as an otherwise explicitly approved native development cleanup exception; the latter checks the existing stage without re-bootstrap or re-grant dual roles

### Requirement: Three mobile accounts meet the qualifications of normal adult information

Mobile A/B/C MUST have individually identifiable, legal, and complete fictional experience profiles: valid avatar, nickname, gender, country or city, legitimate interests, CEFR, adult birth date, and profile completion facts. The system MUST be verified by the current profile rules and return ELIGIBLE; only having the correct password cannot bypass profile or adult restrictions.

#### Scenario: Three mobile users logged in

- **WHEN** After the initialization is completed, the three mobile accounts can log in normally and query their own information.
- **THEN** Return their complete information and ELIGIBLE, and you can enter the room list according to the normal process.

#### Scenario: Illegal or underage material

- **WHEN** Enter experience data that is missing required fields, illegal values, or does not meet adult qualifications
- **THEN** Initialization rejected, cannot bypass age and profile restrictions by setting completion time or experience tags

### Requirement: Room host is generated by normal house construction

The three mobile accounts MUST maintain ordinary user capabilities; in the first round of mobile A, a room with a capacity of at least three people can be created normally and become the current room host, and B/C can join normally. The system MUST maintain room rule acceptance, capacity, qualifications, penalties and voice authorization boundaries, and do not persist the room host role on the account; after the end, other mobile accounts can create new rooms normally and become their room hosts.

#### Scenario: One person builds a house and two people join in

- **WHEN** A builds the house normally, B/C joins according to the rules in an independent session
- **THEN** The same room presents three independent members and the correct room host. The permissions and voice token are from the normal room process.

#### Scenario: Exchange house builders

- **WHEN** After the end of this round, B or C creates a new room normally
- **THEN** The new creator becomes the new room room host, and A will not continue to obtain the room host permission due to his experience slot.

### Requirement: Secret input and output and account cleaning are controlled

Systems MUST read passwords from interactive secret input or deployment secret injection and not write clear text passwords, hashes, tokens, full email addresses, real database connections, or provider secrets to Git, command parameters, normal logs, or initialization reports. General cleanup MUST only apply to registered experience identities; the original native development library reconstruction exception explicitly authorized by the user MAY delete the account the unregistered old development identity, retain the original audit/only occupation and last administrator protection, revoke the session and destroy the password through normal account deletion, and do not run the full table test cleanup.

#### Scenario: Capture initialization input and output

- **WHEN** Perform dry-run, initialization, retry, error or cleanup and capture command parameters, logs and reports
- **THEN** No secrets leaked, reports can verify non-secret slots, stages and results, dry-run does not change the database

#### Scenario: delete the account of normal experience account

- **WHEN** The registered mobile account has ended/exited the room and completed normal re-authentication and clear account deletion.
- **THEN** Password hashing is destroyed, session is revoked, mapping is retired, identity occupation and audit are retained, and re-run initialization cannot revive it.

#### Scenario: Background administrator cleanup

- **WHEN** The cleanup will remove the last valid administrator but there is no legal account.
- **THEN** Block this step and report that transfer is required first; normal account deletion is allowed after completing legal transfer and role revocation, without bypassing protection or deletion auditing

#### Scenario: The user approved this native development library to retain only five available identities.

- **WHEN** Explicit user approval of old development identity cleanup, controlled CLI verification of pinned native development target, explicit local-rebuild mode, and safe recovery of backups
- **THEN** The old development role can be revoked and the unregistered old identity can be deleted according to the normal life cycle, the audit/foreign key history is retained, and then a final matrix of five accounts is established through the original bootstrap session with the real administrator; remote/production/other libraries/missing backups are rejected, and the public permission interface does not obtain this exception.
