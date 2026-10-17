## Why

Room host removal, reinvite, exit handover, and disconnection takeover rely on trusted real-time presence, but should not be mixed with LiveKit credentials, webhooks, and provider infrastructure in the same implementation unit. As confirmed by the product owner, the member life cycle and room host management in the original LiveKit proposal will be split into independent changes, and will be implemented and accepted item by item after the real-time basis is completed.

## What Changes

- Provides ordinary members with the ability to leave and rejoin voluntarily; release capacity and queue to the end of the current slot when re-entering.
- Implement room host removal of members, re-invitation and blocking of old credentials; invitations are still subject to account, room and capacity constraints, and no seats are reserved.
- Implement the room host's active exit: specify an online successor, or take over by default in the order in which current online members join; if there is no successor, the room will end.
- Implement a 60-second reconnection window for abnormal room host disconnection: existing members continue to communicate and resume sessions, and new joins are suspended; the reserved room host is restored on time, and is transferred or ended after timeout.
- Provides room host active end interface, reusing the end state machine, undo and cleanup process of the preceding change.
- Verify the current room host on the server side, atomically save domain status, manage audits and provider commands, and cover concurrency, repeated requests, late events and failure compensation.

### Confirmed Scope

- Implement the backend rules of current `host-controls` and the corresponding management action audit and server permissions in `basic-safety-reporting`; retain the confirmed ordinary members to re-enter the last position, the disconnection window to suspend new additions, and the expiration no grace rules.
- Depends on the verified implementation of `implement-livekit-voice-session-backend`. The preceding change is still planned, and the existence of the directory or the existence of the task file is not regarded as dependent completion.
- This change has four new endpoints: leave, removals, invitations, and host end; it extends the existing join, member list, and credential authorization. Credential issuance, basic endpoint of member query, Webhook, provider adapter, audit/outbox basics, and expiration cleanup are uniquely implemented by prefix change.
- This time only the planning split is approved; the two changes are reviewed, applied, and verified respectively. Identity and authentication change Uncompleted acceptance items retain their original ownership and will not be automatically accepted or archived here.

### Non-goals

- Do not add a second set of LiveKit adapter, Webhook, Redis queue, audit table or end state machine.
- Does not implement Figma, front-end admin panel, online member selector UI, mobile device permissions, or audio acceptance.
- Does not implement automatic processing or production deployment of report submission, safety officer punishment, recording, transcription, account session restrictions.

### Future Roadmap

- `implement-safety-reporting-backend` will be independently promoted after this change.
- Press the confirmed Figma access management interface on the front end to add evidence of dual devices, disconnection and actual audio.

### Unresolved Decisions

- Non-blocking product decisions for this split. LiveKit Cloud's old certificate revocation capability still requires the change's real provider smoke proof, and will not become verified due to splitting.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `host-controls`: Move the last rule in the original LiveKit delta that ordinary members re-enter after leaving into this change; other existing room host rules are implemented directly without repeated rewriting requirements.
- `voice-session`: Move the rules in the original LiveKit delta that allow existing sessions to continue and suspend new joins in the room host reconnection window into this change; the room expiration and end rules still belong to LiveKit delta, and the two changes do not modify the same Requirement.

## Impact

- Impacted delivery stages: Architecture、Backend / API、Test / Acceptance。
- Affects `apps/api/src/modules/rooms`'s lifecycle, room host policy, public application API, repository, Controller/DTO, and room host management access to `voice`'s existing event/worker orchestration.
- Use independent additive migration to add member departure/removal/invitation status and room host disconnection deadline/version; reuse the previous RoomEvent, RealtimeCommand and provider identity history.
- NestJS code-first generates `openapi/openapi.yaml`, maintaining a unique contract; new management errors and responses, join/rejoin and member projection behaviors all have contract verification.
- Implementation sequence: LiveKit basic implementation and delivery of dependency evidence → this change → security report. Can be reviewed and verified separately; before room host management is completed, the real-time basis is only for controlled integration verification and will not be released as a complete voice room product.
