# Zero-idle free-tier implementation and budget

Status: implemented and verified on `codex/zero-idle-free-tier`, prepared for user-authorized source-only integration into `main` on 2026-10-18. No cloud migration, owner activation, deployment, or hosted quota acceptance. The previous redis-idle-cost worktree is preserved. This is an independent OpenSpec change based on `b1a27c4`, carrying forward the earlier unshipped Redis optimizations. The integration commit uses `[skip ci]` to keep automatic deployment, production migrations and APK publication out of this source-only delivery.

## Accounting boundary

- 30-day month; H=720 hours for continuous use, H=90 hours for 3 hours/day.
- U=continuously foreground users during those hours. R=simultaneously active Fluid/SSE reader instances, **not** users. R=1 is an assumption, never a guarantee of Vercel placement.
- Preview governance/assistance/database monitor disabled (their defaults). One active fenced owner serves the shared database. All incompatible unfenced legacy consumers must be retired before these budgets apply.
- External uptime probes are separate traffic: health/live is memory-only, health/ready still queries DB when called. Existing Better Stack/third-party monitor settings were not changed or presumed disabled.
- Healthy network, no business activity, no active rooms, no unbounded retry/error storm. Real joins, calls, credentials, messages, metrics mutations and cold starts add cost.
- Redis quota planning counts client commands AND Lua-internal commands conservatively, following the official Upstash rate-limit cost examples. One EVAL is one network command, not one quota unit. The local counter records SDK sends and separately uses Redis MONITOR with an ECHO barrier to include script-internal commands. Pipeline members are counted separately. Upstash excludes operational AUTH/HELLO/SELECT/INFO/PING/QUIT etc. Optional CLIENT SETINFO was disabled on presence/stream connections. The integration counter filters documented free operational commands. Regional/single-region accounting is assumed; replicated writes can add charges on a Global database. Cloud quota deltas were not measured.
- SQL counts application-to-PostgreSQL statements, including BEGIN/COMMIT. Trigger-local work is not a new network query. No estimate of exact Neon GB or cloud CPU seconds is presented as measured.
- “Wakeup” below means an application work cycle (reader return, HTTP request, queued delivery), not an OS scheduler metric or billable Function Invocation. SQL completion callbacks add more JS turns within those cycles.
- Bounds include up to 20 SSE opens/hour/user: 15 bounded renewals plus up to 5 token-expiry/refresh reconnects. Mobile token refresh margin is 30 seconds; budget allows 5 refreshes/hour. Protocol2 ready/replay does not request a new UI snapshot; reset does.

## Before / after

Monthly columns are **After, U=1/R=1, 24h/day**, unless stated otherwise. Redis planning includes Lua-internal commands; SDK sends are shown separately for actions. Before is source-derived, not live cloud metering. The earlier 1-EVAL=1-command monthly estimates were SDK request counts and are superseded here.

