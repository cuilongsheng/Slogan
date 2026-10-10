# Completed change batch archiving records

2026-10-10。 User authorization to archive completed changes directly while keeping app testing, deployment, and APK updates paused. This time the OpenSpec document is processed in the `codex/in-app-partner-invitations` integrated work tree; no business code is modified, application testing is performed, submitted, pushed or deployed.

## Archived

The planning artifacts of the following 10 changes are all `done` or declared `skipped`, and all tasks are checked. Combined with the existing implementation and acceptance records to confirm the delivery boundary of this batch, the task of recording device/provider restrictions was not upgraded to the real environment acceptance pass. Archiving is the end of the original delivery scope and does not mean that subsequent needs or current repairs have been completed.

| Change                                | Mission completed | Archive path                                                                                | Acceptance record                                                              |
| ------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| implement-mobile-app-foundation       | 5/5               | [archive](../../openspec/changes/archive/2026-10-10-implement-mobile-app-foundation/)       | [Engineering Fundamentals](implement-mobile-app-foundation.md)                 |
| implement-admin-workspace             | 14/14             | [archive](../../openspec/changes/archive/2026-10-10-implement-admin-workspace/)             | [Admin workbench](implement-admin-workspace.md)                                |
| add-admin-room-filters                | 5/5               | [archive](../../openspec/changes/archive/2026-10-10-add-admin-room-filters/)                | [Background filtering](add-admin-room-filters.md)                              |
| implement-mobile-email-password-auth  | 8/8               | [archive](../../openspec/changes/archive/2026-10-10-implement-mobile-email-password-auth/)  | [Password authentication front-end](implement-mobile-email-password-auth.md)   |
| implement-mobile-room-history-notes   | 4/4               | [archive](../../openspec/changes/archive/2026-10-10-implement-mobile-room-history-notes/)   | [History and Private Notes](implement-mobile-room-history-notes.md)            |
| implement-mobile-post-room-learning   | 4/4               | [archive](../../openspec/changes/archive/2026-10-10-implement-mobile-post-room-learning/)   | [Post-session learning and vocabulary](implement-mobile-post-room-learning.md) |
| implement-mobile-safety-appeals       | 4/4               | [archive](../../openspec/changes/archive/2026-10-10-implement-mobile-safety-appeals/)       | [Restrictions and Appeals](implement-mobile-safety-appeals.md)                 |
| implement-mobile-social               | 4/4               | [archive](../../openspec/changes/archive/2026-10-10-implement-mobile-social/)               | [Already have social foundation](implement-mobile-social.md)                   |
| implement-pages-same-origin-api-proxy | 6/6               | [archive](../../openspec/changes/archive/2026-10-10-implement-pages-same-origin-api-proxy/) | [Same origin proxy](pages-same-origin-api-proxy.md)                            |
| automate-android-release-delivery     | 8/8               | [archive](../../openspec/changes/archive/2026-10-10-automate-android-release-delivery/)     | [Automatic delivery](automate-android-release-delivery/README.md)              |

## Master spec synchronization and integrity

- `implement-mobile-app-foundation` declaration skips delta spec and files as is.
- The remaining 9 changes synchronize 9 new capabilities and 24 new requirements; `friend-relationships` modifies 1 requirement, adds the public nickname scenario of the personal request list, and retains the original three state transition scenarios and the other four requirements.
- The Render-only copy of the agent delta has been aligned with the existing `scripts/pages-api-proxy.mjs` and [2026-10-07 Release correction](../releases/2026-10-07-vercel-pages.md): retaining the single-layer Render origin, patching in the approved fixed `slogan-api-pi.vercel.app`; no release of any Vercel projects or changes to the runtime configuration.
- The description of the main spec’s Purpose has been completed, and the delta operation title or TBD placeholder is not retained. Strict document verification initially found that four Purposes were too short. After completion, `openspec validate --specs --strict --no-interactive` became **31 passed / 0 failed**. This is a document structure check, not an application test.
- Item-by-item review of all delta requirements before move has been synchronized; file-by-file SHA-256 after move is the same as the list before move, including `.openspec.yaml`. Archive path has no collision. 23 active changes remain after 10 archives.

## Keep active change

Although the following four tasks are all checked, they are not suitable for archiving yet; their task status has not been changed this time:

| Change                                    | Reason for retention                                                                                                                                                                                                      |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| implement-mobile-room-discovery-join      | The latest list layout, direct entry and equipment prompt requested by the user are still in the return/acceptance queue; the current layout has not completed final acceptance.                                          |
| implement-mobile-voice-room-session       | The voice room and reconnection page are still being repaired; [Reconnection record](reconnecting-layout/README.md) clearly stated that the code has been changed but has not been verified, and does not claim 1:1 PASS. |
| implement-mobile-room-safety-alerts       | [Original acceptance record](implement-mobile-room-safety-alerts.md) clarifies that the real LiveKit/STT, device acceptance is missing and will not be archived yet.                                                      |
| implement-mobile-room-processing-consents | [Original acceptance record](implement-mobile-room-processing-consents.md) still requires product and privacy copy confirmation; the current house building UI also needs to be adjusted for unified verification.        |

There are another 19 changes including unfinished tasks, which will continue to be retained. Including new requirements for one-on-one messaging/calls, direct room check-in, room and mobile phone experience repair, real SMTP/SMS/OAuth, LiveKit/STT, data management and product acceptance, etc. The gap was not eliminated by clearing tasks, forging acceptances or batch forced archiving.

## Delivery Boundary

- Password authentication frontend archive retains historical acceptance limits for email delivery, native sessions, and external OAuth; production Google remains closed, and email deactivation/experience accounts are managed by their active change.
- Social basic archiving does not mean the completion of independent "find a partner" page or one-to-one chat. The latest evidence of online idle invitation and global heartbeat adjustment is in [Invitation record](in-app-partner-invitations/README.md), and the one-to-one capability is still in `add-partner-discovery-direct-conversations`.
- Automatic APK delivery archiving only confirms completed build and release pipelines, retaining independent business cleanup, real translation, and device acceptance constraints; no new APKs are built or released for current local changes.
- Deployment and archiving are independent; no online front-end, database, Redis, environment variables or external providers are updated this time.
