## Why

Currently, "Discovery" at the bottom already carries a list of public voice rooms. The "room" entrance has semantic overlap with it, and the existing prototype lacks idle user discovery and session entrances. The product leader has confirmed that users can have persistent text chats with idle people and 1-on-1 voice chats that need to be accepted by the other party; this exceeds the current social scope that only supports room invitations. Permissions, privacy and interaction must be clarified first, and then the high-fidelity design can be expanded.

## What Changes

- Keep "Discover" as the public room list; change the second entrance to "Find Partners" to display users who meet the existing availability/privacy rules. The current room host can invite users to enter its room from here, and individual chats can be initiated in other scenarios.
- “Messages” displays existing conversations and friend entries; text conversations can be started from qualified idle users, and text messages and conversation history are retained across logins.
- 1-to-1 voice adopts a request-accept process; media credentials shall not be issued or voice connected before acceptance. The text does not require the other party to accept it first, but it must comply with blocking, account and security restrictions.
- Design the minimum anti-harassment, reporting and blocking process for stranger messages; room invitations continue to use the current room host permissions and capacity verification.
- **BREAKING (Product Range)**: The historical V1 baseline explicitly excludes private messages; only after this change is reviewed and approved will single chat be included in the current requirements. Frozen `docs/init/PRD_V1.md` must not be overwritten.

### border

- Does not include group chats, updates, gifts, videos, attachments, voice recordings or automatic transcription.
- Do not disguise text private messages, 1:1 calls, or friend lists as existing multiplayer rooms; shared real-time service capabilities do not equal shared room business rules.

## Capabilities

### New Capabilities

- `partner-discovery`: Visibility and permissions of the bottom entrance, idle partner list, room host invitation and single chat entrance.
- `direct-messaging`: Persistent 1 to 1 text conversation, message list, history, sending eligibility and minimum security boundaries.
- `direct-voice-calls`: 1 to 1 voice request, accept/reject, media qualification, end and exception status.

### Modified Capabilities

- `user-blocking`: Two-way blocking extends to single chat discovery, text sending and voice request/connection.

## Impact

- `01 Prototype` and `02 UI`: bottom navigation, finding partners, messages, conversations, voice requests and corresponding empty/error/restricted status; first review low-fidelity, then expand high-fidelity.
- `apps/api/src/modules/social/`, real-time voice adaptation layer, PostgreSQL/Prisma, Redis temporary call status and `openapi/openapi.yaml`; add persistent messages and call life cycle to avoid duplicating existing room service aggregation.
- `apps/mobile/`’s new routing, session status, permission feedback and notification portal; existing mobile applications currently only have a startup page and basic framework, and Figma links cannot be regarded as implemented functions.
- Affected stages: Architecture, Prototype / Figma, Backend / API, Frontend, Test / Acceptance, Deployment. Persistence migration, message abuse protection, real-time resource recycling and release rollback all need to be verified.
