## Why

The mobile voice room can only view members and exit directly. The implemented room host removal, re-invite, succession selection, ordinary invitation and member reporting APIs have no available front-end entry.

## What Changes

- According to the confirmed Figma member page and operation overlay, room host member management, invitation and exit takeover options are provided.
- Provide real member reports, category and description verification and server acceptance results according to the report coverage draft.
- Operations preserve voice sessions, display server-side permission/conflict errors, and update member and room status.
- Supplement target user ID in member response for authenticated current room member to submit existing reporting API.
- Provides a list of removed members of this room that is readable only by the room host, so that the existing re-invite interface can still be used after refreshing.

## Capabilities

### New Capabilities

- mobile-room-controls-reporting: Voice room member management, invitation, takeover and reporting portal.

### Modified Capabilities

None; business constraints follow host-controls, room-invitations, and basic-safety-reporting.

## Impacted delivery stages

- Prototype / Figma
- Frontend
- Test / Acceptance

## Impact

apps/mobile room API, voice session and overlay; apps/api member DTO and generated OpenAPI/client. No data migration.