| Source                   | Before                                         | After                                                                        |                             Redis/month |                                DB/month | CPU risk                         | Correctness guarantee                                                             |
| ------------------------ | ---------------------------------------------- | ---------------------------------------------------------------------------- | --------------------------------------: | --------------------------------------: | -------------------------------- | --------------------------------------------------------------------------------- |
| Idle XREAD               | ~3,600/hour/reader                             | 15s maximum; aligned deadlines; budget <=360/hour/reader                     |                               <=259,200 |                                       0 | Medium; allocated memory remains | Events return immediately; new stream keys cancel blocking reads                  |
| SSE recovery             | Global scan every 15s/subscriber instance      | No periodic recovery; committed mutation publication                         |                              0 periodic |                              0 periodic | Removed                          | Connection-entry preflight retained; durable fallback for missed wakeups          |
| SSE auth and entry       | ~9 queries/check; duplicated relations/context | One narrow mutable-state query/check; verified guard context reused          |                                       0 |                               <=201,600 | Low/medium                       | <=15s mutable-state bound and validation before event batches                     |
| SSE replay bounds        | 4 Redis reads/open                             | Same, <=20 opens/hour/user                                                   |                                <=57,600 |                          included above | Low                              | Signed owner-bound cursor; trim reset; protocol1/2 retained                       |
| Presence HTTP heartbeat  | 3 SDK sends/45s, including recovery            | 1 atomic EVAL/45s; 5 commands including Lua when steady                      |                                 288,000 |                                  57,600 | Low                              | SET EX GET removes redundant EXISTS; TTL90s / heartbeat45s unchanged              |
| Explicit presence expiry | Preview relied on stream sweeps                | Deadline job, <=84/hour/user; budget 5 commands/job including Lua            |                               <=302,400 |                               <=115,200 | Low                              | Generation check; atomic offline notification and deadline-scoped dedup           |
| Presence takeover repair | Repeated unrelated scans                       | Bounded repair in common fallback                                            |      <=5,760 user-dependent; base below |                                 <=5,760 | Low                              | Old generations cannot fork expiry chains; partial batch reports remaining leases |
| Refresh                  | Request plus request-seeded recovery           | Actual refresh only; observed 3 commands including Lua                       |                                <=10,800 |                                <=64,800 | Low                              | Rotation and reuse revocation preserved; <=5 refreshes/hour                       |
| Owner safety fallback    | Multiple deployment-partitioned chains         | One owner; 15min online/pending, 60min confirmed empty                       | 14,400 continuously online; 3,600 empty |               8,640 online; 2,160 empty | Low; cold-start CPU unmeasured   | 3 narrow SQL; empty repair + release check costs 5 commands including Lua         |
| Release metadata         | Separate frequent maintenance                  | Shares adaptive fallback                                                     |                          included above |                             0 unchanged | Low                              | SET NX + GET and small public HTTP; changed version publishes notification        |
| Daily owner cron         | Production reseed                              | One owner-only canonical daily reseed                                        |                                 0 empty |                                      30 | Low                              | Same fallback window key; independently repairs lost chain                        |
| Reconciliation/snapshot  | Full room and historical memberships           | Relevant work only; narrow ACTIVE snapshot; warm unchanged fingerprint reuse |                          Work-dependent |                          Work-dependent | Low idle                         | Fresh provider observation and observation-time precedence retained               |
| Yesterday metrics        | Repeated history downloads and aggregation     | Same window/algorithm/source/maturity reuses completion                      |                             0 unchanged | 3 small queries when explicitly invoked | Low idle                         | Transactional source revisions cover rollback and late commits                    |
| Optional monitor         | Enabled production could scan every60s         | Managed minimum900s; Preview default off                                     |                                   0 off |                                   0 off | Low off; workload-dependent on   | Sentry retained; enabled monitoring is explicit workload                          |

Do not double-count included rows. Continuous U=1/R=1 conservative total: **938,160 Redis commands (187.63% of 500K), 453,630 SQL**. This is deliberately more cautious than the SDK-send total of 447,120/month. Twenty-four-hour foreground use does not fit the Redis free quota under the conservative script-inclusive model.

## Hourly and monthly scenarios

During online hours:

- Redis quota planning/hour <= `360*R + 923*U + 20` (SDK sends/hour <= `360*R + 249*U + 12`).
- SQL/hour <= `618*U + 12`.
- Application cycles/hour <= `360*R + 189*U + 4`; foreground/queue invocations/hour <= `189*U + 4`. Reader returns occur inside an existing invocation. SQL callbacks add JS turns within these work cycles; this is not an OS wakeup/CPU metering claim.
- Redis user terms: `400 heartbeat + 420 expiry + 80 replay bounds + 15 refresh + 8 takeover repair`. Base fallback is 20/hour online or 5/hour empty.
- SQL user terms: `280 SSE entry/check/preflight + 80 heartbeat + 160 expiry fencing/scheduling + 8 repair/leftover fencing + 90 refresh`.
- For 3h/day: base fallback is 4,950 Redis + 3,000 SQL/month. Reserve 60 transition fallback deliveries/month (300 Redis + 180 SQL), 120 extra first-heartbeat/offline-expiry Redis per user/month, and 60 first-heartbeat/first-expiry SQL per user/month. Initial owner activation, business events and failures are additional.

