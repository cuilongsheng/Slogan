## Context

Figma `Slogan / 02 UI / Voice Room / Pilot V2 · review` node `115:1425` is a 390×844 speech room visual benchmark; the original does not have a security alert status. Users previously allowed mobile pages that lacked independent frames to inherit the V2 style. The server `GET /v1/rooms/{roomId}/safety-alerts` only authorizes the current room host and returns risk metadata and keyset cursor without content. The LiveKit topic is `slogan.room-safety-alert.v1`, and the internal envelopes are `version: 1` and `type: ROOM_SAFETY_ALERT`.

## Goals / Non-Goals

**Goals:** The current room host sees the controlled risk category, severity, members, time and manual verification prompts; online events trigger queries; room entry, reconnection, and takeover are completed; data is cleared when room host permissions are lost.

**Non-Goals:** does not display hit statements or recordings, does not automatically report/remove/mute, does not change the backend delivery strategy, and does not provide reminders to ordinary members.

## Decisions

1. The real-time packet is only used as a refresh signal. The client verifies the topic, version, type and roomId, and then queries the current authorization list of the server; the fields in the package are not directly regarded as trusted display data. Unknown versions are ignored.
2. The session layer has reminder status. Query only when `phase=active`, `role=HOST`, room switch is on and media connection is available. The list is represented by the HTTP contract generation type; paging is based on the server cursor and is deduplicated by id. Ordinary members do not send reminder inquiries.
3. Clear the reminder when the room host role changes, leaves the room, ends, reconnects, or is rejected by 403, and allows the client that is still the room host to try again. Asynchronous results need to check the session generation and current role again to avoid backfilling of old requests.
4. Add a room host exclusive reminder entrance under the room rules, and the list is presented in the same dark panel as the V2 room. Display controlled metadata and "please manually verify"; give retry for errors, and do not write the risk signal as a confirmed violation. The entrance can still view the empty status when there is no reminder.

## Risks / Rollback

- [Take over competition] → The server serves as the authority source, and the client clears role changes and discards old requests; 403 is also cleared.
- [Real-time packet loss] → Completion from HTTP during room entry, reconnection and low-frequency room refresh.
- [Not drawn reminder status] → Use the confirmed V2 token and layout to record the new status and screenshots relative to the original, and do not claim that the status is 1:1 from Figma.
- Rolling back the mobile version can remove the portal and event monitoring; backend reminder facts are still processed according to the existing retention policy.
