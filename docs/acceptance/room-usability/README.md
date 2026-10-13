# Room usability — development record

## Scope and state

Owner items 1–8 are implemented in the `codex/room-usability-followup` worktree. The owner explicitly withdrew item 9 (Partners) and subsequently requested that tests and deployment wait until the final combined batch. No new public deployment or APK has been produced for this change. Implementation completion is not runtime acceptance.

## Visual authority

Figma Desktop Bridge: Slogan `56nIowZmvBhb0QJvOlDQdU`, page `102:2766`, original voice room `115:1425`, inline rule text `199:2769`, invitation picker `111:884`.

[Original room export](figma-original-room.png) is the current original 390×844 frame. It was not rebuilt or modified to claim fidelity. The owner explicitly authorized the new 402×874 desktop maximum, two cartoon defaults, dark disabled assistance, direct copying and simpler recovery interaction. Four fixed seat columns and the original photos/rings/badges remain.

| Region      | Implementation / source                                                                                                                                                                                                                                                |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Web shell   | One shared `phonePreview` for RoomPage and VoicePage; 402×874 maximum, smaller viewports fluid. Standard iPhone 17 official [physical resolution](https://www.apple.com/iphone-17/specs/) is 1206×2622; logical dimensions are the 3× conversion used by this preview. |
| Rule banner | Single localized text flow, inline title and body; original 11px/17px Chinese body, original speaker icon and dark background. English uses its existing system-font body styling.                                                                                     |
| Defaults    | Editable vector artwork in Desktop Bridge section `200:2771`; male `200:2772`, female `200:2790`; exported 256px PNGs and corresponding SVG sources committed. Existing custom/provider images remain preferred; errors render bundled artwork.                        |
| Assistance  | Existing 394px sheet geometry; authorized dark room palette: #34274F surface, #FFFFFF title, #C8BCE0 secondary text, #514267 disabled action. Unavailable state does not own a recorder.                                                                               |
| Invitations | Host opens the in-app picker immediately; member receives localized host-only explanation. No authorization expansion.                                                                                                                                                 |
| Recovery    | Same room component remains mounted during SDK reconnect, with inline state; composer draft and controls remain. Native/browser network recovery and actual audio latency still need runtime evidence.                                                                 |

## API readiness

- **READY, existing:** authenticated room/member reads, available people, host invitation creation, time extension, leave/end and high-entropy `shareUrl`.
- **Implemented, acceptance pending:** validated optional `male`/`female` variant on public `GET /v1/avatars/default`. OpenAPI and generated client types were regenerated from NestJS decorators.
- No personal gender field is added to member responses. Declared female profiles choose the feminine default; omitted/other gender uses the masculine illustration as a generic visual fallback without modifying profile data.
- Share copies the already returned URL on Web/native, without another modal, share sheet or network request. Success/failure is localized. Host power ends; the remaining-time label opens extension. Overflow remains exactly report, leave and copy.

## Audio and concurrency reasoning

[LiveKit Room options](https://docs.livekit.io/reference/client-sdk-js/interfaces/RoomOptions.html) support supplying a shared AudioContext via webAudioMix. The Web client resumes it synchronously from pointer/keyboard gestures before an awaited admission, reuses it across route changes, and considers playback allowed only when both SDK state and the context indicate readiness. This does not bypass browser policies or persist an invented permission approval. Native AudioSession and outputs replace browser autoplay checks on Android.

Successful microphone probes can be reused for five minutes after a fresh permission read. Permission/device changes, explicit retry and capture failures invalidate them; the cache retains no stream. Native automatic checks do not repeatedly request an already denied permission. Browsers without permission-query support conservatively probe again. Device-check progress is silent; actual failures remain visible.

The SDK retains its existing reconnect policy and Room. Application room and member reads now run in parallel and share existing refresh/exit generation fencing. Removed/ended membership still exits; a terminal SDK network disconnection exposes an explicit fresh admission retry. No fabricated recovery timing or audio-readiness result is reported.

## Verification — 2026-10-13

The owner subsequently authorized the combined test and deployment batch. Formatting, dependency boundaries, lint, types, generated contract/client checks and application builds passed. Mobile tests passed (59 suites / 217 cases); backend unit, integration, HTTP E2E and runtime suites passed. The final visual harness passed all 42 cases, and the real app browser workflows passed 26 cases.

Runtime captures in this directory verify the bounded 402×874 desktop phone frame, fluid 390px/320px views, direct clipboard behavior, dark unavailable assistance, cartoon fallback images and retained inline recovery. Original Figma/source frames and runtime states were inspected directly. Explicit owner changes (inline rules, avatars and sheet theme) are recorded above; no generic pixel-identical claim is made.

Native media tests cover permission denial/retry, probe reuse/invalidation, audio-session ownership and browser autoplay separation. Web tests cover cached probes/revocation and shared gesture audio; session tests cover generation fencing and parallel member/detail refresh. These are adapter and browser evidence, not real Android audio evidence. No device was attached, so Android microphone, output routing, interruptions/reconnect and two-device audio remain owner-operated checks after APK installation.

Deployment is proceeding through the existing guarded API/Pages/APK workflow; publication is recorded separately after all remote gates finish.
