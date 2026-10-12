# Phase-one completion batch

Approved scope: the 2026-10-11 project audit followed by the owner's instruction to complete development, then run one consolidated acceptance and release cycle. Development starts from main `7b9075bac741eae78d033f9d11bd3775cd0ec65d` on `codex/phase-one-completion`.

## Delivery rules

- Finish all implementation before running tests or deployment. Failed final checks may require focused repairs and revalidation; never publish a known failure.
- Track implementation separately from acceptance. No unexecuted test, cloud check, or device check is PASS.
- Preserve Chinese product support and the frozen `docs/init/PRD_V1.md`. Documentation and comments remain English.
- WeChat, email registration/recovery, expression assistance, room speech processing, and iOS remain deferred. Do not enable them as part of this batch.
- Physical Android verification remains owner-operated. Supply a matching APK and concrete device checks.

## 1. Partners, conversations, and direct calls

- [x] Read original Desktop Bridge design targets and record states, assets, and geometry.
- [x] Complete missing high-fidelity targets without modifying existing approved frames.
- [x] Connect all four navigation destinations; show only eligible online idle partners.
- [x] Add persistent pair conversations, per-user visibility/read boundaries, messages, and forward-compatible migration.
- [x] Implement participant-only paginated history, stable idempotent sends, unread state, and personal deletion.
- [x] Enforce qualification, bilateral blocking, stranger anti-abuse limits, and private message reporting.
- [x] Implement recent conversations, friends entry, chat, retry, reporting, and blocking UI against generated API types.
- [x] Implement request/accept/reject/timeout/end for independent two-party voice sessions; enforce room/call mutual exclusion.
- [x] Persist media cleanup and recovery; reject third-party, blocked, restricted, expired, and terminated credentials.
- [x] Implement incoming/outgoing call, microphone, disconnect, reconnect, and end states.

## 2. Profile and localization

- [x] Provide a safe default avatar so missing provider pictures cannot block onboarding.
- [x] Implement bounded authenticated avatar selection/storage and replacement.
- [x] Keep gender/city/birth optional and retain explicit adult confirmation.
- [x] Add persisted manual Chinese/English selection using device language only as the initial default.
- [x] Preserve the three primary Me actions and follow existing design tokens for supplementary settings.

## 3. Cloud execution

- [x] Repair and consolidate durable realtime recovery, with local retry/fencing tests.
- [ ] Verify the deployed queue wakeup topology and terminal cloud cleanup.
- [x] Move API-dependent safety and maintenance scheduling off request-local timers for Vercel.
- [x] Supply explicit managed scheduling for enabled operations, alert dispatch, and retention work.
- [ ] Verify configured cloud scheduling and alert destination delivery.
- [x] Keep disabled audio/provider workers disabled and document their deployment boundary.

## 4. Security and release infrastructure

- [x] Make OAuth exchange/refresh limits shared across API instances, with explicit outage behavior.
- [x] Add backend, contract, migration, admin, and mobile CI gates for PR/main release.
- [x] Add controlled production backup/migration steps; previews must not migrate production.
- [x] Add and execute isolated encrypted restore, content and invariant verification.
- [ ] Record production recovery and alert delivery evidence.
- [x] Preserve additive schema rollback and durable user content.

## 5. Documentation and OpenSpec

- [x] Synchronize approved private messaging/calls/discovery/blocking and phase-one specifications; update architecture/capability/deployment documentation.
- [x] Update English/Chinese README capability and availability statements.
- [x] Review archive candidates and retain unresolved provider/device/superseded-flow changes with explicit reasons in the acceptance record. No incomplete acceptance was relabeled complete.

## 6. Consolidated acceptance and release (after sections 1–5 implementation)

- [x] Run formatting, dependency boundaries, lint, types, contract/client generation checks, builds, and affected tests.
- [x] Run schema upgrade and isolated restore tests, permission/concurrency/idempotency tests, and browser flows.
- [x] Compare original Figma and final Web runtime screenshots at matching viewports and states; retain native fidelity as an owner check.
- [ ] Commit/push the complete batch and open/attach a PR; wait for required CI.
- [ ] Apply guarded production migrations and release main once verification succeeds.
- [ ] Verify online API/Pages commits, Google onboarding, shared rate limits, and cloud cleanup/recovery.
- [ ] Publish matching Android APK, verify download bytes/signing/hash, and provide owner device checklist.

## Current status

Local consolidated verification and focused repairs are complete. [Acceptance record](../acceptance/phase-one-completion/README.md) contains the executed tests, 17 original/runtime screenshot pairs and isolated recovery evidence. Production schema and application deployment have not changed in this batch. GitHub Production has been restricted to main; production credentials and release/provider/device evidence remain pending. Commit and PR delivery are recorded below when performed.