| Scenario                              | Redis/hour including Lua |       SQL/hour | Application cycles/hour | Redis/month |   SQL/month | Redis /500K |
| ------------------------------------- | -----------------------: | -------------: | ----------------------: | ----------: | ----------: | ----------: |
| 0 users, 0 rooms/work                 |                        5 |              3 |                       1 |       3,600 |       2,190 |       0.72% |
| 1 idle foreground user, R=1, 24h/day  |                  <=1,303 |          <=630 |                   <=553 |   <=938,160 |   <=453,630 |     187.63% |
| 5 idle foreground users, R=1, 24h/day |                  <=4,995 |        <=3,102 |                 <=1,309 | <=3,596,400 | <=2,233,470 |     719.28% |
| 1 user, R=1, 3h/day                   |           <=1,303 online |   <=630 online |            <=553 online |   <=120,840 |    <=58,860 |      24.17% |
| 5 users, R=1, 3h/day                  |           <=4,995 online | <=3,102 online |          <=1,309 online |   <=453,600 |   <=281,580 |      90.72% |
| 5 users, R=5, 3h/day                  |           <=6,435 online | <=3,102 online |          <=2,749 online |   <=583,200 |   <=281,580 |     116.64% |

R is the actual simultaneously active reader instance count, not users. Placement/co-location is not guaranteed. These are scenario budgets, not hard limits. Five users for three hours/day leaves little Redis room even at R=1, and exceeds it at R=5. One to two hours/day, fewer simultaneous readers, or paid/external realtime infrastructure provides more margin; this implementation does not silently change transport or liveness contracts. With no activated owner, a lower observed resource count is not correctness acceptance.

## Observed local command/query budgets

Actual pg.Client.query and Redis.sendCommand plus MONITOR Lua observations, isolated local PostgreSQL/Redis. Queue transport and LiveKit are simulated; owner/application handlers are real. SQL includes transaction boundaries. Delayed future jobs are not executed early. One small room fixture; counts depend on audience and state.

| Action                           | SDK Redis sends | Redis including Lua | SQL | Boundary                                                                       |
| -------------------------------- | --------------: | ------------------: | --: | ------------------------------------------------------------------------------ |
| First presence heartbeat         |               1 |                   7 |   2 | First chain claim and online notification; scheduling fence included           |
| Steady presence heartbeat        |               1 |                   5 |   1 | No recovery or duplicate eligibility load                                      |
| Join room                        |               6 |                  30 |  53 | HTTP plus immediate background consumers; delayed fallback excluded            |
| First credential                 |               6 |                  30 |  85 | Authorization, issuance, confirmation and changed-state notifications          |
| Unchanged-SID credential         |               0 |                   0 |  80 | Still authorizes/signs/confirms; skips SID update and invalidation             |
| Leave room                       |              11 |                  55 |  69 | Immediate cleanup; future retries excluded                                     |
| Single outbox publication        |               1 |                   5 |   6 | INSERT plus preflight/transaction/lock/delete; reader work additional          |
| Steady refresh                   |               1 |                   3 |  18 | Rotation and immediate empty maintenance hint                                  |
| Empty owner fallback             |               3 |                   5 |   3 | Repair EVAL internally ZRANGE+ZCARD, release SET NX+GET; no domain transaction |
| Stale same-deployment generation |               0 |                   0 |   1 | Fence only                                                                     |
| Legacy/other-deployment delivery |               0 |                   0 |   0 | Rejected before application bootstrap                                          |

A returned event also completes the shared XREAD, triggers narrow mutable-state validation per receiving batch, and retains scope-specific resource permission queries. Fanout is per outbox row, not a universal fixed per-user event cost.

