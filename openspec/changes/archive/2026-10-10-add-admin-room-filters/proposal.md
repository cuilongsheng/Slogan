## Why

Confirmed backend room management V2 draft includes room ID/topic search, status, visibility and time range controls. The current operating room API only supports cursor and page size, and the page cannot provide filtering covering all rooms.

## What Changes

- Add composable server-side search, status, visibility and creation time lower bound filtering to read-only backend room lists, and maintain stable paging.
- Press `114:1602` on the admin app to access the four controls. When the filter changes, it returns to the first page, showing the real results and empty status.
- Update unique OpenAPI contract, generate client and automation, visual and runtime evidence.

## Capabilities

### New Capabilities

- `admin-room-filters`: Combination filtering of background operation rooms and cursor paging consistent with filtering conditions.

### Modified Capabilities

None.

## Impact

- `apps/api`'s backend operation room query and DTO; `openapi/openapi.yaml` and `packages/api-client`; `apps/admin` room page.
- Only roles with `OPERATIONS_DETAILS_READ` permission can query; no room disposal commands or data migration are added.
