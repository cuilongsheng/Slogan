## Why

Preview has exhausted three free-tier resource budgets through recurring idle work and deployment-partitioned queue chains. Business correctness must remain intact while removing that fixed cost.

## What Changes

- Fence managed consumers with an explicitly activated, monotonic durable owner; route committed business wakeups to it.
- Replace SSE/global frequent scans with event publication and one bounded adaptive safety fallback (15 minutes online/pending, 60 minutes confirmed empty).
- Reuse verified request authorization, query only minimal periodic state, and retain a 15-second revocation bound.
- Retain 90/45-second presence, immediate stream events/replay, and idempotent durable retries.
- Cache metrics by source version, narrow reconciliation reads, and lower optional monitoring frequency.

## Capabilities

### New Capabilities

- `resource-efficient-runtime`: Bounded idle resource use and release ownership without weakening authorization or recovery.

## Impact

Nest backend, managed queue callbacks, additive PostgreSQL schema and release activation tooling. No public API or SSE wire change. No cloud deployment or schema application in this task.

## Impacted delivery stages

- Architecture
- Backend / API
- Test / Acceptance
- Deployment (migration and rollback preparation only)
