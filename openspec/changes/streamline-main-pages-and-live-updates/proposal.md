# Streamline main pages and live updates

## Why

The owner revised direct-chat, call and list layouts, observed clipped input placeholders and oversized bubbles, and requested visible unread notifications, faster partner discovery, automatic Discover updates, a clear profile-edit action, compact headings, followed by the owner-approved centered main titles and 16px back-header revision.

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

No WebSocket service, notification provider, database migration or new profile requirement. Preserve existing authorization, hidden/read boundaries, pagination, blocking, reports and explicit voice-call acceptance. The owner initially deferred verification and release until a combined batch, then authorized both. The earlier batch shipped through PR #23; the latest UI revision below is verified separately and has not been deployed.

## Approved UI revision (2026-10-13)

Implement the six supplied updated UI targets: branded session-restoration loading, centered main-page titles, refresh-only successful empty Partners/Messages states, 16px aligned back headers, revised room-creation cards, and simplified login layout. Retain actual refresh/authentication/create/password/scheduling behavior, localized copy, WeChat disabled state, and recoverable errors. No artificial loading delay or API/schema change.

The owner additionally removes introductory page subtitles across the mobile screens and restores Discover's second-row filter/count/burst/create layout from the supplied header crop. Operational status, consent content and validation feedback retain their existing behavior.
