# user-safety-restrictions Specification

## Purpose

Define fixed levels of account security restrictions, cross-entry execution, expiration recovery, and permanent ban boundaries so that the penalty duration is determined by persistent facts and will not be incorrectly extended due to background task failure.

## Requirements

### Requirement: Temporary restriction level determines fixed duration

The system MUST only allow the safety officer to create a `GENERAL`, `SERIOUS`, or `HIGH_RISK` temporary restraint when closing a case, and set the end time to 3, 12, or 24 hours after the server start time, respectively. Each case can generate at most one final disposition; each restriction MUST retain the case, target user, level, reason, decision maker, start time, and end time.

#### Scenario: Create general restrictions

- **WHEN** The current case handler resolves the ongoing case with a general level and valid reasons
- **THEN** The system creates a limit lasting 3 hours from the server start time and sets the case to `RESOLVED`

#### Scenario: Create critical or high risk restriction

- **WHEN** The current case handler is solving an ongoing case with a serious or high risk level
- **THEN** The system creates limits lasting 12 hours or 24 hours respectively, and the client cannot specify or modify the duration.

#### Scenario: Try to punish the final case again

- **WHEN** The caller attempted to create another disposition for a closed case using a new request ID.
- **THEN** The system returns a stable conflict and does not create a second case disposition

### Requirement: Temporary active restrictions are in effect on all existing room entrances

The system MUST check for currently valid temporary restrictions when a user creates an instant or reserved room, joins a room, obtains or refreshes a live voice credential, and reserves a room. As long as the user has at least one `startsAt <= now < endsAt` restriction that has not been lifted in advance, the system MUST reject these operations and return a minimized restriction summary, including the latest end time of the currently valid restrictions; login, read personal restrictions, and submission of appeals MUST remain available.

#### Scenario: Restricted users create or reserve rooms

- **WHEN** A user with active temporary restrictions requested to create an instant room, create a reserved room, or reserve a room
- **THEN** The system rejects the request and does not create a room or reservation record, and returns the limit end time that can be displayed by the client.

#### Scenario: Restricted users to join or obtain real-time credentials

- **WHEN** A user with active temporary restrictions requests to join a room or obtain or refresh the real-time voice credentials of the target room
- **THEN** The system rejects the request and does not create a new membership or issue a new credential.

#### Scenario: Necessary abilities for restricted users to use accounts

- **WHEN** Users with active temporary restrictions log in, refresh normal sessions, read personal restrictions, or submit appeals that meet the window
- **THEN** The system does not deny the request due to the temporary restriction itself

### Requirement: Multiple restrictions are retained independently and access is jointly determined

The system MUST retain temporary restraints from different cases independently and MUST not shorten or lose any disposition facts by overwriting old records. As long as at least one restriction is still valid, the account will remain restricted; early lifting or expiration of one restriction will not lift other restrictions that are still valid.

#### Scenario: Second case produces overlapping restrictions

- **WHEN** User already has active temporary restrictions and another case creates a new temporary restriction
- **THEN** The system retains two respective start, end and case sources, and uses the latest end time among the still valid restrictions as the current restricted deadline

#### Scenario: An overlapping restriction is lifted early

- **WHEN** safety officer lifted one of the restrictions early but the other one is still in effect
- **THEN** The user continues to be restricted, and the current restriction response reflects the remaining effective dispositions.

### Requirement: Expiration judgment does not rely on on-time execution of recovery tasks

The system MUST use the persistent `endsAt` and the current time of the server to determine whether the temporary restriction is valid. When `now >= endsAt`, the request path MUST immediately treat the limit as expired; the retryable recovery process MUST eventually record the expiration convergence result, but queue, cache, or task delays MUST not extend the limit.

#### Scenario: The recovery task has not been run but the limit has expired

- **WHEN** The current time has reached the limit end time and the recovery task is still delayed.
- **THEN** The user can perform restricted room operations again, and the system must not continue to deny them based on this restriction.

#### Scenario: Duplicate processing of due tasks

- **WHEN** Expired tasks or database recovery scans with the same limit are executed repeatedly
- **THEN** The system obtains the same expiry status and does not create duplicate disposal records or duplicate successful audits.

#### Scenario: Redis or queue unavailable

- **WHEN** The coordination facility is unavailable when the limit expires
- **THEN** Request paths still make correct decisions based on PostgreSQL end time and can converge to persistent state after facility recovery

### Requirement: Safety officer can lift temporary restrictions in advance

The system MUST only allow the current safety officer to early lift temporary restrictions that have not yet ended with valid reasons. Lifting MUST save the decision maker, server time and reason and immediately affect subsequent access; expired or lifted restrictions MUST not be changed repeatedly.

#### Scenario: safety officer released early

- **WHEN** The current safety officer has lifted a temporary restriction that is still in effect with valid reasons.
- **THEN** The system saves the fact of cancellation, and the user's subsequent access is only subject to other restrictions that are still in effect.

#### Scenario: Unrestricted when only administrator role

- **WHEN** Users who only hold the platform administrator role directly request to lift temporary restrictions
- **THEN** The system denied the operation and the restriction remains in effect

#### Scenario: Concurrently lift the same restriction

- **WHEN** Multiple safety officers concurrently request to lift the same restriction
- **THEN** The system only submits one release result, and the remaining requests obtain stable existing status or conflict results.

### Requirement: Serious risk cases can permanently ban the account

The system MUST only allow the current case handler to permanently disable the target account after clearly confirming the facts and submitting valid reasons in the `SERIOUS` or `HIGH_RISK` case. This decision MUST be atomically saved for permanent security, set the user account to `DISABLED`, close the case, and record a successful audit; this capability MUST not provide a permanently disabled appeal or recovery interface.

#### Scenario: High-risk cases permanently banned

- **WHEN** The current handler clearly confirmed the facts of the high-risk case being handled and chose to permanently ban it.
- **THEN** The system saves the permanent disposition and disables the account. Subsequent ordinary conversations and new real-time voice voucher requests are rejected according to the disabled account rules.

#### Scenario: General case attempts to permanently disable

- **WHEN** safety officer attempted to permanently ban user from general level case
- **THEN** The system returns a stable verification error, and neither the case nor the user account status changes.

#### Scenario: Permanently disabled without confirming the fact

- **WHEN** safety officer submitted permanent ban decision without clearly confirming the facts of the case
- **THEN** The system rejects the decision and does not create a permanent disposition

### Requirement: All limit changes use stable idempotent command

The system MUST require that the creation of disposition and early dismissal commands carry a caller-generated UUID request identifier. The same operator retries the same normalized content with the same ID and MUST return the original result; the same ID corresponding to different content MUST return a stable conflict, and concurrent requests MUST not produce repeated processing or release facts.

#### Scenario: Retry temporary restriction decision

- **WHEN** safety officer retries successful temporary restriction decision with same request ID and same canonical content
- **THEN** The system returns to the original limit and original case final state without recalculating the start or end time.

#### Scenario: Reason for modifying the reuse release request identifier

- **WHEN** safety officer submits different reasons or target restrictions with existing release request ID
- **THEN** The system returns to stable conflict and retains the original resolution result.
