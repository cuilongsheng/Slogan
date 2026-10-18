# Fenced worker release and rollback

This runbook prepares a release; nothing here has been run against Neon/Upstash/Vercel. Do not deploy while the existing provider block is unresolved or substitute new accounts/resources to bypass it.

## Preconditions

- Review `openspec/changes/zero-idle-free-tier` and the acceptance report. Preserve the sole OpenAPI contract and existing mobile SSE protocol.
- Inspect actual active aliases, deployment source revisions and callback logs. A READY deployment is not evidence of successful requests. Do not use historical deployment alias lists as current routing truth.
- Identify every unfenced legacy realtime/maintenance/monitor consumer. This implementation cannot fence code that predates it. Retire only explicitly authorized incompatible targets, protecting the canonical live alias and a compatible fenced rollback.
- Shared Preview/Production database means **one global owner**. With Hobby cron, select the current fenced Production deployment as owner. Preview writes forward wakeups to it. Hosted proof must validate project/environment OIDC cross-deployment send pinning; local QueueClient mocks cannot prove it.
- Make a protected database backup through existing project procedures. Migration is additive. Use the exact intended database URL via secret injection; never print it.

## Prepare without activation

1. Run normal build/typecheck/lint, affected unit/integration/e2e, contract and architecture checks.
2. Apply `20261018090000_managed_worker_owner` and `20261018100000_metric_source_version` to the explicit target through the normal Prisma deploy procedure. Verify owner generation starts absent and existing facts are intact. Existing metric runs have null sourceVersion and recompute once when enabled.
3. Deploy a fenced candidate and prepare a compatible fenced rollback. Do not silently activate on build/startup/first request. Public traffic requiring managed expiry must not be switched before owner activation.
4. Validate queue pinning/auth and the callback protocol in the intended hosting environment. Test expired presence takeover, a real committed outbox mutation, failed-publication retry, pending command retry, revoke, removal, close and replay. Never test by creating an uncontrolled perpetual chain.

## Activate and promote

1. Read the `background` row's generation. Absence is expected generation 0. Resolve the candidate's actual `dpl_...` ID.
2. From an authorized release context with the intended DATABASE_URL and Queue OIDC credentials injected, run `node apps/api/scripts/activate-worker-owner.mjs dpl_ACTUAL_ID EXPECTED_GENERATION`. No credentials belong in arguments or reports. It performs a compare-and-swap, increases generation, and sends one fenced fallback to the owner.
3. A send failure after DB activation is not a successful release. Retain the reported generation, reseed through the canonical active-owner cron/authenticated release context, or activate the fenced rollback at a NEW higher generation. Do not reset generation or restart an old unfenced chain.
4. Confirm the owner's fallback pins its next 3600-second window when no leases/rooms/work exist, and a 900-second window while online/pending. Business work or the first live expiry check must restore the shorter cadence; the two chains must share boundary idempotency keys. Empty fallback must be 3 SQL + 3 SDK Redis sends (5 Redis commands when Lua internals are included) (presence repair and retained release metadata check) and no domain scan; stale delivery must be 0 recovery/0 continuation. Ensure the canonical daily cron is served by that owner.
5. Promote client routing only after these gates pass, retire authorized unfenced consumers, and inspect per-deployment callbacks over more than one fallback period. A surviving old binary invalidates the new budget.
6. Validate measured idle Redis rate, Neon transfer and CPU/memory allocation. Keep actual R (active reader instances) in the cost model. One 24/7 2 GB SSE instance cannot fit a 360 GB-hour Hobby memory allowance.

## Failure and rollback

- Keep PostgreSQL outbox, pending provider commands and presence expiries durable. Never delete them to lower usage.
- Activate a **compatible fenced** rollback with generation+1. Old in-flight work may finish, but every send rechecks ownership; any late old message no-ops at its consumer.
- Keep additive tables/columns and metric revision triggers through rollback. A binary unaware of fencing is not a valid rollback. Schema removal needs a separate reviewed migration after all dependants are gone.
- Do not delete metric revisions independently: their committed row count is the source watermark. A retention/rebase design must preserve monotonic invalidation.
- Leave max pool size at 10 with this transaction graph. Setting 2 can starve lock-holding host operations that request a separate profile connection. Idle timeout 60s and allowExitOnIdle do not keep a Function running.
- Preview monitor stays disabled by default; managed opt-in monitor enforces >=900s. Preserve Sentry errors. Enabled governance/calls are separate workload and not included in an empty Preview claim.
