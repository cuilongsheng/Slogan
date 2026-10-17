# V1 closeout — 2026-10-17

Code is integrated on main. API and both production Pages run `c631c709b407f96b024aacd9f6d5d9a562d4b5e4`. The complete release is **blocked by exhausted Redis free quota**, with the owner's explicit decision to remain free. Android 0.0.135 built successfully but was not published; the public APK remains0.0.127. Do not classify the whole V1 release as accepted or fully healthy.

## Work ledger

| Scope                   | Result and evidence                                                                                                                                                                                                                                                                                                                                                                               |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Me UI                   | Added report/update icons; revised white identity/menu surfaces, inset dividers, language options and spacing. Original Desktop Bridge frame 152:1467,390×844; `me-original.png` and `me-runtime-zh.png`. Retained five actions and main navigation are approved differences. Published Web includes the change; new native package is held.                                                      |
| Branch cleanup          | Preserved 164 modified/untracked entries from old develop 6605470 in local stash 0ee8c9de10d6e73499034ac48e59f66219bc82b4. Clean local branches are aligned with main. Fully merged, unattached branches were pruned; unmerged branches and other chats' worktrees retained.                                                                                                                      |
| Tasks and documents     | Five eligible changes reconciled and archived: shared-SSE chat history, invitation report feedback, host controls, LiveKit voice session and appointment backend. Current inventory: 25 active changes, 462 task records, 69 unchecked; counts are not a missing-code or V1-blocker count. See `change-inventory.md`.                                                                             |
| Monitor pause/recovery  | Actual shared pause, quiescent scan window, external Down, realtime heartbeat staying Up, private cron reseed and external recovery passed. Both fault and recovery emails reached the owner. Legacy unaliased pre-gate deployment retired; only current c631 monitor owner observed. See `monitor-pause-recovery.json`.                                                                          |
| Operations              | Actual encrypted production snapshot, isolated PostgreSQL 17 restore,34 migrations and 12 invariant groups passed. Daily scheduled recovery run also succeeded. See `operations-recovery.json`. This does not complete every governance/retention/provider criterion.                                                                                                                             |
| Real Cloud voice        | Provider grants, bidirectional synthetic media, signed production webhooks, removal/old-token rejection, fresh re-invitation, explicit/default host succession, actual 60-second reconnect window, five-minute appointment takeover/vacancy and scheduled-end cleanup passed. Owned fixtures cleaned. See `livekit-provider-cloud.json`, `livekit-business-cloud.json`, `appointment-cloud.json`. |
| Client Sentry           | GitHub Production and both Pages Production configurations saved within owner-approved scope. Actual Web events and Mobile original-source cloud location verified; maps are not publicly downloadable. Actual Android Hermes upload and unpacked artifact checks passed. See `client-cloud-events.json`, `android-main-artifact.json`, `pages-monitoring-configuration.json`.                    |
| Android physical device | Owner reports existing device verification complete and explicitly stopped agent device debugging. No further device interaction. This does not prove native Sentry canaries/cache/restart behavior on the new package.                                                                                                                                                                           |

## Verification

Local API final full suite: 133 suites /671 tests passed, one opt-in suite/test skipped. API build/lint/typecheck, Mobile lint/typecheck/unit suite, dependency/format checks and official build/trace checks passed. The Redis probe correction separately passed seven provider tests and API lint/typecheck/build.

Final full component-browser run passed 54/54 with one worker. Earlier two-worker run was 53 passed/one long-chat incoming-update anchor failure; its isolated reruns and final full suite passed without hiding the initial failure.

Both main commits 5cdcc4e and c631c709 passed Phase-one verification and Android builds. Current main workflow 39020693138 deployed the API after snapshot/restore/invariants/migration checks, then **failed** authenticated streaming on login503. Android workflow 39020693236 correctly blocked publication because that gate failed. These are recorded failures, not a fully green production release.

Final documentation checks: root `pnpm format:check`, `git diff --check` and `openspec validate --all --strict` passed (69/69: 44 main specs and25 active changes). Informational duplicate-ADDED archive hints on other historical changes remain; those changes were not archived. No application test/build rerun was needed for the final documentation-only commit.

## Evidence and privacy boundaries

- Actual Cloud sessions used disposable fixtures and synthetic audio, with no microphone recording or human/native audibility claim. Fresh fixture sessions used the real SessionService; this is not password-login acceptance.
- Current c631 Web SDK egress events are recorded. Original-source Sentry UI proof is from the previous 5cd build; protected Admin events intentionally omit stacks. Expected401 runtime filtering is blocked by upstream503; local tests do not replace this remote case.
- Android 0.0.135 contains structured Java collection only, NDK disabled and no ProGuard mapping because minification is off. Hermes upload completed, server processing was pending at the build receipt, and deviceVerified is false.
- Sentry uses Error Monitoring + 0.1 sampled Tracing only. Logs, Profiling, Application Metrics and Replay remain disabled. Credentials are private and excluded from source and evidence; approved Cloudflare Functions binding availability is documented separately.
- Monitor heartbeat Up proves scan completion, not Redis coordination health. The corrected keyless Lua probe has a persistent OPEN Redis incident with delivered notification. Previous PING-based recovery and actual recovery-email delivery do not prove Redis quota recovery.

## Remaining limits

Redis is the current release blocker: actual keyless Lua requests are rejected at 500,000/500,000, login503 persists, authenticated streaming is not accepted and new APK publication remains held. The owner chose free service; no paid upgrade, payment method, quota bypass or replacement database was introduced. See `redis-quota-blocker.json`.

Native Sentry crash/offline-cache/restart canaries remain unverified because further device work was stopped. The full remote backlog/sink-failure/SDK-timeout and per-service rollback matrix is incomplete; the monitor pause/reseed and actual notification cases above are complete. Provider-disabled email/SMS/WeChat/STT/AI features remain as previously reviewed. These limits retain their applicable OpenSpec unchecked tasks.

After Redis allowance is restored, verify Lua readiness and real login, then rerun guarded authenticated streaming before releasing a new Android artifact from its exact source SHA. Do not bypass gates or silently publish the held package. See `../../releases/2026-10-17-v1-closeout.md` for deployment and rollback identifiers.
