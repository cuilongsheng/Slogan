## Context

Backend active change `implement-post-room-keywords-vocabulary-backend` defines summary access and vocabulary private management; OpenAPI already has `GET /v1/rooms/{roomId}/keyword-summary`, `GET/POST /v1/me/vocabulary-items`, `PUT/DELETE /v1/me/vocabulary-items/{itemId}`. The V2 design language is used when the user confirms the lack of independent frames.

## Goals / Non-Goals

**Goals:** My status after the meeting is visible, explicit single entry, private vocabulary paging filtering and concurrent security management.

**Non-Goals:** does not generate audio/transcription, does not auto-import, does not show entry for non-participants, does not treat keywords as security evidence, does not change room creation or voice consent rules.

## Decisions

1. The entry is only displayed when the history records are `PARTICIPATED` and `ENDED`; the server still makes the final decision. `PENDING` provides manual refresh, `DISABLED/UNAVAILABLE` shows explicit status; only `READY` shows entries.
2. The client UUID is generated when each summary entry is first imported; when the request result is uncertain, the UUID will be used for retries of the same entry. After success, the current page will be marked as added and the entire summary will not be automatically saved.
3. Personal wordbook filter value participates in cursor reset. Edit, collect, delete with `expectedVersion`; 409 retain the editing draft and require the user to actively refresh, without automatically retrying the old version.
4. Uses existing `RoomPage`, V2 theme tokens and 390×844 layout. Fixture screenshot to verify layout and interaction, does not claim 1:1 restoration of independent frame-free pages.

## Risks / Trade-offs

- [Server summary has not been generated or the provider is unavailable] → Display the status accurately and do not forge keywords.
- [Import response lost] → Retry the same request with the same item.
- [Modified by other devices while editing] → Conflict retains the current input and the user decides when to refresh.

## Migration Plan

No API or data migration is involved, and the mobile portal can be rolled back independently. Static checks, unit behavior, 390×844 runtime, iOS JS export and device/provider boundaries are logged separately.
