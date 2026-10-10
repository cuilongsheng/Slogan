# Voice room: four-column fidelity correction

Baseline: `46aee8a81f590e23f14ac5b5013f3c8adeef8c2e`. Branch:
`codex/voice-room-four-column-fidelity`. This restores the approved room screen;
it does not add an API, change a database schema, or alter room-entry behavior.

## Original and runtime evidence

- Figma Desktop Bridge: Slogan / `02 UI` / `115:1425`,
  `02 UI / Voice Room / Pilot V2 · review`.
- [Source snapshot](figma-source.json): 390 × 844 logical pixels, exported at 3×,
  2026-10-10 11:15 CST. The original frame was not edited by this task. During
  comparison, its rules and participant strip moved to y=116 and y=203;
  implementation and final captures use that latest captured revision.
- [Original](figma-original.png), [running component](runtime-390.png),
  [side-by-side](comparison.png), [overlay](overlay.png), and
  [interactive comparison](comparison.html). The HTML embeds those exact images.
- Runtime: real `VoiceRoomScreen` rendered through React Native Web, Chromium,
  390 × 844, DPR 3, Chinese, host, four members/six seats, 38 minutes remaining.
  Member/session/message data and portraits are explicitly isolated test fixtures.
  The portraits are original Bridge exports, never production fallback users.

## Cause and correction

The old grid used fixed 76px cards, 14px gaps, and wrapping. At a 360px viewport,
four cards require 346px but only 329px is available. Native Yoga moves the fourth
card to another row. Its 191px minimum height also reserved a second row even
for a four-seat room.

Rows now contain at most four columns, each owning 25% of the row, with wrapping
disabled. Long names truncate within their own column. Measured optical offsets
restore the original avatar centers without changing layout widths. Six seats
retain the original four-plus-two arrangement, with the last pair centered.
The strip has intrinsic height: the four-seat grid is 74px high; four members
and two empty seats produce a 148px grid. Space released by a missing second row
goes to chat, while the composer stays anchored to the bottom.

| Region | Final correction / measured result at 390px |
| --- | --- |
| Header | Level shares the metadata line; exit and more controls remain inside the viewport |
| Rules | Original x=16, y=116, width=358, minimum height=76, 16px corners |
| Members | Grid x=15, y=237, width=359; four first-row columns; second-row offset 92px |
| Avatars | Original 52px inside-stroke rings, 48px photos at x+2/y+1; flags, mute and removal badges use original positions |
| Empty seats | Original dashed ellipse exported through Bridge; source plus position restored |
| Chat | Original bubble color/radius and bottom placement; messages still scroll |
| Composer | Original y=771, 51px clipping frame around the 56px input; original send/mic positions |

Four bundled font faces previously shared the PostScript name `NotoSansSC-Thin`.
They now identify their actual Regular/Medium/SemiBold/Bold faces. Glyph outlines,
coverage and horizontal metrics are unchanged. [Font audit](font-audit.json)
compares original Bridge-exported Regular and Medium glyph outlines to the
bundled faces (ink-area differences below 0.04%). Browser/font rasterization still
differs from Figma export; this evidence does not establish pixel-identical
text rendering on Android.

## Verification

- Mobile typecheck and lint: PASS.
- Mobile Jest: 50 suites / 162 tests PASS.
- Playwright: 8 tests PASS. Four-column cases cover 320/360/390/412px viewports,
  long names, 2/4, 4/4, 4/6 and 6/6 occupancy; matched geometry and shrinking
  are asserted. Sending text, hold/release translation, host handoff selection,
  consent and device-warning retry remain operational under explicit adapters.
- Mobile Pages export and Android Hermes export: PASS.
- [Native Yoga probe](native-layout-probe.txt): actual installed React Native
  Yoga C++ engine, 12 cases across those widths and pixel ratios 1/2/3 PASS.
  The old 360px wrapping failure is reproduced in the same engine. This is an
  isolated layout test, not an Android full-screen screenshot or device test.
- OpenAPI/backend: existing operations retained; no contract changes required.

## Acceptance boundary

The source/runtime comparison and layout regressions are available for review.
Full Android 1:1 visual acceptance remains PARTIAL: no connected device or local
emulator was available. The user owns real-device testing. Device font rendering,
keyboard behavior, microphone permission/audio playback and two-device media
must be verified on the resulting APK. Local exports alone are not a published
APK or proof of a production deployment; release state is recorded separately.
