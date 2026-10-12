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
