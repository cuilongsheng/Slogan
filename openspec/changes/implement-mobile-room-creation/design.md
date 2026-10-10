## Context

The instant creation API accepts a single CEFR level A1–C2, while Figma uses the B1–B2 example range; the front end must let the user select a specific level and cannot secretly downgrade the user. Figma uses "public room/4-digit password" as the joining method, and OpenAPI's visibility and password are independent.

## Decisions

1. Retain Figma’s page hierarchy, light purple/light blue/light peach setting card, capacity capsule and bottom purple operation button. Levels use specific A1–C2 options; visibility and password are selected separately, and differences from the original are recorded in acceptance.
2. The real-time mode calls /v1/rooms, and the reservation mode calls /v1/appointment-rooms. The reservation time is first checked on the front end, and then finally confirmed by the server. Secure speech recognition and post-meeting keyword keeping API are turned off by default and not enabled secretly.
3. API requests are submitted by features/room-creation/api.ts through existing authorization packaging and generation clients; DTOs are not repeatedly defined. Button disabled during submission, form retained on failure. The successful result comes from the server, and the room ID is not guessed locally.
4. The instant room host is created successfully and has current HOST membership, and navigates to the voice room; the reservation is successfully navigated to the reservation room details, and the real result is retrieved via /v1/appointment-rooms/{roomId}. There is currently no independent Figma frame for this detail. Use the visual language of the confirmed room page to record the design coverage differences. The focus refresh of the return instant room list can read the server status.
5. The reservation details provide a second confirmation cancellation command to the room host, and the server status is retrieved after success. The shared code path `/r/{shareCode}` first calls the public `/v1/room-links/{shareCode}`, and then opens the instant or reservation details according to the room type; the local `ROOM_SHARE_BASE_URL` points to this path.

## Risks and rollback

- The local time zone of the reservation time is inconsistent with the UTC of the server: the form is converted to ISO on the client, and the server still performs qualification and time window verification; the error remains as is.
- The API has been created but the network response is lost: automatic retry of non-idempotent POST is prohibited; the user is prompted to return to the room list for confirmation, and does not declare that it must fail. Rollback only removes entries and pages, but does not migrate data.
- Web preview verifies form and API; voice connection and microphone still need to be developed and built/physical device proven.
