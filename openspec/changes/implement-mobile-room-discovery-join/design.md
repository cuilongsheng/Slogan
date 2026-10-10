## Context

See [proposal.md](proposal.md) and [specs/mobile-room-discovery-join/spec.md](specs/mobile-room-discovery-join/spec.md). Currently, `apps/mobile` only has certification and first-time information pages. Qualified users can enter `/ready` to take up positions. OpenAPI has provided public real-time room list, details and joining interface; `GET /v1/rooms/{roomId}/members` requires the caller to be an active member, so it cannot be used for member preview before entering the room. List contract has no total, member avatar, or room language fields. This change does not change the API contract.

## Goals / Non-Goals

**Goals:** Use existing APIs to implement real list/details and move-in preparation pages; retain the main levels, cards, spacing, and status of the confirmed design; make unavailable capabilities explicit.

**Non-Goals:** does not create a room, membership or LiveKit connection, and does not implement voice room pages, shared link portals or other bottom navigation services in this batch.

## Decisions

1. Use `room-discovery` feature to manage list/detail requests, paging and page status. Expo Router only receives `roomId` and combines pages. `auth` provides a protected request entry and uniformly handles access token refresh and invalidation. Request to call `GET /v1/rooms` and `GET /v1/rooms/{roomId}` with the generated `@slogan/api-client` type; the second DTO is not maintained.
2. Qualified users move from `/ready` to `/rooms`, and other onboarding states maintain the existing gate. List opening, return and pull-down refresh read the latest data; paging cursor is only reused under the same query condition. Figma's quantity label is changed to loaded quantity or does not display the total to avoid implying a total quantity not provided by the API.
3. The avatar/member preview of the list and details will only be displayed when the server provides real visible information. The existing contract only has the room host nickname and no pre-movement member list; uses the room host initials as a recognizable downgrade and does not treat the sample avatar in the design draft as user data. The current product only defines English-speaking rooms, but there is no room language field, so the "All/English/Chinese" design control is not disguised as an effective filter; visual differences enter the acceptance record.
4. The password and rule confirmation are placed in the memory process state of the `join` feature and bound by `roomId`. The password page only verifies the 4-digit format, and the correctness can only be verified by actually joining the interface in the future; refreshing or switching rooms will clear the password. The rule is checked to enter the device check, but the acceptance record is not written to the server in advance.
5. Device check calls Expo's official audio permission capability through a separate platform adapter; Web preview calls the browser microphone capability when the user actively operates. Permission denied, unavailable, and retry after setting return all have clear status. The page does not call `POST /v1/rooms/{roomId}/memberships` because it will occupy the quota if there is a lack of follow-up voice room clients; the entrance button indicates that the next batch of people can only enter after they are connected.
6. Figma Desktop Bridge read and captured 390×844 raw frame: V2 list `115:1197`, V1 details `111:1026`, password `111:1071`, rule `114:2508`, device check `114:2509`. Use existing semantic tokens and Figma icon sources; dynamic room content changes with the API, and is not filled with screenshots of text or avatars.

## Risks / Trade-offs

- [There is no contract for member avatars, total number, and language filtering in the design] → The corresponding content only displays existing real data and records visible differences; to make up for it, privacy and filtering semantics need to be determined separately and OpenAPI updated.
- [The password page in the design implies that you can continue entering the room after entering it] → Currently only checks the format and does not claim that the password is correct; the actual error is returned by the next batch of room entry API.
- [Microphone permission depends on device and browser] → Unit test only verifies state mapping; physical device/emulator permission pop-up window, permanent rejection, audio routing and setting return require device evidence.
- [Room status changes during browsing] → Re-read each time the details are entered; full/end/host reconnection displays the current status of the server, which must still be re-verified by the backend when finally joining.

## Migration Plan

There is no database or API migration in this change. When publishing, keep the original `/ready` entrance for rollback, and then switch the default route for qualified users to `/rooms`; roll back the front end to restore the placeholder page, and the backend room status and membership will not change due to this batch.
