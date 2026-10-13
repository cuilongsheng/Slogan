# Room experience release

Date: 2026-10-13 (Asia/Shanghai). Status: main/API/both Pages and Android 0.0.67 published and verified; native device acceptance remains pending.

## Source identity

- PR: [#22](https://github.com/cuilongsheng/Slogan/pull/22), merged.
- Candidate: `26a51a80a077a98c44adc1e94746ed9bd92da86f`.
- Main: `1b40fea9a332a377840848b0794aff275180a887`.
- Candidate verification: [38279656124](https://github.com/cuilongsheng/Slogan/actions/runs/38279656124), success.
- Candidate Android build: [38279656144](https://github.com/cuilongsheng/Slogan/actions/runs/38279656144), success with actual APK verification.
- Main delivery: [38319847768](https://github.com/cuilongsheng/Slogan/actions/runs/38319847768): main verification and guarded production API both passed.
- Main Android delivery: [38319847728](https://github.com/cuilongsheng/Slogan/actions/runs/38319847728), build and publish success.

## Behavior

Native JSON decoding and RECORD_AUDIO are restored. Room entry removes redundant detail/provider reads while preserving server authorization, passwords and explicit processing consent. The admitted room appears during SDK connection. Local leave/end stops audio and navigates directly to discovery; actor-bound persisted delivery and durable provider cleanup continue independently. Reporting, inactive navigation tint, retained tabs and idle discovery are repaired.

Production API deployment follows encrypted backup, isolated restore/invariant checks and approved-target migration. Main Pages publication waits for that exact API commit. APK publication requires the exact main/API/Pages source and the controlled certificate, actual recording permission, package/ABI/version and immutable hash.

## Evidence and limitations

Local mobile 202 tests, routed browser 25 checks, visual harness 34 checks, format/lint/types and Android bundle export pass. Candidate CI also runs backend tests, generated-contract checks, builds and browser/Pages regressions. See [implementation evidence](../acceptance/room-entry-lifecycle/README.md), [lifecycle audit and diagrams](../architecture/livekit-room-lifecycle.md), and [interview readiness tasks](../acceptance/interview-readiness-2026-10-13.md).

All three public runtime descriptors match main. Sixteen controlled production checks pass: trial login/profile, read-only RBAC, mutual idle discovery without manual heartbeat, Unicode creation/direct admission, real LiveKit credentials with parallel member data, leave/end, denied ended-room credentials, terminal cleanup, mutual discovery after end, maintenance receipt and unauthenticated cron denial. The room is ENDED and effective live-room occupancy/pending cleanup are zero. Historical member rows can remain ACTIVE on ended rooms; the original smoke script incorrectly expected all historical rows to be LEFT. Corrected verification checks effective occupancy and confirms discovery after end; business history was preserved. No physical device is attached here. Two-device audible speech, microphone permissions, native keyboard/footer, interruption and Google authorization remain owner/device acceptance. Google Android registration matches the controlled package/signature; configuration is not login evidence.

The prior production receipt is historical and is preserved independently.

## Published APK and timing sample

- Version `0.0.67`, code `1067`, arm64, 85554321 bytes.
- SHA-256 `98a795d5b50c881e10de11542872428bff1e8af8c035600db7837549934d270b`.
- Downloaded public APK equals immutable Release metadata; package/source/API origin, current Google public client, existing certificate, RECORD_AUDIO and keyboard resize verified.
- [Download APK](https://slogan-preview-mobile.pages.dev/downloads/android.apk); [immutable release](https://github.com/cuilongsheng/Slogan/releases/tag/android-1b40fea9a332a377840848b0794aff275180a887).

One warm HTTP sample from the operator workstation, not a percentile or device benchmark:

| Operation | Milliseconds |
| --- | ---: |
| Create | 220 |
| Join | 247 |
| Members | 432 |
| Host credentials | 2274 |
| Peer credentials | 4843 |
| Leave | 271 |
| End | 437 |

Credentials still took 2.3–4.8 seconds in this concurrent two-participant sample. This does not establish instant voice or identify an individual backend/provider phase as the cause. The frontend displays the admitted room before credentials complete. Native audible/publishable timing remains unmeasured. Further latency claims require stage-level measurement rather than removing authorization or treating UI display as voice readiness.
