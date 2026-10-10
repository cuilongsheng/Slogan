## Why

The existing backend has only ordinary user identities and sessions. It cannot yet reliably distinguish platform administrators, safety officers, operations analysts, and auditors, and lacks reusable administrative operation auditing for later case handling. Before continuing safety cases, account restrictions, and operational queries, establish least-privilege, revocable roles, and an unavoidable server-side administrative boundary.

## What Changes

- Add database-backed administrative multi-role authorization supporting `PLATFORM_ADMIN`, `SAFETY_OFFICER`, `OPERATIONS_ANALYST`, and `AUDITOR`. A user may hold multiple roles simultaneously.
- Reuse existing OAuth, access tokens, persistent sessions, and account-state validation rather than introducing a second admin login system. Read currently effective roles from PostgreSQL on every admin request so revocation does not wait for old tokens to expire.
- Added a one-time operation and maintenance bootstrap command. According to the existing platform `userId`, the first background account is granted the platform administrator and safety officer roles at the same time; the command idempotent leaves system audit and does not accept email as the only identity.
- Added role viewing, granting and revoking APIs that are only available to platform administrators; revoking the last valid platform administrator is prohibited, and role changes and successful audits must be submitted in the same database transaction.
- Added a new background current identity API to return the minimum identity and role set to authorized background users; ordinary users without administrative roles cannot enter any background API.
- Added independent administrative audit facts, recording actor, role snapshot during operation, action, target, reason, result, time and request association identification; platform administrators and auditors can query in pages, and the query itself must also be audited.
- Update the only OpenAPI contract, and use permission bypass, instant role revocation, concurrent role modification, final administrator protection and log desensitization as the main acceptance failure paths.

### Confirmed Scope

- The user confirmed on 2026-09-14 that the first backend account is used by himself, and hopes to have both the administrator and safety officer roles; a one-time operation and maintenance bootstrap performed according to the existing `userId` is used.
- Platform administrators, safety officers, operational analysts and auditors follow the minimum permissions; the administrator account can only perform subsequent case processing actions when it also holds the safety officer role.
- Roles can coexist and become invalid immediately after being revoked; the current change only creates roles, backend entrance protection, role management and backend auditing, and does not grant unimplemented business capabilities.
- Continuing with NestJS code-first deterministic generation of `openapi/openapi.yaml`, PostgreSQL is the persistent source of truth for roles and auditing.

### Non-goals

- Reporting cases, evidence packages, case assignments, account restrictions, appeals, permanent bans, room bans/restorations, or safety officer penalty actions are not implemented.
- PC management page, mobile portal, background independent password, SSO, MFA, organization/tenant, field-level custom permissions or user self-service application roles are not implemented.
- Does not implement platform indicators, active ranking, risk aggregation, general user/room background query or audit export.
- Does not change the authorization behavior of ordinary user rooms, reservations, reports, LiveKit and history interfaces, and does not write roles into LiveKit tokens.
- Does not perform production deployments or create real admin data; bootstrap only provides controlled commands and local acceptance evidence.

### Future Roadmap

- `implement-safety-case-restrictions-backend` reuses the safety officer role and administrative audit, and adds new cases, restrictions, appeals and recovery.
- `implement-room-safety-actions-backend` reuses the same permission boundaries to implement room warning, disabling and recovery.
- The subsequent operation and audit change will add aggregation indicators, restricted business query, alarm and export; no empty interface will be pre-built in this change.
- The administrator account's provider credential recovery, MFA, and production break-glass processes are determined in deployment/security hardening changes, and existing session verification cannot be bypassed through normal APIs.

### Unresolved Decisions

- There is no product selection for blocking planning in the current implementation scope. Who performs bootstrap in the production environment, how to maintain database access rights, and the administrator provider credential recovery process are left to deployment changes and do not save real accounts or credentials in the repository.

## Capabilities

### New Capabilities

- `backoffice-access-control`: Backend multi-role authorization, first administrator bootstrap, server-side role verification, role management and final administrator protection.
- `backoffice-audit`: Persistent, queryable, minimally auditable records of high-privilege access and operations in the background.

### Modified Capabilities

None.

## Impact

- Impacted delivery stages: Architecture、Backend / API、Test / Acceptance。
- Mainly affects the post-authentication identity context of `apps/api/src/modules/auth`, the role attribution of `users`, the administrative audit capability of `audit`, cross-module background authorization guard/decorator, Prisma model/migration, bootstrap script and `openapi/openapi.yaml`.
- Added backend current identity, role management and audit query API; existing common API contract remains compatible.
- Role modification and auditing require the same transaction boundary; audited reading requires stable paging, field whitelisting and access auditing, and tokens, provider secrets, passwords or report text cannot be recorded.
