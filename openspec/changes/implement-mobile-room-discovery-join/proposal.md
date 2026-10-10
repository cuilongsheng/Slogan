## Why

The mobile terminal after completing the information currently only displays the placeholder page, and the user cannot browse the real room or view the joining conditions. The confirmed room list and pre-move-in page need to be connected to the existing room API so that the next batch of voice room work can be built on a runnable discovery process.

## What Changes

- Change the default entrance for qualified users to a public real-time room list, providing real loading, empty list, error, refresh, paging and room details status.
- According to the confirmed design implementation details, 4-digit password input, active confirmation of room rules and equipment inspection page; the input and confirmation status is only retained in the current process and cleared when switching rooms.
- Room lists and details only show the fact that existing contracts are returned. The total number of rooms, member avatar preview, room language filtering and pre-movement member list in the design lack corresponding contracts and are not filled in with static samples.
- This batch does not create a membership or request a real-time voice voucher; the equipment check page clearly states that the actual room entry will be opened after the voice room process is connected, so as to avoid occupying the room quota but being unable to make calls.

## Capabilities

### New Capabilities

- `mobile-room-discovery-join`: Defines the visible boundaries of mobile room discovery, details and pre-check-in procedures and missing capabilities for logged-in qualified users.

### Modified Capabilities

None.

## Impact

- Qualified user portal, `room-discovery` feature, authentication request portal, i18n, semantic style and necessary device permission adaptation of the mobile Expo Router.
- Reuse existing OpenAPI `GET /v1/rooms`, `GET /v1/rooms/{roomId}`; do not modify the backend contract or persistence layer.
- Figma Desktop Bridge Confirmed `02 UI` List V2 `115:1197`, Details `111:1026`, Password `111:1071`, Rule `114:2508`, Device Check `114:2509`, all 390×844.

## Impacted delivery stages

- Prototype / Figma
- Frontend
- Test / Acceptance
