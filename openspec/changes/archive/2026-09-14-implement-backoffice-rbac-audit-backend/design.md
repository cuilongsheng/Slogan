## Context

See `proposal.md` for motivation and scope, and the `backoffice-access-control` and `backoffice-audit` delta specs of this change for behavior.

Current code facts checked on 2026-09-14:

- `AccessTokenGuard` is the global authentication guard. It uses `SessionService` to validate JWTs, persistent sessions, and user state, and writes only `userId` and `sessionId` to the request. Neither the token nor the identity context contains role fields.
- `auth` already provides OAuth, access/refresh tokens, session revocation, and public module interfaces. `users` is still an empty directory skeleton; Prisma `User` has only `ACTIVE`, `DISABLED`, and `DELETED` states and no administrative role relationship.
- `audit` currently only has the `appendRoomEvent` infrastructure entrance for room transaction reuse. The `RoomEvent` service room life cycle is associated with reporting and cannot carry all background resources and permission events.
- The global DTO verification rejects additional fields, and `ApiExceptionFilter` provides a stable error body; `StructuredLogger` and log desensitization are already based, but the administrative role/reason/filter still needs field whitelisting and actual output testing.
- There is currently no `/backoffice` API, role bootstrap, administrative audit query or PC admin app business implementation. OpenAPI is generated deterministically by NestJS Swagger decorators.

## Goals / Non-Goals

**Goals:** uses PostgreSQL role facts as the authorization basis for each request; provides the first administrator establishment, minimal role management and instant revocation; makes role changes and audits atomic; provides reusable background permissions and audit public entrances for subsequent security cases.

**Non-Goals:** does not build a second set of authentication, policy language or tenant systems; does not cache roles in JWT/LiveKit tokens; does not pre-build case, indicator or room penalty interfaces; does not transform `RoomEvent` into a general backend audit table.

## Decisions

### 1. Authentication and background authorization layering

The existing `AccessTokenGuard` continues to be only responsible for identity authentication. The new `backoffice` module has role assignment, role policy, management API and authorization query; the background controller and subsequent security modules declare the required permissions through its public decorator/guard. The authorization guard presses `userId` to query the current valid role and user status after the authentication is completed. It does not read the client role or put the role into a long life cycle token.

This change defines the three permissions required by the current real endpoint: view the current background identity, manage roles, and read administrative audit. The mapping of roles to permissions is maintained centrally: any backend role can view the minimum backend identity of the person, `PLATFORM_ADMIN` can manage roles and read audits, `AUDITOR` can only read audits; the business permissions of `SAFETY_OFFICER` and `OPERATIONS_ANALYST` are increased by subsequent actual capabilities. When a user has multiple roles, the permissions are combined, but the administrator role will not automatically obtain safety officer permissions.

The alternative of writing the role into the access token will delay the revocation until the token expires; the handwritten role judgment of each controller is easy to drift; the introduction of a general ABAC/policy engine exceeds the actual need for four fixed roles. None are used.

### 2. Independent role assignment model retains authorization facts

Add `BackofficeRoleAssignment`, save UUID id, userId, fixed role, grantedAt/grantedByUserId, revokedAt/revokedByUserId and version, and create unique constraints on `(userId,role)`. The grantedBy of bootstrap is empty and interpreted by the `SYSTEM_BOOTSTRAP` actor corresponding to the administrative audit; ordinary role modifications must have associated actors. Target and actor user relationships use RESTRICT, soft deletion does not erase character history.

Revoking a role retains its assignment row and sets revocation fields. Regranting updates the same assignment and version rather than creating duplicate rows with ambiguous current state. Authorization query only accepts assignments that have not been revoked and the user is still ACTIVE. The API does not directly expose Prisma enum, and domain and transport are explicitly mapped.

The alternative of adding a single role field on `User` cannot support administrators and safety officers; using Redis or JWT as facts cannot span restarts and guarantee instant revocation; deleting assignments will lose the authorization timeline. None are used.

