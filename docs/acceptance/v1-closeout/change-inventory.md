# Active change reconciliation —2026-10-17

This inventory separates remaining task records from missing product code. Source baseline d532f7f and released runtime dd02891/Android0.0.127 were checked before this closeout. Two completed changes were archived after exact spec/release comparison. The owner reported physical-device testing complete and stopped all further agent device debugging; that is owner evidence, not fabricated automated checks or new native Sentry canaries.

No checkbox below is automatically marked complete because a later build passed. Provider-disabled email/SMS/WeChat/STT/AI capabilities remain as previously reviewed. The frozen historical PRD is unchanged.

| Active change | Completed / total | Remaining disposition |
| --- | --- | --- |
| `add-android-in-app-update` | 5/8 | Implementation released or revised; current web/build evidence and owner-reported device acceptance must be reconciled against each remaining criterion. Do not invent per-scenario device results. |
| `add-email-password-auth` | 5/6 | Historical change with remaining cross-change acceptance/release reconciliation; retain until every applicable criterion has evidence or an explicit accepted limit. |
| `add-partner-discovery-direct-conversations` | 7/18 | Historical change with remaining cross-change acceptance/release reconciliation; retain until every applicable criterion has evidence or an explicit accepted limit. |
| `add-preview-experience-accounts` | 16/24 | Historical change with remaining cross-change acceptance/release reconciliation; retain until every applicable criterion has evidence or an explicit accepted limit. |
| `add-production-observability` | 29/37 | Active closeout: monitored production release, browser source location, native monitoring-specific gap, shared pause/reseed and external operations. |
| `add-public-trial-accounts` | 8/11 | Historical change with remaining cross-change acceptance/release reconciliation; retain until every applicable criterion has evidence or an explicit accepted limit. |
| `compact-me-page-layout` | 2/3 | Implementation released or revised; current web/build evidence and owner-reported device acceptance must be reconciled against each remaining criterion. Do not invent per-scenario device results. |
| `compact-social-list-layout` | 2/3 | Implementation released or revised; current web/build evidence and owner-reported device acceptance must be reconciled against each remaining criterion. Do not invent per-scenario device results. |
| `complete-phase-one-release` | 12/15 | Historical change with remaining cross-change acceptance/release reconciliation; retain until every applicable criterion has evidence or an explicit accepted limit. |
| `implement-account-access-lifecycle-backend` | 46/47 | Provider/feature acceptance remains deferred under the previously approved disabled V1 configuration. |
| `implement-appointment-room-backend` | 16/17 | Cloud provider checks now have partial new evidence; public webhook/business deadline acceptance remains distinct. |
| `implement-email-password-auth-backend` | 17/18 | Provider/feature acceptance remains deferred under the previously approved disabled V1 configuration. |
| `implement-host-controls-backend` | 20/21 | Cloud provider checks now have partial new evidence; public webhook/business deadline acceptance remains distinct. |
| `implement-livekit-voice-session-backend` | 21/22 | Cloud provider checks now have partial new evidence; public webhook/business deadline acceptance remains distinct. |
| `implement-mobile-auth-profile` | 14/15 | Historical change with remaining cross-change acceptance/release reconciliation; retain until every applicable criterion has evidence or an explicit accepted limit. |
| `implement-mobile-expression-assistance` | 5/6 | Provider/feature acceptance remains deferred under the previously approved disabled V1 configuration. |
| `implement-mobile-room-controls-reporting` | 7/8 | Historical change with remaining cross-change acceptance/release reconciliation; retain until every applicable criterion has evidence or an explicit accepted limit. |
| `implement-mobile-room-creation` | 6/7 | Historical change with remaining cross-change acceptance/release reconciliation; retain until every applicable criterion has evidence or an explicit accepted limit. |
| `implement-mobile-room-sharing-extension` | 4/5 | Historical change with remaining cross-change acceptance/release reconciliation; retain until every applicable criterion has evidence or an explicit accepted limit. |
| `implement-operations-data-governance-backend` | 53/54 | Active closeout: target sink/recovery, scheduled cleanup and timed encrypted restore evidence. |
| `implement-post-room-keywords-vocabulary-backend` | 48/49 | Provider/feature acceptance remains deferred under the previously approved disabled V1 configuration. |
| `implement-room-sensitive-speech-detection-backend` | 46/48 | Provider/feature acceptance remains deferred under the previously approved disabled V1 configuration. |
| `make-profile-details-optional` | 6/11 | Historical change with remaining cross-change acceptance/release reconciliation; retain until every applicable criterion has evidence or an explicit accepted limit. |
| `normalize-mobile-control-height` | 4/5 | Implementation released or revised; current web/build evidence and owner-reported device acceptance must be reconciled against each remaining criterion. Do not invent per-scenario device results. |
| `polish-room-usability` | 7/8 | Historical change with remaining cross-change acceptance/release reconciliation; retain until every applicable criterion has evidence or an explicit accepted limit. |
| `replace-main-list-polling-with-sse` | 17/18 | Historical change with remaining cross-change acceptance/release reconciliation; retain until every applicable criterion has evidence or an explicit accepted limit. |
| `simplify-direct-room-entry` | 9/10 | Historical change with remaining cross-change acceptance/release reconciliation; retain until every applicable criterion has evidence or an explicit accepted limit. |
| `simplify-room-and-mobile-experience` | 17/28 | Historical change with remaining cross-change acceptance/release reconciliation; retain until every applicable criterion has evidence or an explicit accepted limit. |

Inventory: 28 active changes, 522 task records, 73 unchecked tasks. These totals are a documentation inventory, not a claim that every unchecked task is a V1 blocker.
