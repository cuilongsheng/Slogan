## Why

The current room backend has a joining relationship, but there is no report record that can be submitted and tracked. Members' reports need to be saved as independent facts and related to key room events; members can still report after they leave, are removed, or the room ends, to avoid reporting qualifications disappearing with the room status.

## What Changes

- Added a basic report submission interface with identity authentication, saving the room, reporter, reported person, server submission time, category and text description, and returning the minimum submission credentials.
- Allow current and historical members to report other members who have joined the same room; whether both parties have joined is verified by the server-side persistent membership and cannot be determined by client statements or LiveKit online status.
- Five fixed categories are used: harassment and abuse, discrimination and hatred, pornography and vulgarity, spam advertising, and others.
- Report records and report submission audits are saved atomically, and safe retry of the same request is supported; the report content will not be entered into the general log or notified to other members.
- Complete the unique OpenAPI contract, migration verification, permission and concurrency testing, and backend acceptance records.

### Confirmed Scope

- The user confirmed on 2026-09-12 that the proposal was created first, covering report submission, persistence, permission verification and report auditing; it also confirmed historical member reports and the above five fixed categories.
- Historical qualifications include members who have voluntarily left, been removed, and members who have ended the room. Identity authentication continues to follow the existing valid session and account status rules, and does not change the login or account restriction policy.
- Reports only record user statements, no violations are identified, and no penalties are implemented; room host follows the same reporting rules as ordinary members.
- Implementation details proposed using UUID request identifiers, limited length text descriptions, server time, and transaction auditing are reviewed along with this proposal.

### Non-goals

- The mobile reporting portal, Figma page, administrator or safety officer interface, reporting query/modification/withdrawal interface, case assignment, processing status transfer or reporting notification are not implemented.
- No penalties, bans, blocks, account restrictions, room bans/restorations, appeals, STT risk identification, recordings or complete transcriptions.
- No duplication of implementation of room host management, real-time credentials, member lifecycle, or LiveKit webhooks.
- No production deployment, data cleansing strategy, or final mobile/physical device acceptance performed.

### Future Roadmap

- Subsequent independent changes will determine the background restricted query and processing procedures, anti-abuse rate limiting parameters, data retention and deletion strategies; these directions in the historical PRD will not be converted to current requirements this time.
- The front-end change is responsible for the reporting portal, historical member selection and feedback submission, and is implemented in accordance with Figma and the OpenAPI contract generated this time.

### Unresolved Decisions

- There is no business selection to be confirmed in the current submission closed loop. The retention period, reporting frequency limit and review process belong to the subsequent scope and will not be set as default business rules this time.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `basic-safety-reporting`: Clarify historical membership, fixed categories, server identity and time, idempotent submission, reporting and auditing atomic preservation and private response boundaries; retain existing room events and real-time credential requirements.

## Impact

- Impacted delivery stages: Architecture、Backend / API、Test / Acceptance。
- Mainly affects `apps/api/src/modules/moderation`, rooms’ public reporting qualification query, audit’s transaction write boundary, Prisma model/migration, log security test and `openapi/openapi.yaml`. Continue to use NestJS code-first to deterministically generate unique contracts.
- Added `POST /v1/rooms/{roomId}/reports`; no need to add external services or running dependencies, and no need to call LiveKit/Redis to handle reports.
- The implementation sequence is `implement-livekit-voice-session-backend` → `implement-host-controls-backend` → this change. LiveKit provides RoomEvent and real-time basis, and room host management provides leaving, removal, re-invitation and management auditing of historical memberships; both are currently proposals to be implemented, and planning documents cannot be regarded as delivered dependencies.
- Proposals can be reviewed first; pre-code, migration and back-end testing must be verified before applying. If the actual public interface is different from this design, coordinate the interface design of this change first, and do not use this change to make up the entire set of real-time capabilities.
- This time only the planning file is created, the main specs are not synchronized, the business code is not modified, archived or declared deployed.