### 3. First administrator bootstrapped by one-time CLI

Provide repository command, enter an existing platform UUID. The transaction first obtains the fixed PostgreSQL transaction advisory lock, and then reads the target account and existing effective administrators:

- When there is no valid administrator, grant `PLATFORM_ADMIN` and `SAFETY_OFFICER` to the target atom and add a system bootstrap audit;
- The idempotent result is returned when the specified target already holds two roles, and the audit is not repeated;
- Stability fails when the target does not exist/is unavailable, there is already another administrator, or the current status only partially matches, and the administrator is not automatically patched or replaced.

The command accepts neither email addresses, provider subjects, nor display names. It does not create users, modify account state, or log database connections, tokens, or provider information. Subsequent role changes can only use the authenticated administrator API; bootstrap cannot be used as a daily break-glass bypass.

The target user is not known for the alternative migration seed; the environment variable is automatically granted every time it is started, and the permissions are re-elevated after being revoked; the direct manual modification of the database lacks invariants and auditing. None are used.

### 4. Role command uses database idempotent and last administrator lock

Grant/revoke request carries `clientRequestId`, role, and reason in 1–500 Unicode code points. `BackofficeAuditEvent` uniquely constrains the `(actorUserId,clientRequestId)` construction conditions of ordinary actors, and saves the normalized command fields; retry first compares action, target, role and trim and then reason. If the same results are the same, the first result will be returned. If they are different, `BACKOFFICE_REQUEST_CONFLICT` will be returned.

Role mutation locks target assignment in the same transaction. When `PLATFORM_ADMIN` is involved, use a fixed advisory lock to serialize the administrator set check to ensure that concurrent revocation cannot reduce the effective administrator to zero. idempotent no-op still returns the current allocation, but only keeps an audit of the first accepted command. A command that has been authorized by the administrator but rejected due to the last administrator rule is submitted to a `REJECTED` audit and then mapped to a stable conflict; requests that fail authentication/role guard only write desensitized security logs to prevent unauthorized traffic from filling up the persistent audit.

The alternative of using only memory/Redis idempotent cannot guarantee the result after the process is restarted; simply count first and then update will cause concurrent evacuation of the administrator; throwing an exception will cause the transaction to be rolled back even if the audit is rejected. None are used.

### 5. Background auditing is owned separately from RoomEvent

Added `BackofficeAuditEvent`, saving at least id, actorType, actorUserId, actorRoles snapshot, action, targetType, targetId, reason, result, clientRequestId, requestId, occurredAt and limited structured details. action/target/result uses explicit allowed values ​​in domain; details are constructed from a whitelist of events of each type and do not receive controller DTO or exception objects.

The `audit` module has audit appends and queries. In order to meet role mutation and audit atomicity, it accepts the caller's existing Prisma `TransactionClient` through public infrastructure integration; the Prisma type is only passed at the infrastructure boundary of `backoffice`/`audit` and does not enter the controller, application or domain. Existing RoomEvent maintains the room event model and the two audit facts do not copy each other.

The role list and audit list are first read according to the stable `(occurredAt,id)` or `(grantedAt,id)` cursor within the transaction, and then the corresponding view audit is appended; if the audit write fails, the entire request fails and the read data is not returned. This batch does not provide audit update/delete/export API, nor does it promise permanent retention; subsequent data governance can only establish retention and controlled cleanup rules through independent changes.

### 6. HTTP and stability errors

Add the following `/v1/backoffice` contract, all of which reuse Bearer certification:

- `GET /v1/backoffice/me`: Readable by any administrative role, return `{userId,roles}`;
- `GET /v1/backoffice/role-assignments`: Platform administrator reads in pages and can be filtered by userId/role/active;
- `POST /v1/backoffice/users/{userId}/roles/{role}/grant`: Granted by the platform administrator;
- `POST /v1/backoffice/users/{userId}/roles/{role}/revoke`: revoked by the platform administrator;
- `GET /v1/backoffice/audit-events`: The platform administrator or auditor reads the allowed filter conditions in pages.