Deterministic ten-minute reader tests record **40 XREADs for one user, 44 for five staggered users on one reader**. Fake clocks/transport establish counts. Separate real Redis tests verify immediate events, subscription changes, cancel/replay/revoke/removal, expiry and failure recovery. Local MONITOR records Lua commands; it does not establish an actual Upstash bill or measure global replication. [Official Upstash cost examples](https://upstash.com/docs/redis/sdks/ratelimit-ts/costs) count EVAL together with its internal commands; [Insights](https://upstash.com/docs/redis/howto/insights) also distinguishes script commands from request count. Do not repeat the earlier SDK-only budget as the 500K quota estimate.

## Remaining Top 5 costs

1. Allocated SSE memory: at 2GB, one continuously occupied instance is ~1,440GB-hours/month vs Hobby360; one instance for3h/day is180, five instances900. I/O wait does not remove memory usage; placement is not guaranteed.
2. Narrow authorization plus fallback keeps Neon compute awake despite small rows. See the separate residency model below.
3. Presence renewals and explicit expiry, including Lua internals: justified while online, stopped after leases expire. These now dominate Redis at several users.
4. XREAD completion/timeout cycles, roughly240–360/hour/reader plus real events and reconnects.
5. Active room operations: unchanged credential still uses80 SQL in this fixture; provider repair, calls, notifications, metrics and enabled governance/monitoring add real work.

## Neon compute residency

Neon Free compute normally suspends only after 5 minutes without queries. Its current public allowance is 100 CU-hours/project/month; the exact account console allocation was not inspected. Assuming minimum 0.25 CU, the previously planned 15-minute fallback alone would cost approximately `720*(5/15)*0.25 = 60 CU-hours/month` without users.

The user explicitly chose **60 minutes when confirmed empty, 15 minutes while online or with work**. This is implemented. The new minimum idle model is `720*(5/60)*0.25 = 15 CU-hours/month`; at 3 hours/day online, `(90 + 630*(5/60))*0.25 = 35.625 CU-hours/month`, before transition overhead. Autoscaling, startup latency, actual business traffic and external readiness monitors increase these estimates. A query budget cannot guarantee Neon GB or compute usage.

State detection shares the existing narrow work-hint query and bounded presence-repair EVAL. The Lua also returns remaining index cardinality, so a full batch of expired leases cannot incorrectly classify unexamined live leases as empty. No extra polling/query is introduced for this decision. A new business-work wakeup restores the quarter-hour chain; the initial live presence expiry check (about 90s after the first heartbeat) does so once, while later continuations do not repeat that activation. Offline state returns to the hourly chain at a subsequent safety check. Quarter-hour and hourly windows share idempotency keys and converge at common boundaries. A lost first wakeup while the system was empty can exceptionally wait up to an hour for discovery; known deadlines still use explicit jobs. This longer exceptional recovery bound is the approved tradeoff.

References: [Neon scale to zero](https://neon.com/docs/introduction/scale-to-zero), [current Neon Free announcement](https://neon.com/blog/neon-free-plan-1-gb-per-project).

## Correctness and limitations

- Release discovery is retained in the common adaptive fallback (15 minutes online/pending; 60 minutes confirmed empty). Unchanged metadata uses no DB query; a changed version creates and publishes a durable release notification.
- Fencing is persistent and release-activated; old jobs on fenced builds do no recovery, and in-flight old work cannot continue its chain. A final send racing with activation may still be delivered, but its generation is rejected. Legacy binaries without these checks must be retired; no code here can stop them remotely.
- One shared database owner spans Preview and Production. Hobby's daily cron should target the current fenced Production owner; cross-environment queue routing and OIDC are a hosted acceptance gate. A Preview-only owner is not accepted as automatically cron-reseeded.
- Actual committed HTTP mutations publish outbox before returning where possible, and schedule background work after response completion. Known commands retry at durable deadlines; absent work does not create realtime recovery continuations. Failed queue sends leave durable work for the bounded fallback (15 minutes active; up to 60 minutes if its first wakeup is lost from empty state).
- Presence atomically claims a chain inside renewal Lua. Takeover fallback replaces chain generations, so earlier deliveries cannot fork offline notifications. Continuations use Redis expiry score in their idempotency key.
- Reader buffers contain opaque change references, not private content. They remain owner-filtered; authorization and per-resource permission are checked before delivery. A slow consumer exceeding 200 buffered events reconnects through existing replay/reset semantics.
- Cold reconciliation constructs a narrow snapshot; warm fingerprint reuse does not cross processes or skip changed provider observations. Historical memberships remain in explicit business operations where removal/reentry semantics require them, not media polling.
- Metric watermark revisions are append-only, one row per committed source-mutating transaction. They avoid a contended global counter/deadlock and cover late commits. Storage grows with real mutations. Global source version is conservative: other-window mutations can cause recomputation; it cannot incorrectly reuse older facts. Do not purge revisions independently of a watermark migration.
- Verified guard context is shared on SSE and presence paths. Credential/provider confirmation deliberately performs fresh domain checks after external I/O; those 80 SQL statements are reported rather than hidden as eliminated identity reads.
- Pool max=2 failed the existing four-way host concurrency test because a locked transaction performs an external profile query. Preserve max=10 and explicitly document the lower-cap hazard; no transaction rewrite was added.
- Exact Neon transfer needs deployed bytes/connection telemetry; exact Vercel Active CPU needs provider metering. No unlimited-uptime/free-tier guarantee follows from passing tests.

## Verification

Final affected API verification: **82 suites / 499 tests passed** (unit, integration, HTTP e2e and Redis runtime). API build, typecheck, lint, unchanged OpenAPI generation check, dependency audit (955 modules / 3,741 dependencies) and strict OpenSpec validation passed. This is not a claim that every unrelated frontend/repository check was run. Earlier phase gates: ownership build/typecheck/lint and 41 tests; recovery/auth build/typecheck/lint and 79 tests. Operations/social e2e suites now keep one bound listener rather than repeatedly auto-closing/reopening an ephemeral server under Node keep-alive. The final combined run passed, including adaptive idle/online cadence, one-time presence activation, boundary-key convergence and bounded-repair cardinality. The credential budget fixture clears unrelated leftover outbox rows, and a separate 250-row integration case proves multi-batch publication. Revocation acceptance allows an earlier shared renewal boundary while requiring close within 16 seconds (15-second cadence plus network allowance) and denied reentry. The max=2 concurrency failure was addressed by retaining the prior max; test timeout was not relaxed. New trial-scope fixtures explicitly clean their restrictive relation before users.

## Release state

No cloud changes were made. Apply the two additive migrations and activate a fenced owner only through the staged runbook after hosted routing/correctness proof and quota availability. Do not archive this change as a hosted free-tier acceptance or say existing resource exhaustion has recovered.

Official accounting references: [Upstash pricing](https://upstash.com/pricing/redis), [Vercel Fluid pricing](https://vercel.com/docs/functions/usage-and-pricing), [Vercel memory configuration](https://vercel.com/docs/functions/configuring-functions/memory). I/O wait does not consume Active CPU, but allocated memory remains relevant to open requests. The SDK sends native Redis TCP commands; REST blocking-stream support is a different interface and was not substituted.

## Changed implementation and test files

- `apps/api/.env.example`
- `apps/api/api/maintenance-seed.ts`
- `apps/api/api/maintenance.ts`
- `apps/api/api/observability.ts`
- `apps/api/api/realtime.ts`
- `apps/api/prisma/migrations/20261018090000_managed_worker_owner/migration.sql`
- `apps/api/prisma/migrations/20261018100000_metric_source_version/migration.sql`
- `apps/api/prisma/models/managed-worker-owner.prisma`
- `apps/api/prisma/models/metric-computation-run.prisma`
- `apps/api/prisma/models/metric-source-version.prisma`
- `apps/api/scripts/activate-worker-owner.mjs`
- `apps/api/src/bootstrap/managed-recovery.ts`
- `apps/api/src/common/guards/access-token.guard.ts`
- `apps/api/src/config/environment.ts`
- `apps/api/src/infrastructure/database/database.module.ts`
- `apps/api/src/infrastructure/database/prisma.service.ts`
- `apps/api/src/infrastructure/managed/worker-owner.service.ts`
- `apps/api/src/infrastructure/redis/live-stream.scripts.ts`
- `apps/api/src/infrastructure/redis/realtime-queue.service.ts`
- `apps/api/src/infrastructure/redis/social-presence.service.ts`
- `apps/api/src/modules/auth/application/services/session.service.ts`
- `apps/api/src/modules/auth/domain/entities/auth-session.ts`
- `apps/api/src/modules/auth/domain/ports/auth.repository.ts`
- `apps/api/src/modules/auth/index.ts`
- `apps/api/src/modules/auth/infrastructure/prisma-auth.repository.ts`
- `apps/api/src/modules/live-updates/application/live-updates.interceptor.ts`
- `apps/api/src/modules/live-updates/application/live-updates.service.ts`
- `apps/api/src/modules/live-updates/domain/live-updates.port.ts`
- `apps/api/src/modules/live-updates/infrastructure/redis-live-updates.store.ts`
- `apps/api/src/modules/live-updates/presentation/live-updates.controller.ts`
- `apps/api/src/modules/maintenance/maintenance.module.ts`
- `apps/api/src/modules/maintenance/maintenance.service.ts`
- `apps/api/src/modules/maintenance/work-hints.service.ts`
- `apps/api/src/modules/operations/application/services/metrics.service.ts`
- `apps/api/src/modules/operations/application/services/observability-monitor.service.ts`
- `apps/api/src/modules/operations/domain/ports/metrics.repository.ts`
- `apps/api/src/modules/operations/infrastructure/prisma-metrics.repository.ts`
- `apps/api/src/modules/operations/infrastructure/vercel-monitor-scheduler.ts`
- `apps/api/src/modules/operations/operations.module.ts`
- `apps/api/src/modules/operations/testing.ts`
- `apps/api/src/modules/rooms/application/services/room-realtime.service.ts`
- `apps/api/src/modules/rooms/domain/ports/room-realtime.repository.ts`
- `apps/api/src/modules/rooms/infrastructure/locked-realtime-room.ts`
- `apps/api/src/modules/rooms/infrastructure/prisma-room-realtime.repository.ts`
- `apps/api/src/modules/safety/infrastructure/safety-queue.service.ts`
- `apps/api/src/modules/social/application/services/social.service.ts`
- `apps/api/src/modules/social/infrastructure/prisma-social.repository.ts`
- `apps/api/src/modules/social/presentation/social.controller.ts`
- `apps/api/src/modules/voice/application/services/voice.service.ts`
- `apps/api/src/modules/voice/infrastructure/realtime-runner.service.ts`
- `apps/api/src/modules/voice/infrastructure/realtime-runner.spec.ts`
- `apps/api/test/e2e/managed-recovery.e2e.spec.ts`
- `apps/api/test/e2e/operations-governance.e2e.spec.ts`
- `apps/api/test/e2e/social.e2e.spec.ts`
- `apps/api/test/e2e/voice.e2e.spec.ts`
- `apps/api/test/fixtures/environment.ts`
- `apps/api/test/fixtures/realtime.ts`
- `apps/api/test/integration/authorization-state.spec.ts`
- `apps/api/test/integration/live-updates.spec.ts`
- `apps/api/test/integration/metrics-source-version.spec.ts`
- `apps/api/test/integration/resource-budget.spec.ts`
- `apps/api/test/integration/room-realtime.spec.ts`
- `apps/api/test/runtime/social-presence-redis.smoke.spec.ts`
- `apps/api/test/unit/live-redis-idle.spec.ts`
- `apps/api/test/unit/live-updates-burst.spec.ts`
- `apps/api/test/unit/managed-maintenance-idle.spec.ts`
- `apps/api/test/unit/observability-seed.spec.ts`
- `apps/api/test/unit/realtime-managed-queue.spec.ts`
- `apps/api/test/unit/worker-owner.spec.ts`
