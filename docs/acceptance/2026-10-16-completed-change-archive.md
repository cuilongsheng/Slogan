# Completed-change archive review

Date: 2026-10-16 (Asia/Shanghai). Source: main `0f9fcde910f4f2c8acfc4d95ee934696184210e1`.

The owner confirmed that the current disclosed state had been reviewed, requested preserving it, and authorized archiving other completed changes. This records acceptance of the existing evidence boundaries; no new business behavior, provider enablement, test result, device result or deployment is asserted.

## Selection

Eight changes have complete task lists. `implement-identity-profile-backend` has complete implementation and automated evidence; its remaining owner-review task is closed by this explicit review. Changes with other unfinished tasks remain active, including observability and the current shared-event release. Deferred feature/provider work is not relabeled complete.

| Change                                    | Archive basis                                                                                             | Delta treatment                                                                                                                                                                                           |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| add-api-sentry-tracing                    | Six completed tasks; API and actual cloud tracing evidence, compatible delivery and main integration      | Sync the two product requirements; preserve the original Purpose. The initial local-only delivery scenario stays historical in the archive because later explicit delivery authorization superseded it.   |
| fix-room-reporting-and-discovery          | Nine completed tasks; reporting/discovery acceptance and room-experience release                          | All three capability deltas already match current main requirements.                                                                                                                                      |
| implement-mobile-room-discovery-join      | Eleven completed tasks; original frontend acceptance with disclosed device/provider limits                | Historical delta retained without resync: mandatory detail/rules/device pages were superseded by current direct-room-entry requirements.                                                                  |
| implement-mobile-room-processing-consents | Five completed tasks; local consent tests and acceptance, provider activation still deferred              | Historical delta retained without resync: the device-preparation sequence is superseded; current purpose/version consent and direct-entry recovery requirements remain authoritative.                     |
| implement-mobile-room-safety-alerts       | Five completed tasks; local host-only alert and role-cleanup acceptance, Cloud/STT/device limits retained | Sync the mobile presentation requirements; no provider enablement or Cloud/device PASS is implied.                                                                                                        |
| implement-mobile-voice-room-session       | Thirteen completed tasks; original session/runtime acceptance, physical audio limits retained             | Historical delta retained without resync: equipment prerequisites and terminal pages were superseded by direct-room-entry and immediate-exit requirements.                                                |
| optimize-room-entry-and-immediate-exit    | Seven completed tasks; room-entry-lifecycle evidence and verified room-experience release                 | Both capability deltas already match current main requirements.                                                                                                                                           |
| streamline-main-pages-and-live-updates    | Nineteen completed tasks; startup/empty-cursor and main-page acceptance, disclosed device limits          | Historical delta retained without resync: its five-second invitation polling is superseded by the approved shared mobile-event channel. Current layout and live-update requirements remain authoritative. |
| implement-identity-profile-backend        | Twenty implementation/evidence tasks plus the owner's current review                                      | skip_specs was already declared; current identity-and-profile and later phase-one requirements remain unchanged.                                                                                          |

All archived change files, including .openspec.yaml, original delta specs and historical evidence boundaries, are retained. Archive dates do not assert a new production release. Relative Markdown links are adjusted only to preserve their existing targets after the directory move.

## Current authorities retained

- `openspec/specs/direct-room-entry/spec.md` owns direct admission and immediate exit.
- `openspec/specs/mobile-event-channel/spec.md` and `main-page-live-updates/spec.md` own current foreground event delivery and recovery.
- `openspec/specs/temporary-speech-processing/spec.md` and `room-sensitive-speech-detection/spec.md` retain consent, privacy and host-only boundaries.
- `openspec/specs/identity-and-profile/spec.md` and `phase-one-release/spec.md` retain optional details, adult confirmation and current release scope.

The four superseded deltas are intentionally archived without synchronization under the owner's preserve-current-state instruction. They are not described as synced, and their historical instructions must not be reapplied as current requirements. The original Chinese Purpose of api-sentry-monitoring is preserved verbatim as required by the archive workflow; the normalized current requirements are English.

## Verification

- Before editing: strict validation passed all 80 active change/spec items.
- After synchronization and archival: strict validation passed all 73 current items (43 specs and 30 remaining active changes), with zero failures. Existing long-requirement informational notices are unchanged.
- Nine archives preserve all 46 original files. Eight original .openspec.yaml files are unchanged; streamline-main-pages-and-live-updates had no metadata file originally, so none was fabricated. All nine archived task lists are complete; only the explicitly accepted owner-review task was newly checked.
- The two already-synced changes still match all five affected main-spec capability files. The safety-alert delta matches its new main requirements exactly. Both API monitoring product requirements are present with bounded sampling, privacy and response compatibility intact; the superseded initial local-only delivery instruction remains in the historical delta.
- All 41 pre-existing main-spec files remain byte-identical. Two current spec files were added; no existing requirement, business code or release configuration was changed.
- Two relative Markdown links in the moved identity design were adjusted to preserve their original targets. Original delta contents, historical test outcomes and provider/device limits are retained.
- Scoped Markdown formatting and git diff checks passed. No application test, provider action or deployment was performed for this documentation-only archive operation.
