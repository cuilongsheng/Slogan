# Interview demonstration readiness

Reviewed 2026-10-13 (Asia/Shanghai). Candidate `26a51a80a077a98c44adc1e94746ed9bd92da86f`, merged by PR #22 into `1b40fea9a332a377840848b0794aff275180a887`. This is a delivery record, not a new product requirement or a claim of zero defects.

## Release tasks

- [x] Compare room lifecycle with official LiveKit examples and SDK; retain authoritative admission and SDK transport ownership.
- [x] Repair native UTF-8 decoding and RECORD_AUDIO declaration; enforce the permission in actual APK verification.
- [x] Remove redundant admission/detail/provider reads and end cleanup waits; keep the admitted room visible during connection and return locally on exit.
- [x] Preserve explicit consent, password recovery, actor-bound exit persistence and final generation/lease authorization.
- [x] Repair room/member reporting, navigation tint, retained tabs and idle discovery.
- [x] Execute local mobile 202 tests, routed browser 25 checks and visual harness 34 checks; format, lint, types and Android bundle export pass.
- [x] Latest PR CI and actual Android APK build/verification pass; merge PR #22.
- [x] Finish main backup/isolated restore/migration/API/Pages and matching APK publication.
- [x] Verify public API/Pages/APK source alignment, actual APK bytes/hash/signature/permissions, and controlled production smoke (16 checks).
- [ ] Verify two-device audio and native interaction against the published APK.

## Evidence ledger

| Demonstration path            | Established evidence                                                                                             | Remaining boundary                                                                                                                                                       |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Provisioned login and profile | PR CI, API tests and browser flows; optional details/adult confirmation retained                                 | Live Google Cloud Android package/signature registration matches the controlled APK certificate; real authorization/onboarding is not proved by this configuration check |
| Discover and create           | Routed browser and actual component captures; three ranges and four-column constraints                           | Native keyboard/footer and narrow-device typography require device capture                                                                                               |
| Partners                      | Shared Redis integration, caller-only presence renewal, terminal-room occupancy and pagination tests             | New build must be checked on independent foreground devices; old independent HTTP sessions do not prove the old device exclusion was reproduced                          |
| Join and voice                | Admission, credential authorization/race tests; same official SDK Room, muted device probe and connection states | Actual microphone publication, peer audibility and click-to-voice time require two devices                                                                               |
| Leave/end                     | Deferred-promise and persisted outbox tests; server commit before cleanup, post-response queue scheduling        | New production worker cleanup reached terminal state; immediate native audio cessation remains a device check                                                            |
| Private chat/calls            | Existing participant, idempotency, unread/blocking, mutual-exclusion tests; browser fixtures                     | Historical cloud HTTP success is not new-build two-party audible call evidence                                                                                           |
| Administration                | Room-only report target migration/security tests; read-only trial forbids private management                     | Production nullable-target migration and read-only trial RBAC smoke pass                                                                                                 |
| Delivery/recovery             | Main-only encrypted backup, isolated restore/invariants, migration gates; Pages/API and APK source gates         | All main release gates pass; published APK 0.0.67 bytes/source/signature/permission verified                                                                             |

## Findings and scope

The reported UTF-8 corruption, missing microphone permission, duplicated entry reads, cleanup on the response path, inactive Discover tint, room report target assumptions and idle presence/query defects have source-backed repairs. The latest PR/main CI and guarded production delivery pass. APK 0.0.67 matches the main/API/Pages source; actual downloaded bytes/signature/recording permission are verified. A sixteen-check controlled production smoke passes. The release record retains the correction from historical member count to effective occupancy, without changing business data.

Room text currently uses foreground cursor polling with an idle backoff from two to ten seconds and error backoff up to thirty seconds. Room authorization/member refresh runs every fifteen seconds while active plus SDK participant changes; exit disposes both. This is a deliberate current transport design, not an unbounded recursive request loop. It can still create observable traffic and is not represented as a push-only chat architecture.

Public trial identities are shared. Another visitor can occupy the same identity; the README already states this limitation. A reliable interview should use two controlled independent identities, not simultaneous visitors competing over one trial account. No unknown user's membership should be forcibly ended to make a demonstration pass.

WeChat, email registration/recovery, expression assistance, continuous speech processing and iOS remain explicitly deferred. Disabled entry points and README boundaries must stay consistent; neither dormant backend code nor a visible design establishes a released feature. Operational alert delivery is also not established by a scheduled scan or successful CI alone.

Google Cloud inspection found `Slogan Android` registered to `com.slogan.mobile` with SHA-1 `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25`, matching the controlled APK certificate. Google Cloud audience is External/Testing with zero listed test users. This alone is not a login blocker: Google documents an exception for applications requesting only openid/email/profile, as the Web adapter does. Production branding/publishing and actual Google login remain distinct checks. See [Google OAuth app state overview](https://developers.google.com/identity/protocols/oauth2/production-readiness/overview). No OAuth configuration was changed. New-build provider authorization remains a distinct device check.

The attached Android devices inventory is empty in this environment. Automated and Web evidence cannot establish native audio/fidelity acceptance. This remains a specific outstanding verification boundary, not a reason to mark the whole project accepted.

## Demonstration gate

Do not call the project fully demonstration-ready until the release and device items above are evidenced. The minimal walkthrough is: sign in two independent identities, confirm mutual availability, create a password-free room, join, explicitly enable both microphones, hear speech in both directions, send room text, leave and end without a terminal page, then verify private conversation history and read-only administration. Repeat once after background/foreground and network interruption. Record actual timings rather than promise zero loading.

See [lifecycle diagrams](../architecture/livekit-room-lifecycle.md), [current implementation evidence](room-entry-lifecycle/README.md), and [reporting/discovery evidence](room-reporting-and-discovery/README.md). The legacy phase-one receipt remains historical and is not silently relabeled as current acceptance.

Measured warm HTTP sample: create 220 ms, join 247 ms, host credentials 2274 ms, peer credentials 4843 ms, leave 271 ms and end 437 ms. Credential latency remains an observable wait before audio readiness. Do not describe the project as instant voice or fully demonstration-ready solely from the admission/display optimization. See [release receipt](../releases/2026-10-13-room-experience.md).
