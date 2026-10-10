## Why

`PRD_V1.md` also contains confirmed rules, version routes, suggestions, pending issues, and project background, and cannot be safely used directly as an entry point for ongoing maintenance. This migration establishes an auditable requirements baseline, allowing subsequent changes to be managed through OpenSpec while retaining historical traceability of the original PRD.

## What Changes

- Create an itemized classification list for `PRD_V1.md` content, distinguishing confirmed requirements, future roadmap, unresolved decisions and historical context.
- Only write candidate delta specs that are explicitly confirmed and fall within the scope of the current delivery of `0.0.1`.
- Leave suggestions, conflicts, and missing boundary items as unresolved and do not use MUST/SHALL statements.
- Reserve `0.0.2`, `0.0.3`, `0.1.0` and V2 directions as roadmap and do not become current requirements in advance.
- Do not synchronize candidate specs, do not freeze `PRD_V1.md`, and do not switch source of truth before user review.
- Execute sync, freeze mark and baseline migration archive separately after user approval.

## Capabilities

### New Capabilities

- `identity-and-profile`: Login, first time information, age boundary and access prerequisites.
- `localization-and-room-rules`: Chinese and English selection and confirmation of behavioral rules before entering the room.
- `instant-room-discovery`: Instant room creation, discovery, capacity and eligibility to join.
- `voice-session`: LiveKit voice session, default mute, reconnect and end behavior.
- `host-controls`: room host removal, invitation, active handover and disconnection timeout handover.
- `basic-safety-reporting`: Basic reporting, auditing events and server-side security boundaries.

### Modified Capabilities

<!-- The current main specs is empty, and this migration does not modify the existing capabilities. -->

## Impact

- Requirements governance: Establish the first batch of candidate OpenSpec requirements, but do not write `openspec/specs/` before Review.
- Document governance: Define PRD freezing, authoritative source switching and history tracing rules.
- Delivery process: Establish the authority and responsibility boundaries of the six-stage project-level lifecycle and OpenAPI/Figma/verification.
- Agent working method: Initialize the official OpenSpec Codex Skills and add the only project Skill `voice-room-figma-to-frontend`.
- Business code, database, API and UI: not modified this time.
