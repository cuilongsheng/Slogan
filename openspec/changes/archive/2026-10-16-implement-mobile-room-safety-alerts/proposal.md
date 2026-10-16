## Why

The room security voice backend has provided the minimum reminder query and LiveKit directed event that can only be read by the current room host, but the mobile voice room has not yet been connected. You cannot see the reminder when the room host is online, and it cannot be completed after reconnecting. Therefore, the real device acceptance cannot be carried out.

## What Changes

- In a room with sensitive voice recognition enabled, only the current room host displays the risk reminder entrance and minimum reminder list.
- After verifying the versioned LiveKit directed event, query the server for the latest reminder; complete it when entering a room, reconnecting, and taking over the room host, and the list supports cursor page turning.
- The client reminder is cleared immediately when the room host identity expires, leaves the room, ends, or the server refuses access; all reminders only prompt manual verification and are not automatically processed.
- Use the confirmed mobile phone voice room V2 visual language to add reminder status; the original voice, transcription and hit original text do not enter the client status or log.

## Capabilities

### New Capabilities

- `mobile-room-safety-alerts`: The minimum risk reminder and recovery behavior of the current room host in the mobile voice room.

### Modified Capabilities

None. Reuse the current room-safe voice specification with a unique OpenAPI contract.

## Impact

- `apps/mobile/src/features/voice-room/`: HTTP client, LiveKit events, session state, room host interface and testing.
- `docs/acceptance/`: Vision, local operation and external device boundaries.
- No changes to the backend interface, database, risk rules, or delivery permissions.

## Impacted delivery stages

- Prototype / Figma
- Frontend
- Test / Acceptance
