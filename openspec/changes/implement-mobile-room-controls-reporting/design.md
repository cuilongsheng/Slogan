## Context

Figma 114:2510 is the member management page; 111:882, 111:906, 111:872, and 111:842 are invitation, room host exit and takeover, removal confirmation and reporting overlays respectively. Uninstalling the voice page will disconnect LiveKit, so the user interface must retain the current voice session.

## Decisions

1. The member list is sorted by server position; room host can remove other ACTIVE members, and ordinary members can report others. Room host can also be reported.
2. `successorMembershipId` that leaves the room and takes over the existing `/leave`; only the non-room host ACTIVE members of the current CONNECTED are listed. If not specified, the server's default second microphone can still be used.
3. Member removal/re-invitation carries the current `credentialVersion` and will be refreshed after success; conflict prompts to re-acquire the member status. The server `/members` only returns ACTIVE, so `/rooms/{roomId}/removed-members` is added that is only readable by the current room host and returns the smallest removed member identity and version for re-invitation.
4. Ordinary invitation candidates are provided by `/v1/people/available` and friend API, and are still reviewed by the server when sending. The invitation does not reserve a quota.
5. Reported using a one-time UUID as clientRequestId, retrying the same submission after network failure keeps UUID and content; swapping UUID when changing target, category or description. If successful, only the acceptance number will be displayed and will not be broadcast in the room.
6. The existing member response does not have the targetUserId required for reporting. Only add `userId` to the ACTIVE member list for callers who have passed the same room membership verification, and continue to independently verify historical membership by the reporting endpoint; do not expose member IDs to public sharing code responses.
7. The removed member read interface verifies the membership status of the current room host and the valid room host in the database lock, and only returns the removed members of the room; the new room host can be managed after the transfer, and the old room host loses its rights immediately.

## Risks and rollback

- The member list/role may change during operation: server-side verification is the final permission boundary, refresh and prompt when 409 occurs.
- The report body is sensitive: it is only submitted to the existing reporting endpoint and is not recorded in the log or client-side persistent storage.
- The visible range of member user IDs is expanded: the existing `members` permission check is retained, and the new field only appears in the response of the authentication and is still a member of the same room; rollback removes this field and the front-end reporting target entrance.
- Web operation and layout are verifiable; dual-device LiveKit disconnection and old credential rejection after removal still require real device and Cloud acceptance.
