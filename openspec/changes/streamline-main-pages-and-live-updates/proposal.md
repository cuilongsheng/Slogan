# Streamline main pages and live updates

## Why

The owner revised direct-chat, call and list layouts, observed clipped input placeholders and oversized bubbles, and requested visible unread notifications, faster partner discovery, automatic Discover updates, a clear profile-edit action, 18px page headings and no headings on the four main tabs.

## What changes

Restore the live Desktop Bridge five-frame direct-communication layout with the explicitly authorized heading overrides. Use compact content-sized bubbles, a correctly measured multiline composer, a new rounded receiver asset, and no redundant chat privacy banner/tools row. Keep report/block reachable through long-press/header overflow. Remove the recent-conversations pill, retain actual unread row counts, and add an account-scoped navigation unread count.

Keep the room invitation picker synchronized with the same online/idle candidates as Partners; refresh while it is open and retain a manual empty/error retry. Replace both row text actions with compact chat icons.

Use foreground-aware, non-overlapping 5-second main-list updates with immediate focus/foreground refresh, timing from request start and stale-response fencing. Add a lightweight authenticated aggregate unread endpoint instead of globally fetching and projecting every conversation. Add an explicit edit-profile button above logout and reset the edit draft from the saved profile on each edit entry. Retain optional demographics/adult restrictions and existing profile APIs.

## Impacted delivery stages

- Architecture: foreground scheduling and unread notification ownership
- Prototype / Figma: confirmed direct frames and owner-authorized compact heading/main-tab changes
- Backend / API: actor-only aggregate unread endpoint
- Frontend
- Test / Acceptance

## Boundaries

No WebSocket service, notification provider, database migration or new profile requirement. Preserve existing authorization, hidden/read boundaries, pagination, blocking, reports and explicit voice-call acceptance. Tests, push, deployment and APK publication remain deferred by the owner until the final combined batch.
