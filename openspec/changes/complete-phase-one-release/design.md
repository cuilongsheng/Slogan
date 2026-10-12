# Design and release boundaries

## Approval

The owner authorized this batch on 2026-10-11 after the read-only audit, including completing missing development and deferring tests/deployment until implementation is finished. This is not authorization to delete private content or discard history.

## Ownership

PostgreSQL owns profiles, private conversations, call state, and durable work. Redis owns short-lived shared throttles/presence only. Managed queues wake leased database work; HTTP responses do not own its lifetime. Disabled provider features remain disabled. API transport descriptions generate the sole checked-in OpenAPI contract using the repository's existing NestJS generation path; generated clients remain the frontend type boundary.

## Avatar

The default avatar is an application-owned public asset. User uploads are limited to supported raster formats and a small decoded payload; the server validates the payload, stores only bounded image data, and serves an opaque asset identifier with an explicit content type and no sniffing. Replacing a picture does not make profile completion or provider availability a prerequisite.

## Managed execution

Use explicit managed queue consumers with repeatable database scans and fenced leases. API instances must not claim a persistent timer or BullMQ worker will survive a request. Keep sensitive audio workers separate and disabled in this release. Alert sinks and backup targets require concrete configured destinations; configuration absence cannot be reported as delivery success.

## Migration and rollback

New schemas are additive. Back up before a production migration, validate the target identity and main commit, and migrate before promoting dependent application code. Never run production migrations from PR jobs. Verify restoration in an isolated database before claiming recovery readiness. Rollback disables new writes/entrances and reverts application code while retaining new user data and tables; do not run destructive down migrations.

## Risks

- Private messages introduce access-control, blocking, retention, and abuse boundaries: participant-scoped queries and transactional pair locks are mandatory.
- Independent calls and rooms compete for the same users: shared user-row locks must serialize occupancy decisions.
- Uploaded images must not become arbitrary file hosting: bounds, format checks, opaque IDs, and trusted URL construction apply.
- Shared throttling failure must not silently turn an authentication endpoint into an unrestricted endpoint.
- Native audio, Google sign-in, keyboards, and lifecycle behavior need owner device evidence; browser tests cannot certify them.

## Acceptance sequence

Complete implementation, then execute one consolidated verification cycle. Repair failures and revalidate affected evidence before release. Production migrations and real cloud checks happen only in the final release stage. Unavailable external resources remain explicitly incomplete.

## Approved 2026-10-12 interface simplification

The owner revised five frames in `01 Prototype / Partner & Direct Chat / Flow Draft` and requested matching high-fidelity design while broadly retaining the existing visual language. Source frames: `112:1102`, `112:1151`, `112:1193`, `112:1216`, `112:1231` at 390 × 844. Preserve the old V1 UI and create a separate V2 design section using its existing bound colors, Noto Sans SC typography, photo avatars, peer rows and actions. No backend data or contracts are removed.

Remove list subtitles, the successful-list refresh button and the Messages Friends tab. Pull-to-refresh, paging and empty/error recovery remain. Messages shows recent conversations with View actions and a compact unread indicator; no fake conversations are created for friends. Existing friendship persistence and management routes remain intact.

Move chat blocking and message-report guidance into the bottom toolbar; personal history deletion remains available on the conversation list. Reporting must identify the selected received message, never implicitly report an arbitrary message. The toolbar enters selection mode and the participant taps the message to report. Keep existing confirmation, retry and blocked states.

Combine the incoming caller name and invitation text, remove redundant prose, and show the active peer in the call heading. Keep the established circular photo, timer and operational media/error handling. Replace active pill controls with circular microphone/end actions plus short labels.

Design readiness: references are the revised prototype and three current high-fidelity page families. Existing V3 semantic color/radius/type variables, local Noto Sans SC styles, AvatarPhoto, peer-row, navigation and action components have been inspected through Desktop Bridge. There are no mobile Code Connect files. Reuse and targeted component reconciliation are sufficient; no new global theme or external library is needed. Exact source vector icons are reused. Native OS chrome/audio fidelity remains owner validation.
