## Why

Personal room/reservation history and private post-meeting notes have server capabilities, but there are still no pages on the mobile phone. Users cannot review participation records or record their learning after the room ends.

## What Changes

- Add room history to the personal entrance, distinguish actual participation from reservation only, support refresh and server-side paging.
- Provide private note reading, saving, clearing and version conflict handling for rooms that have actually participated and ended.
- The user has allowed pages without independent high-fidelity frames to inherit the confirmed V2 visual language.

## Capabilities

### New Capabilities

- `mobile-room-history-notes`: Personal history and private post-meeting note-taking process on the mobile phone.

### Modified Capabilities

None. The current specification for backend `room-history-notes` remains unchanged.

## Impact

- `apps/mobile` personal entrance, routing, history/notes feature, copywriting and testing. Only use existing OpenAPI, no changes to database, permissions or room live sessions.
