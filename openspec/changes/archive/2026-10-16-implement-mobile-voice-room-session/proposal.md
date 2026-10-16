## Why

`implement-mobile-room-discovery-join` Currently only discovery and room entry preparation have been completed; users still cannot actually join the voice room after passing the device check. For two users to communicate in real-life English, existing memberships, real-time credentials, and LiveKit audio connections need to be connected into a resumable mobile session.

## What Changes

- Connect the main operation after device check to the real join request, real-time voucher acquisition and voice connection; after success, the room subject defined by Figma `02 UI / Voice Room / Pilot V2 · review` is displayed.
- The initial microphone remains muted and the user actively switches; displays the current member, room host, speaking and microphone status, and provides feedback on exit, reconnection and room end.
- Provide clear recovery paths for joining competition, incorrect password, room end, permission invalidation, credential failure, real-time connection interruption and page refresh; do not write temporary passwords or real-time credentials into URL, persistent storage, or logs.
- This batch does not implement room creation, invitations, room host removal/extension, AI assistance, voice translation, sensitive voice recognition, room notes or chat; these entrances in the design will only be enabled after separate delivery.

## Capabilities

### New Capabilities

- `mobile-voice-room-session`: The client behavior of the mobile terminal is to prepare to enter the real voice room from confirmed room entry, mute by default, present connection and member status, exit and end recovery.

### Modified Capabilities

None.

## Impact

- Mobile `apps/mobile`: room routing, authentication API adaptation, LiveKit Web/native client, interface and session state; requires Expo development build, cannot just use Expo Go.
- Contract: Reuse `POST /v1/rooms/{roomId}/memberships`, `POST /v1/rooms/{roomId}/realtime-credentials`, `GET /v1/rooms/{roomId}/members`, `POST /v1/rooms/{roomId}/leave` of `openapi/openapi.yaml` and existing room details; if the member display fields are insufficient, the real fields of the contract will be displayed first, and the fictional avatar will not be rendered.
- Design: Figma Desktop Bridge original `115:1425`, reconnect `114:2511`, end `114:2512`; user confirmed high-fidelity design.
- Verification: API/session testing, dual-end construction and page screenshots, real LiveKit audio of two accounts and disconnection/exit device acceptance are recorded separately; local simulated connections cannot pretend to be real two-person audio proof.
