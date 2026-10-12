## Context

See proposal.md. Existing reports require a member target and safety cases assume an accused user. Existing presence is stored per user in Redis; candidate pagination currently occurs before online filtering, and room occupancy checks disagree about terminal rooms. The current page structure retains large desktop-height blank areas. The owner's explicit 2026-10-12 request approves the actions and removal of navigation halos.

## Goals / Non-Goals

Goals: implement genuine room reporting, direct member-report entry, reliable online/idle discovery, and compact existing creation/navigation layouts. Non-goals: inventing an accused host, punitive room decisions, language/category fields or new providers.

## Decisions

Use the existing report route with optional member target. A missing target means a room report; explicit member targets retain existing validation and self-report rejection. Report and SafetyCase targetUserId become nullable, including the case relation and generated response contract. Reusing the case lifecycle retains assignment, audit, snapshots, receipts and atomicity. A separate parallel room-case store would duplicate review/access-control and pagination. Code-first NestJS decorators generate the sole OpenAPI and client.

Room cases show a Room report label; evidence history filters by the same room when no user target exists. User restrictions and account disabling require a non-null target in both UI and transactional server enforcement. Direct-message reports remain targeted and unchanged.

Keep presence truth in Redis and eligibility/occupancy truth in PostgreSQL. Diagnose controlled independent sessions before choosing a correction; fixes MUST not include offline, in-room, restricted, underage, blocked or self users to make the list appear populated. Do not report Redis transport failure as an empty list. Keep cursor discovery complete without silent page truncation.

Preserve original Figma frames. Use existing reporting overlay as the member form target and reconcile room/menu variants through Desktop Bridge. Remove halos as an explicit owner override. Use the existing creation frame's 390×844 geometry; constrain tall desktop web previews while retaining small viewport scrolling, native keyboard-safe opaque actions and three level ranges.

## Risks / Trade-offs

- Nullable accused-user targets could produce unsafe broad evidence queries or sanctions → explicit same-room history filters, zero personal restriction evidence without a target, and transactional sanction rejection with regression tests.
- Old clients assume case targets are strings → deploy generated coordinated clients with the migration; preserve old member request compatibility.
- Redis failure or pagination gaps hide online users → controlled two-session tests, failure states and existing blocking/occupancy boundaries.
- Web evidence cannot establish Android audio/fidelity → retain owner physical-device validation.

## Migration Plan

Additive ALTER COLUMN DROP NOT NULL on Report/SafetyCase targets; make the Prisma case user relation optional. Preserve all existing reports/cases; no rewrite or destructive migration. Run isolated migration/invariant tests and backup/restore release gates before API promotion. If application rollback is necessary, pause new room reports and retain nullable rows; never restore NOT NULL or delete reports. Existing Report context constraints remain intact; clearing a SafetyCase room reference cannot broaden its evidence query. Room report audit targets use the room identifier, while member reports retain the accused member identifier.
