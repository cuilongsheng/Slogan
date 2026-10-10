## Context

The current `room-history-notes` specification and OpenAPI have given my paging history, as well as the version agreement of `GET/PUT /v1/rooms/{roomId}/note`. The mobile personal portal and V2 `RoomPage` have been established. The user allows this page to follow the V2 style, and there is no independent Figma frame for 1:1 comparison.

## Goals / Non-Goals

**Goals:** True personal history, relationship classification, private note editing and clearing, conflict protection.

**Non-Goals:** does not provide recordings, transcriptions, AI summaries, re-entry qualifications, or notes from other members.

## Decisions

1. The `/me/history` list uses the existing `authorized` and generated clients to directly display personal historical facts. Only records of `PARTICIPATED` and `ENDED` display the private note entry and request notes after entering; other records have no note entry.
2. Note editing keeps `draft`, server-side `version` and `savedContent` separate. Save fails and retains the draft; version conflicts display clear prompts and "load latest" operation, and only the user clicks to overwrite the draft. Clear still commits empty string and current version.
3. Visually follows the V2 warm white, purple main operation, rounded corner information card and 390×844 layout; uses deterministic fixture screenshots to verify the layout, and does not claim independent frame 1:1.

## Risks / Trade-offs

- [The saving result is uncertain when offline or the response is lost] → Not optimistic about success; keep the draft before re-reading the server version.
- [History read permission and note write permission are different] → The entry will only appear when the front end meets the conditions, and the server will continue with the final decision.
- [Multi-device version conflict] → Do not automatically retry old versions, nor silently overwrite user text.

## Migration Plan

No API or data migration. Can independently roll back the mobile routing and entry. The acceptance needs to cover paging, appointment relationships, note version conflicts, 390×844 Web screenshots and iOS JS export; physical device interaction and real account content are recorded separately.
