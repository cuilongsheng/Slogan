## Why

The PC management terminal currently only has the project startup page. The six confirmed backend V2 design drafts and the existing backend API have not yet formed a usable management workbench. Safety officers, administrators and auditors cannot complete daily work in the browser.

## What Changes

- Establish browser admin login, refresh recovery, exit and `/v1/backoffice/me` real-time role verification, and display accessible navigation by role.
- According to Figma V2, six pages of room management, security cases, restriction appeals, security degradation events, administrative roles and operation audits are implemented, and the only OpenAPI generated client is connected.
- List provides applicable filtering, cursor paging, loading, null status, errors and permission denial. Security processing and role changes adopt the commands, secondary confirmation and result refresh supported by the server.
- Completed the backend room operation details and successfully responded to the missing structure in code-first OpenAPI to avoid front-end dependence on undeclared fields.
- Provides a full server counting interface for case and appeal statistics cards that complies with the existing backend permissions.
- Record desktop visuals, real API runtime, permissions and automated verification evidence; while maintaining code inventory of remaining front-end work on the mobile side.

## Capabilities

### New Capabilities

- `admin-workspace`: PC workbench pages and interactions authorized by the current administrative role.

### Modified Capabilities

None. The existing runtime response of the room operation details is supplemented with the contract statement in the `admin-workspace` capability of this change.

## Impacted delivery stages

- Architecture
- Prototype / Figma
- Backend / API
- Frontend
- Test / Acceptance

## Impact

`apps/admin`, `apps/api` operation response DTO and safety statistics query, `openapi/openapi.yaml`, `packages/api-client`, background E2E/visual acceptance. No database migration. Six 1440×900 pages of `07 后台 / V2 高保真` for Figma file `56nIowZmvBhb0QJvOlDQdU` have been confirmed by the user.
