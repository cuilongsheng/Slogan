# admin-workspace Specification

## Purpose

Provides users with administrative roles with a management workbench that abides by server-side permissions, covering real data query, statistics and high-privilege operation confirmation of rooms, security cases, restriction appeals, downgrade events, administrative roles and operation audits.

## Requirements

### Requirement: Background browser sessions and real-time permission boundaries

The admin app MUST use the existing browser authentication interface to establish and restore sessions, and use `/v1/backoffice/me` to determine the current administrative role. access token MUST only be stored in running memory. Backend data MUST not be displayed when there is no backend role or the session is invalid, and the same is true for direct access to protected routes.

#### Scenario: Restore background session after refresh

- **WHEN** The logged in admin user refreshes the page and the HttpOnly refresh cookie is still valid
- **THEN** The admin app restores the access token, re-reads the current role and opens the page it has access to.

#### Scenario: Ordinary account access backend

- **WHEN** A valid ordinary account has no administrative role and opens any admin route
- **THEN** The admin app displays a no permission status, and the server does not return admin data

### Requirement: Six admin pages use real data

The admin app MUST display rooms, safety cases, restriction appeals, safety degradation events, administrative roles, and operation audits based on the approved 1440×900 Figma designs, querying their APIs through the generated client. Lists MUST handle loading, empty states, errors, permission denial, and server-side cursor pagination. Only contract-supported filters may be presented as complete filtering.

#### Scenario: Browse list of authorized users

- **WHEN** The current role has corresponding permissions and the list API returns data and next page cursor
- **THEN** The page displays server data, supports entering the next page and returning to the previous page

#### Scenario: Interface rejected or failed

- **WHEN** List request returns 403 or recoverable error
- **THEN** The page displays permission denial or retry errors respectively, and does not display design draft sample records.

### Requirement: Explicit confirmation of background high-privilege command

Case, appeal, and role mutations may execute only when permitted by the existing API. They MUST require an explicit confirmation step, submit the server-required request identifier and reason, and refresh related lists after server confirmation. Room management MUST remain read-only in the absence of a disposal API.

#### Scenario: Confirm before revoking role

- **WHEN** The platform administrator chose to revoke the role but canceled the confirmation
- **THEN** The admin app sends no revocation request, and the role state remains unchanged.

#### Scenario: Handling request conflicts

- **WHEN** A case or appeal changes state during the operation, causing a conflict.
- **THEN** The admin app displays the server error and refreshes the current record without claiming success.

### Requirement: Case and appeal statistics use full server-side counts

Case and appeal statistics cards MUST use separate server-side counts across the full dataset. The number of records on the current cursor page MUST never be presented as the total. Case statistics MUST comply with the same administrator or safety officer visibility scope as the list; appeal statistics MUST be readable only by the safety officer. If the count query fails, the UI MUST display an unknown state; failure MUST not be interpreted as zero.

#### Scenario: safety officer View statistics

- **WHEN** A safety officer opens the case or appeal page.
- **THEN** The page displays the number of pending, high-risk judged, closed cases or pending, maintained, and released appeals that are currently visible on the server.

#### Scenario: Statistics query failed

- **WHEN** Statistics API request failed
- **THEN** The statistics card displays an unknown state and error feedback; the list can still be queried independently.

### Requirement: Room operation details contract is complete

Successful response for room operation details MUST declare the room ID, topic, type, visibility, status, level, capacity, time, aggregate count, and next page cursor in a unique OpenAPI contract. The client MUST depend only on fields declared by the contract.

#### Scenario: Query room operation details

- **WHEN** The current authorized role requests room operation details
- **THEN** Returns room entry and next page cursor consistent with OpenAPI structure
