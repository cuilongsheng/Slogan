## Why

Room invitations are persisted but have no foreground notification on main pages, and the sender's sent state disappears when its sheet unmounts. Report receipts are not discoverable after closing the form, while the owner now requires a personal history and real processing progress.

## What Changes

- Set Partners and Messages headings to 16px; retain Me’s centered heading, profile and language block beneath it, compact left-aligned menu rows and bottom logout action.
- Show pending room invitations through an account-scoped foreground observer, with direct join and decline actions. Preserve password, capacity, eligibility and removed-member checks.
- Read pending invitations for the current room host so sent/disabled state survives picker remounts and reentry; retain existing server-side deduplication.
- Add reporter-owned, paginated report history and processing status under Me, covering room, member and direct-message reports. Retain a visible confirmation/receipt after submission.
- Test receiver discovery, join, decline, duplicate sends, ownership isolation, progress changes, errors and visual states, then publish through the existing guarded release workflow.

## Capabilities

### New Capabilities

- `personal-report-history`: minimal reporter-owned history and case progress without internal moderation evidence or notes.

### Modified Capabilities

- `room-invitations`: foreground notification, direct admission entry and persistent host pending-invitation visibility.
- `mobile-social`: requested main headings and Me layout, invitation presentation and report-history entry.

## Impact

Mobile root observer, social/invitation API adapters, room invitation picker, report confirmation, personal report screen and localization; NestJS rooms/moderation query ports/controllers and generated OpenAPI/client. No credential/provider changes, voice connection redesign or schema migration is required.

## Impacted delivery stages

- Architecture: account/host ownership and sensitive-field projections.
- Prototype / Figma: existing page deltas plus invitation/history states using the connected Desktop Bridge.
- Backend / API: bounded host and reporter queries.
- Frontend: invitation and report feedback.
- Test / Acceptance: API ownership, two-session interactions and visual evidence.
- Deployment: guarded API, both Pages and APK publication.

The owner explicitly authorized implementation of these fixes and clarified that report records and progress must be available in Me. Broader push notifications outside the foreground app, internal case notes, automatic room switching and moderation-policy changes are outside this change.
