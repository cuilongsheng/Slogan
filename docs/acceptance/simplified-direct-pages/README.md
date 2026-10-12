# Simplified direct communication acceptance

## Scope and target

The owner approved simplifying five prototype pages on 2026-10-12 and requested high-fidelity design that broadly retains the existing visual system. The new V2 section was created through the connected Figma Desktop Bridge. V1 originals remain unchanged. No API or persistence contract was removed.

File: `Slogan / 56nIowZmvBhb0QJvOlDQdU`; page: `02 UI`; section: `186:2347`.

| Page                  | Original V2 target | Application route            | Role                      |
| --------------------- | ------------------ | ---------------------------- | ------------------------- |
| Available partners    | `186:2348`         | `/partners`                  | Authenticated participant |
| Recent conversations  | `186:2369`         | `/messages`                  | Authenticated participant |
| Direct text chat      | `186:2389`         | `/messages/[conversationId]` | Conversation participant  |
| Incoming private call | `186:2407`         | `/calls/[callId]`            | Invited participant       |
| Active private call   | `186:2418`         | `/calls/[callId]`            | Call participant          |

[Bridge target ledger](../../design/simplified-direct-pages-targets.json), [original/runtime comparison and overlays](comparison.html).

Foundation readiness: existing V3 colors, Noto Sans SC typography, photo avatars, navigation and action components were inspected. The scoped V2 conversation row exposes Name, Detail and Unread properties. Circular call controls reuse existing colors and the original vector microphone. The phone and microphone PNGs were exported directly from Bridge nodes `186:2484` and `186:2341`; they are not approximated replacement icons.

## Visual evidence

The five screenshots use 390 × 844, English, Noto Sans SC, the same photos/content, fixed fixture time `2026-10-11T02:42:00Z`, Asia/Shanghai and DPR 1. Original images are exports of the approved new V2 targets; runtime images run the actual application screens. The fixture intercepts generated HTTP-client requests and supplies explicit authentication/media adapters. It does not prove production data, provider access or native audio.

| Region              | Result                                                                                                                                                                                            |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Partners and recent | Compact headings, availability/recent pill, 358 × 88 rows with 8 px gaps, original photos/action styles and navigation retained; subtitle/refresh/friends tab removed.                            |
| Chat                | Original back/phone vectors, consent banner, message bubbles, 288 × 50 input, send control and bottom safety toolbar aligned with V2. Received messages are explicitly selected before reporting. |
| Incoming            | Original circular photo and accept/decline actions retained; invitation combined with caller name.                                                                                                |
| Active              | Peer in heading, timer/photo/connection state retained, 72 px circular microphone/end controls and captions match V2.                                                                             |

Geometry, content and assets were checked directly using the side-by-side screenshots and overlays. Remaining differences are Noto Sans SC glyph rasterization and native web-text-field baseline/inline whitespace rendering; this record does not claim identical pixels. [Pixel metrics](pixel-metrics.json) are diagnostics, not an acceptance threshold. Native system chrome and audio remain owner-operated device checks.

## Executed verification

- Mobile lint and TypeScript: PASS.
- Mobile Jest: 52 suites, 176 tests PASS.
- Full visual/interaction harness: 30 tests PASS, including the 16 direct-page cases.
- Checks cover empty/error recovery, no Friends tab/fake conversations, View/unread semantics, personal history deletion, send retry identity, explicit received-message reporting, modal cancellation, device/reconnect/call states and immediate local audio shutdown on End call.
- Mobile Cloudflare Pages production web export: PASS (`EXPO_NO_DOTENV=1`, public mobile site origin).
- OpenSpec strict validation: change PASS; 36 current capabilities PASS.

All existing partner/conversation/message/call/read/hide/block/report operations remain AVAILABLE through the generated OpenAPI client. No new transport DTO, endpoint or schema is introduced by this layout revision. Independent backend authorization/concurrency evidence remains in [phase-one acceptance](../phase-one-completion/README.md).

## Release boundary

This record proves local implementation and browser-fixture verification. It does not assert production migration, cloud maintenance/alert delivery or publication of a matching APK. Those remain tracked in [phase-one release tasks](../../releases/phase-one-completion-tasks.md). Physical Android microphone/keyboard/two-device verification remains owner-operated.
