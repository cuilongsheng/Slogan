## Context

The admin app reuses ordinary account sessions. Permissions come from current persistent server-side roles. Web refresh uses the authentication path’s HttpOnly cookie. Access tokens remain only in runtime memory. The backend API has provided cases, appeals, downgrade events, roles and audits; room operation details are only queried, and there is no room disposal order for existing contracts.

## Decisions

1. `apps/admin/src/app` owns routes and providers; `layouts` owns the 232px sidebar and 70px top bar. Features own their domain-specific requests and interactions. All HTTP calls use `@slogan/api-client`. The server remains the final authorization authority; frontend role-based navigation only improves the user experience.
2. Login using existing `/v1/auth/web/password/exchange`. On startup, make a single-flight call to `/v1/auth/web/refresh`, then call `/v1/backoffice/me`. A 401 clears the local access token; a 403 displays that administrative access is unavailable. Logout clears local caches and calls `/v1/auth/web/logout`.
3. Six pages are bound to the confirmed Figma frames: room `114:1602`, case `114:1655`, appeal `114:1708`, downgrade event `114:1761`, role `114:1814`, audit `114:1867`. Preserve layout, hierarchy, colors, and control states. Example design data is not runtime data.
4. Room operation details are read-only, and filtering is only submitted when the server contract supports it; the current API only supports cursor and limit, and filtering on other interfaces cannot be disguised as full query. Administrative role operations and case/appeal decisions must display actual server results and conflict/rejection states.
5. Use one `QueryClient` for query caching, with keys distinguished by resource and filter criteria. Keep transient form state within components. Refresh the current identity and related lists after role changes. Put the copy into a centralized resource file.
6. The three statistics cards on the case and appeal pages are read from the independent full summary API. The cases follow the visible range of the administrator full amount/safety officer and the unassigned queue. Appeals are only readable by the safety officer. Statistics failed to display an unknown value, which cannot be filled in with the current page length.

## Risks and rollback

- The current room details OpenAPI is missing a successful response field: first fill in the code-first DTO and regenerate the contract/client, and then connect to the page; only add the response description and do not change the runtime JSON.
- The browser source must appear in the server CORS and Web auth allowed sources; if the environment is omitted, the admin login will clearly report an error. Do not write tokens to localStorage or logs.
- When the client switches roles or the role is revoked, the next API request will still be re-authenticated by the backend; after receiving 403, the corresponding cache will be removed and a rejection status will be displayed.
- The UI can be rolled back to the project startup page independently; the new response description in the backend remains compatible, and there is no data migration. Failure of high-privilege operations does not show optimistic success.
