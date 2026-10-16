## Why

The owner reported that avatars do not open reporting, the room menu exposes the wrong operations, tab highlighting is misleading, the creation page is excessively stretched, and two independently logged-in users cannot find each other. The owner explicitly requested these corrections on 2026-10-12; implementation is authorized as part of the current repair batch.

## What Changes

- Open member reporting directly from another joined member's avatar.
- Provide exactly Report room, Leave room and Share room link in the room overflow menu, preserving host handoff and existing share behavior.
- Add genuine room reports and identifiable room cases without inventing an accused member; reject personal sanctions for cases without an accused user.
- Remove navigation halos and highlight only the active icon/text. Bound desktop web preview geometry and improve creation-page spacing while retaining the three level choices and existing fields.
- Repair partner presence, occupancy and pagination defects identified by controlled independent-session checks; preserve online/idle/adult/bilateral-block eligibility.

## Capabilities

### New Capabilities

- `room-reporting`: Member-authorized, idempotent room reports and room-specific backoffice cases.

### Modified Capabilities

- `user-availability`: authenticated foreground availability requests renew only the actor presence; candidate eligibility remains unchanged.
- `basic-safety-reporting`: Direct avatar entry to existing member reporting, without self-reporting.

## Impact

Mobile React Native/Expo, admin safety cases, moderation/safety/social modules, nullable report/case targets, generated OpenAPI/client, actual Figma overlays and creation/navigation geometry, tests and guarded release. Existing member and direct-message report bodies remain compatible; nullable room-case response targets are an additive semantic extension requiring coordinated clients.

Impacted stages: Architecture; Figma; Backend/API; Frontend; Test/Acceptance; Deployment. No new language/category fields, provider integrations, direct-message media, punitive room decisions or account access grants.
