# Phase-one completion acceptance

## Scope and evidence level

Candidate branch: `codex/phase-one-completion`, based on main `7b9075bac741eae78d033f9d11bd3775cd0ec65d`. This record covers local consolidated verification after implementation and focused repairs. Production API/schema/queue deployment and the matching APK are separate release gates; no new production release is asserted here.

Figma file `Slogan` / `56nIowZmvBhb0QJvOlDQdU`, page `02 UI`, section `175:1710`. Targets and typography were read directly through Desktop Bridge. Existing approved originals were not edited. [Target ledger](../../design/phase-one-completion-targets.json) and [comparison with overlays](comparison.html).

New-page captures run actual application components with the generated HTTP client against deterministic intercepted responses and explicitly isolated authentication/media adapters. Viewport 390 × 844 logical pixels, DPR 1, English, Asia/Shanghai timezone, fixed 2026-10-11 10:42 clock; bundled Noto Sans SC 400/500/700 and source-exported photo assets. These fixtures expose layout and client behavior, not real provider success.

## Original-to-runtime pairs

| State | Original node | Design | Running component |
| --- | --- | --- | --- |
| partners | `175:1711` | [Original](figma/partners.png) | [Runtime](runtime/partners.png) |
| recent | `175:1765` | [Original](figma/recent.png) | [Runtime](runtime/recent.png) |
| friends | `176:2019` | [Original](figma/friends.png) | [Runtime](runtime/friends.png) |
| partners-empty | `175:1865` | [Original](figma/partners-empty.png) | [Runtime](runtime/partners-empty.png) |
| messages-error | `175:1896` | [Original](figma/messages-error.png) | [Runtime](runtime/messages-error.png) |
| chat | `175:1814` | [Original](figma/chat.png) | [Runtime](runtime/chat.png) |
| delete | `177:2185` | [Original](figma/delete.png) | [Runtime](runtime/delete.png) |
| block | `177:2216` | [Original](figma/block.png) | [Runtime](runtime/block.png) |
| report | `177:2247` | [Original](figma/report.png) | [Runtime](runtime/report.png) |
| incoming | `175:1838` | [Original](figma/incoming.png) | [Runtime](runtime/incoming.png) |
| outgoing | `176:1982` | [Original](figma/outgoing.png) | [Runtime](runtime/outgoing.png) |
| active | `175:1852` | [Original](figma/active.png) | [Runtime](runtime/active.png) |
| reconnecting | `176:1998` | [Original](figma/reconnecting.png) | [Runtime](runtime/reconnecting.png) |
| device | `178:2316` | [Original](figma/device.png) | [Runtime](runtime/device.png) |
| ended | `175:1927` | [Original](figma/ended.png) | [Runtime](runtime/ended.png) |
| expired | `176:2010` | [Original](figma/expired.png) | [Runtime](runtime/expired.png) |
| me | `175:1937` | [Original](figma/me.png) | [Runtime](runtime/me.png) |

## Region inspection

- Shell: matching 390-pixel content bounds, surface/dark colors, 49-pixel browser status region and 80-pixel navigation. Native OS chrome and safe-area behavior need device captures.
- Headings and lists: source heading at x20/y49, 38-pixel line height; 358 × 88 peer cards, 12-pixel row gaps, 52-pixel exact photos, action bounds and 104/82-pixel tabs. Error/empty text and retry button follow the original y327/y376 positions. Earlier left-aligned tab and wrong empty-state placement were repaired.
- Private chat: source privacy banner, local-history/block actions, 58-pixel minimum bubbles, 54-pixel composer, 342-pixel confirmation cards and 264/368-pixel card heights. Back/microphone coordinates, cancel spacing and text wrapping were repaired. Long real messages can grow; static sample heights do not truncate user content.
- Calls: exact exported peer photo, 140/160-pixel size, source button geometry and phase-dependent labels. Reconnect title no longer overlaps the timer or repeats below the avatar. Ended/expired layouts omit the peer name as in the original. Device warning has a real retry action.
- Assets and typography: source family/weight/size/line height were checked through Bridge, and named static font faces are used by the runtime. Figma variable-font and Chromium static-font glyph rasterization still look different in some medium labels; the paired images retain that difference. This record does not assert universal pixel identity or Android 1:1 acceptance.
- States: all 17 new targets were inspected side by side. The suite also captures prior room, creation, profile and reconnect components. The room suite checks four seats on one row and reclaiming the second-row space when capacity is four.

Visual status: source-backed Web geometry and asset comparison complete; full device fidelity remains pending owner verification. Functional browser checks PASS. Real two-device audio and production integration are not established by these images.

## Executed verification

| Check | Result |
| --- | --- |
| Formatting, dependency boundaries, global lint and type checks | PASS after focused repairs |
| Sole OpenAPI and generated client drift checks | PASS |
| API unit | 43 suites / 236 tests PASS |
| API PostgreSQL/Redis integration | 40 suites / 207 tests PASS |
| API HTTP e2e | 20 suites / 106 tests PASS |
| API runtime/recovery | 8 suites / 15 tests PASS |
| Mobile unit/component | 52 suites / 176 tests PASS |
| Root browser flows | 24 tests PASS |
| Real-component visual/interaction suite | 28 tests PASS |
| HTTPS Pages authentication against real local API | 1 test PASS |
| Actual Pages workers in workerd | 1 test PASS |
| Backup/release script checks | 5 tests PASS |
| Application builds and both Pages packages | PASS; JS/native export is not installation evidence |
| Fresh isolated PostgreSQL 17 upgrade | All 29 migrations PASS |
| Authenticated encrypted backup, isolated restore, content verification | PASS; 1.78 seconds in local test, not production RTO proof |
| Restored database invariant checks | 12 groups PASS |
| Main OpenSpec strict validation | 36 specifications PASS |

Coverage includes participant/third-party authorization, bilateral blocking, qualifications, shared Redis quotas and outages, request idempotency, history boundaries, room/call mutual exclusion, stale credentials, lease fencing, synchronous local track stop, retries and migration compatibility. A failed private send retries the same request ID and produces one displayed delivered message.

The HTTPS check required an explicit shared test Redis configuration; absence correctly returned 503. API boot initially skipped its ordinary JSON parser after installing scoped raw/avatar middleware; the explicit global parser repair restored ordinary request bodies, while preserving the raw webhook and bounded avatar paths.

## Release and operator gates

GitHub Production environment has been restricted to main. Production database/key transfer requires the owner's authorization; a newly created Vercel Token must be submitted by the owner under the browser credential handoff rule. Until configured, protected production jobs cannot complete. See [guarded release configuration](../../deployment/phase-one-guarded-release.md).

Still required: successful PR/main CI, target-approved production backup/restore/migration, API/Pages SHA agreement, managed queue/cron cleanup proof, operations alert delivery where enabled, live Google profile completion, and verified APK publication/signature/hash. Do not promote an APK built against unpublished production contracts as the finished release.

Owner Android checks: install matching APK; grant/deny/retry microphone and audio; test keyboard focus and opaque creation footer; exercise two-account room/private audio isolation, call accept/reject/end, disconnect/reconnect and background interruption; confirm exit stops audio immediately; change language and relaunch; replace avatar and relogin. iOS remains deferred.

## Legacy change disposition

Four older mobile changes have all implementation tasks checked, but their own records retain provider/device acceptance or superseded preparation flows. They are retained rather than falsely archived as accepted. Current direct entry, optional profile, disabled processing and current room layout requirements take precedence. Deferred speech/assistance changes remain explicit; no completed checkbox or browser fixture enables them in production.
