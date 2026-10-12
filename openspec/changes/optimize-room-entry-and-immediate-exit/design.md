## Context and approval

The owner's latest direct request approves the workflow simplification. Figma originals remain visual authority; existing room and discovery surfaces are reused. No new mandatory preparation or terminal page is introduced.

## Decisions

Membership must still be confirmed before voice credentials. Reuse only fresh creation metadata bound to the current account; cached metadata never authorizes credentials. The membership endpoint already validates/replays admission, so a preliminary detail request is unnecessary for normal joins. Password/consent refusal stays in the same recovery surface. Member data and independent provider preparation can proceed concurrently after membership confirmation.

Provider CreateRoom is get-or-create; validate returned capacity and update metadata if needed. Credential reservations carry the exact time/version snapshot. Final authorization still checks member generation, room state/SID and issuance lease after provider work. Never parallelize final authorization ahead of provisioning.

Official-source audit and measured timing boundaries are recorded in `docs/architecture/livekit-room-lifecycle.md`. SDK warmup overlaps native audio setup without being awaited. SDK room-deleted/member-removed terminal notifications return to discovery; ordinary transport recovery remains SDK-owned. Normal host exit uses the already-required joining-order default; selected successors remain validated.

Local exit starts microphone shutdown and disconnection without awaiting media I/O. A root-owned account-bound queue persists room ID, action, expected generation and selected successor, not credentials. Screen disposal must not cancel the exit delivery. Retry uncertain results idempotently. Logout/account changes stop delivery for the prior actor; restart recovery resumes only for the matching authenticated actor. Discovery refreshes when delivery settles, and shows retryable synchronization failure on the list rather than an exit result page.

Host end commits the room state, generation revocation and durable cleanup commands before returning. A tracked Vercel post-response wakeup schedules committed command IDs promptly; existing managed queue/recovery owns provider retries. Other host operations retain their existing synchronization semantics.

Production Pages build their assets but wait for the exact deployed API commit before successful publication. Vercel Git production deployment is already disabled for main; the guarded migration/API job remains authoritative. Preview/local builds skip this readiness gate. A failed or timed-out gate retains the previously deployed production assets; retry after the API is ready. The bounded wait is fifteen minutes inside the Pages build budget, with no credentials or new provider permissions.

## Risks and rollback

- Late entry data after exit could reconnect audio: generation/disposal guards and deferred-promise tests.
- Stale creation metadata could cross accounts: account binding, short freshness and authoritative credential checks.
- Optimistic navigation could lose the exit request: root persistence/recovery, serialized saves and account-bound retry tests.
- Concurrent room changes during provisioning could issue stale credentials: preserve final transaction and existing issuance barriers.
- Provider create semantics or capacity mismatch: official implementation reference and adapter plus integration checks.
- Rollback restores the former navigation/entry sequence while retaining pending exit records for compatible delivery; never drop committed backend cleanup commands. No schema rollback is needed.

## Verification and evidence

Deferred backend/media promises establish local exit latency and true parallel execution. Existing admission/security/recovery tests remain mandatory. Compare room/discovery fixtures; native microphone/network timing and keyboard remain owner-operated. Re-measure actual HTTP admission/credential latency separately from WebRTC connection, without promising zero network time.
