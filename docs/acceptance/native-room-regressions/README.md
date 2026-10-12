# Android room regression repair — 2026-10-12

Scope: the owner-reported 0.0.54 title/name corruption, wrapping status labels, unavailable microphone, extended entry wait, and bottom-tab refresh. This repairs existing phase-one behavior; no API, schema, provider-feature or permission scope beyond the established voice microphone capability changes.

## Causes and implementation

- RN fetch uses whatwg-fetch. The bounded transport buffered an ArrayBuffer and reconstructed Response; its native text reader converts individual UTF-8 bytes directly to characters. The old code reproducibly turns `测试房间` into `æµ...` using the actual installed native Response polyfill. Preserve the already decoded response text while retaining body-read timeout, cancellation, HTTP status and headers. No user records were rewritten.
- `expo-image-picker` had `microphonePermission: false`, adding RECORD_AUDIO to Android blocked permissions. The published 0.0.54 manifest has no recording permission, so native authorization cannot succeed. Remove that block, retain camera blocking, and declare the existing voice permission explicitly. Generated manifest contains RECORD_AUDIO. Actual APK verification now fails if it is absent. Genuine denied/blocked device warnings and settings recovery remain intact.
- Fixed status widths plus missing single-line constraints let Android wrap the level and LIVE labels. Use nonshrinking intrinsic widths, single-line text and a nonbreaking LIVE separator. Figma original remains unchanged.
- Initial joining incorrectly used credential issuance to identify reconnection. Use actual session phase. Fetch members alongside the media handshake, expose connected state without waiting for display data, ignore late entry data after disposal/exit and skip the duplicate first connection refresh. Server admission, access revocation and credentials remain authoritative.
- Bottom navigation replaced Stack routes, destroying each screen. Put the four unchanged public URLs in a lazy Expo Tabs group and navigate between retained instances. Reset the navigator by account identity; eligibility gates unmount protected contents on logout. Refresh discovery in place after first load; retain focused foreground polling for partners/messages. Tint all inactive icons consistently.

## Evidence

- Old native-polyfill UTF-8 regression: FAIL with the reported mojibake; fixed regression: PASS, including names and emoji. Node/browser Response alone would miss this regression.
- Real Expo router test: all four pages mount exactly once, Discover draft survives round-trip navigation. This is navigator evidence, not an Android device screenshot.
- Session regression: active connection does not wait for pending members; disposal during credentials does not connect media.
- Initial handshaking uses Joining room; existing reconnect recovery remains distinct.
- Original Figma: Desktop Bridge, Slogan `56nIowZmvBhb0QJvOlDQdU`, `02 UI`, frame `115:1425`, 390×844. Existing [source image](../voice-room-four-column-fidelity/figma-original.png) matches the inspected original geometry. [Current running Web fixture](header-runtime-web.png): 390×844, Chinese, four/six seats. Status labels are one line, 15px high; level minimum 44px and LIVE minimum 39px; metadata row 358×17px. Fixture has expired timing/no room message; those content states do not match the Figma sample. No full-screen pixel identity or native visual acceptance is claimed.
- Production controlled test room: UTF-8 create/read round trip PASS. HTTP timings: create 441ms, detail 290ms, credentials 2730ms, parallel members 527ms. The temporary LINK_ONLY room was exited and the test session logged out. These are one observation, not latency percentiles or WebRTC measurements.
- No connected Android device or installed emulator image was available. Real microphone publish/receive, OS permission prompts and native rendering remain owner-operated verification.

## Checks

- Mobile Jest: 53 suites / 182 tests PASS; post-type-fix transport/router focused tests PASS.
- Mobile typecheck and lint, dependency boundaries, formatting and strict OpenSpec validation: PASS.
- Expo web export: PASS. Room/discovery/reconnection browser harness: 14 tests PASS.
- Actual native manifest regenerated; recording permission present and camera remains blocked.

## Release boundary

Record CI, merged commit and verified APK separately after publication. Database migrations are unchanged. A web-page refresh cannot supply a missing Android manifest permission; an APK upgrade is required.
