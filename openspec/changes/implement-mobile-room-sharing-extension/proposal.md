## Why

The instant room details and reservation details have stable sharing URLs, but there is no executable sharing action; there is no room host extension time entry for the voice room. The existing sharing parsing and extension APIs are available, but users still cannot complete these two room operations from the mobile phone.

## What Changes

- Provides real sharing actions in instant/reservation details and voice room, Web copy link, native call system sharing panel; retains the selected URL if failed.
- Provide a 15/30/60 minute extension confirmation process for the current room host in the voice room, submit the stable request identifier, and after success, retrieve the server room end time and display the real-time synchronization status.
- The extension command is not presented when the reservation is not open, ended, or not a room host; the server still ultimately verifies permissions and the upper limit of times.

## Capabilities

### New Capabilities

- mobile-room-sharing-extension: Room sharing operation and voice room extension time entry.

### Modified Capabilities

None; the rules follow room-discovery-sharing and room-time-extension.

## Impacted delivery stages

- Frontend
- Test / Acceptance

## Impact

`apps/mobile` room details, reservation details, voice room API and copywriting. No backend contract or database changes. The existing Figma voice room and details page do not cover the extension/sharing operation state separately. The visual language of the confirmed page is used and the differences are recorded.
