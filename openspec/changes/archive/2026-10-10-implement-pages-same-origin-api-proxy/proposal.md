## Why

Two Pages sites in the free trial are cross-site with the Render API; the existing SameSite=Lax refresh cookie is not reliably used for cross-site refresh. The user has authorized this round to directly implement the same-origin proxy, build configuration and verification without creating online resources.

## What Changes

- The two websites are forwarded to the HTTPS origin with fixed deployment configuration and allowed by the whitelist through their respective `/v1` and `/v1/*`, retaining API and browser session semantics; the whitelist retains the single-layer Render domain name and includes the subsequently approved `slogan-api-pi.vercel.app`.
- Shared advanced-mode Worker; the final build includes `_worker.js`, `_routes.json`, and static pages continue to use Pages Assets.
- Upstream configuration errors, network errors, and insecure redirects return masked JSON; caching, autoreplay, and guest control upstream are disabled.
- Updated the free trial running instructions to Upstash Redis, retaining cold start, task recovery and public network acceptance boundaries.

## Capabilities

### New Capabilities

- `browser-api-delivery`: Same-origin API delivery and failure safety for two web portals.

### Modified Capabilities

None. Business authentication, RBAC, API DTO, and permission rules maintain existing contracts.

## Impact

Level 2; affects architecture design, construction implementation, automation and local browser verification, deployment and operation instructions. No visual changes, no access to Figma. `openapi/openapi.yaml` remains the only contract, with no API schema changes or database migrations.

The confirmation scope is local implementation and verification. Non-target: resource creation, platform deployment, remote migration, account initialization, paid upgrade, task scheduling adaptation, real OAuth/LiveKit acceptance. The five-account implementation is located in an independent working tree and will not be modified or copied in this round. The actual platform origin, trusted proxy chain and free resource load are items to be checked before release and cannot be fictionalized as confirmed.
