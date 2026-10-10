## Why

The "Create" entry on the mobile room discovery page is still disabled. The existing instant room and reserved room APIs already provide real creation capabilities, and users cannot use them on the client.

## What Changes

- According to the confirmed Figma instant 111:979 and reservation 121:3613 two 390×844 pages to implement the room creation form.
- Access the generation client of /v1/rooms and /v1/appointment-rooms, providing verification of theme, specific CEFR, capacity, password, visibility, appointment start and end time, and server error feedback.
- Enter the real room after successful creation; the instant room room host enters the voice room process, and the reserved room enters the room details. Create a button to prevent repeated submissions.
- Enable "Create" entry from room discovery page, logging browser preview, API and device evidence boundaries.
- The room reservation details allow the room host to cancel before starting; the generated sharing link is parsed by the real sharing code and the corresponding room is opened.

## Capabilities

### New Capabilities

- mobile-room-creation: Users create instant and reserved rooms on the mobile terminal.

### Modified Capabilities

None. Room business rules and API continue to use the existing OpenSpec/OpenAPI.

## Impacted delivery stages

- Prototype / Figma
- Frontend
- Test / Acceptance

## Impact

apps/mobile routing, room creation feature, discovery page button, copywriting and verification. No backend or persistence layer changes.