Stable errors include `BACKOFFICE_ACCESS_DENIED` (403), `BACKOFFICE_USER_NOT_FOUND` (404), `LAST_PLATFORM_ADMIN_REQUIRED` (409) and `BACKOFFICE_REQUEST_CONFLICT` (409); format, UUID, role, reason, filter and cursor illegally follow `VALIDATION_FAILED`. If the identity fails, the existing 401 boundary will continue to be used, and the persistence failure will be externally `INTERNAL_ERROR`. Error must not echo reason, cursor, token, SQL or stack.

Continue generating the sole `openapi/openapi.yaml` through NestJS code-first Swagger; do not hand-maintain a second contract. The frontend client and desktop admin pages are outside this change’s scope.

### 7. Acceptance layering

domain unit tests verify role/permission mapping, reason normalization, idempotent content comparison and finally administrator policy. Real PostgreSQL integration tests verify migrations, concurrent bootstrap, atomic role grant/revocation and audit, concurrent protection of the last administrator, idempotency after restart, and audit-query pagination. HTTP E2E authentication, permission bypass, instant revocation, minimal response, stable errors and OpenAPI.

Execute the local real PostgreSQL closed loop at least once: create a normal user → bootstrap as administrator and safety officer → grant/revoke other roles → lose the old access token immediately → the administrator/auditor reads the audit, and directly queries the persistent table to check the role and audit number. This evidence does not require a real Google/WeChat provider, LiveKit, front-end or device, and the fake OAuth result must not be recorded as provider smoke.

## Risks / Trade-offs

- [Risk] Generic administrative audit details could gradually accumulate private data → use explicit schemas/allowlists for each action; prohibit forwarding raw DTOs, headers, exceptions, or arbitrary JSON, and test actual logger/response output.
- [Risk] Querying PostgreSQL for every admin request adds some latency → current admin traffic is low and immediate revocation takes priority. Start with indexed queries; do not introduce Redis caching without evidence.
- [Risk] The CLI has production database write access → allow execution only when no effective administrator exists, with UUID targeting, transaction locks, fixed role combinations, and audit constraints. Deployment procedures control credential custody and the operator.
- [Risk] Later account restrictions could disable the administrator and make the admin app unavailable → this change does not alter account state. Subsequent restriction changes must explicitly address last-administrator and break-glass risks rather than silently bypass authentication.
- [Risk] Role revocation can interleave with concurrent requests → each request reads current roles before executing a protected use case. Long transactions do not span external providers; role mutations use database locks and versions.
- [Risk] Multiple previous changes in the current workspace have not been archived → Check the real auth/audit/schema and migration sequence before applying, and use the existing code as the integration fact; do not modify the old migration, nor use active planning as evidence of implementation.

## Migration Plan

1. Before apply, record the current Prisma migration chain, `User`/session models, public audit interface, and backend verification baseline. Confirm ownership of workspace changes to avoid overwriting prerequisite changes.
2. Add administrative role enums, role assignments, and administrative audit through an additive migration. Do not create default roles or modify existing users, sessions, or RoomEvent records. Verify upgrades from both an empty database and complete prerequisite data.
3. After implementing services, guards, APIs, the CLI, and the code-first contract, create ordinary test users in an isolated test database and run the complete bootstrap flow. Real production users must not enter tests or the repository.
4. When deploying, apply migration first, and then deploy applications compatible with the new table; authorized operation and maintenance personnel only perform bootstrap once, check the target UUID, two roles, and audit results before opening the backend entrance.
5. On application rollback, stop exposing the new administrative APIs, retain role/audit tables and their data, and do not run destructive down migrations. Older versions do not read the new tables. Restore subsequent services through forward fix to avoid deleting security audits.

## Open Questions

A deployment-security change determines the production bootstrap operator, administrator provider-credential recovery, and MFA/break-glass mechanisms. These choices do not alter this change’s data model, API permissions, or task boundaries. Real identities and credentials must not be stored in the repository.
