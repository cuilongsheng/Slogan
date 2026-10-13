# Revised mobile shell, login and room creation

The subsequent owner-requested subtitle removal and Discover toolbar revision are recorded in [follow-up/README.md](follow-up/README.md), with final captures and verification logs. The comparison viewer includes both revisions.

Recorded on 2026-10-13. Branch `codex/mobile-ui-v3`, based on `248b12378ba3ce9210af2fd73077ff9651fa8720`. The six latest owner requests supersede the previous no-main-heading / 18px-back-heading decision. This batch is not published to production.

## Targets and evidence

OpenSpec: `streamline-main-pages-and-live-updates`. Original Figma file `56nIowZmvBhb0QJvOlDQdU`, page `02 UI` (`102:2766`). All file inspection and original exports used the connected Desktop Bridge. No original nodes were changed.

| Target                 | Original node                                                | Runtime route / state                                                  |
| ---------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------- |
| Branded loading        | `206:2879`                                                   | `/`, unresolved session refresh, then 401 → `/sign-in`                 |
| Login                  | `118:2970`                                                   | `/sign-in`, Chinese, signed out                                        |
| Compact creation       | `190:2659`, capacity card `206:3129`, timing card `206:3121` | `/rooms/create`, eligible actor, instant/public and scheduled/password |
| Empty Partners         | `206:3032`                                                   | `/partners`, English, successful empty response                        |
| Empty Messages         | same owner-approved empty pattern                            | `/messages`, English, successful empty response                        |
| Discover heading       | `115:1197` and supplied latest header crop                   | `/rooms`, Chinese, controlled empty response                           |
| Me heading             | `152:1467`, owner override: centered main title              | `/me`, eligible actor, profile/account controls retained               |
| Back-heading alignment | `115:1425`, owner override: 16px                             | `/rooms/:id/session`, host, controlled room projection                 |

Original PNGs are in `figma/`; final running-screen PNGs are in `runtime/`. Open [comparison.html](comparison.html) for original/runtime pairs and an optional overlay. Images are displayed at their logical size; the files are not retouched, stretched, cropped or recolored.

The source creation frame has its blue capacity/privacy card outside the frame. `206:3129` was measured independently at `(13,380)`, `363×224` relative to the creation frame and exported as `figma/create-capacity.png`. The supplied complete screenshot confirms its intended position. The original `figma/create.png` therefore contains a blank region; it is not reconstructed as acceptance proof.

## Implementation and behavior

- The exact source logo was exported at 3× as `apps/mobile/assets/icons/slogan-mark-v3.png` and reused by loading/login. Session restoration has no added delay or network request. Loading also covers font/locale startup and guarded routes.
- Main tabs have centered localized titles. Partners/Messages use the source 28px heading; Discover uses 16px and Me 18px. All pages with Back use 16px headings aligned with the arrow, through shared headers or their feature header.
- Successful empty Partners/Messages states show the soft Refresh control without redundant copy. Refresh calls the existing authenticated list operation. Errors remain localized and actionable. Existing foreground polling, unread counts and tab navigation remain functional.
- Login uses the original logo/wordmark, labeled fields, registration link, primary action, divider and social options. The owner's explicit answer retains password recovery at the right of the Password label. WeChat remains disabled as previously requested; Google and password authentication remain wired to their existing services.
- Creation uses the revised topic/level card, vertically arranged capacity/access card, instant/scheduled card, actual two-hour end-time hint and opaque submit footer. Password expansion, scheduling, validation, level/capacity selection and creation operations remain functional.

## Source-to-runtime findings

Comparison viewport: Chromium web, 390×844 CSS pixels, DPR 1, loaded bundled Noto Sans SC faces, light theme. Web chrome is an existing preview asset; native OS chrome is outside this evidence. Controlled data responses are clearly fixtures, not production provider proof.

| Region                  | Result / observation                                                                                                                                                                                                                                                                       |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Loading / login brand   | Exact native-exported logo at 112×112. Wordmark size 24px and source placement checked against originals; no replacement asset.                                                                                                                                                            |
| Login fields / controls | Source field positions, 54px height, typography, borders, button/divider/social geometry restored. Recovery is the explicit authorized extra control. Disabled WeChat intentionally differs from enabled source artwork.                                                                   |
| Creation cards          | Topic `(16,139,358,223)`, capacity `(13,380,363,224)`, timing `(16,613,358,111)` and footer action `(16,751,350,56)` follow measured source geometry at this viewport. Back title is 16px by explicit override instead of the old source 28px.                                             |
| Empty state             | Source Refresh `(124,314,162,55)` and centered visible main title restored. The source text frame extends beyond its screen bounds; the owner requested actual visual centering.                                                                                                           |
| Main/back headings      | Main titles centered; back titles share the arrow row. Existing Me profile/actions, Discover dynamic data and room participant data are not replaced by static source content. Scope is the requested heading/layout revision, not a wholesale redraw of those screens.                    |
| Dynamic content         | Create retains the existing visible localized topic placeholder despite the source's empty field. The owner previously requested visible placeholders. Live end time, profile names, room occupancy and language vary with state. These are content/state differences, not altered layout. |
| Rendering               | Small glyph-edge differences from Chromium/Figma font rasterization are not treated as a layout match criterion. No native pixel-identity claim is made.                                                                                                                                   |

## Verification

| Check                       | Evidence                                                            | Result                                        |
| --------------------------- | ------------------------------------------------------------------- | --------------------------------------------- |
| Formatting                  | `checks/format.txt`                                                 | PASS                                          |
| Mobile typecheck            | `pnpm --filter @slogan/mobile typecheck`                            | PASS                                          |
| Lint                        | mobile source and changed browser/visual tests, zero warnings       | PASS                                          |
| Dependency boundaries       | `pnpm deps:check`, 824 modules / 3164 dependencies                  | PASS                                          |
| Mobile unit suites          | `checks/mobile-final.txt`                                           | 59 suites / 217 tests PASS                    |
| Routed browser flows        | `checks/browser-final.txt`                                          | 26 PASS, no retry                             |
| Visual/interactions harness | `checks/visual-final.txt`                                           | 47 PASS, no retry                             |
| Mobile iOS bundle export    | `checks/build.txt`                                                  | PASS; export is not an installed-device check |
| OpenSpec strict validation  | `openspec validate streamline-main-pages-and-live-updates --strict` | PASS                                          |

Browser coverage includes a pending restoration with exactly one refresh request, redirect to login, Google enabled / WeChat disabled, visible placeholders and password recovery. It also exercises profile edit/cancel/save, room settings/password/scheduling, consent gating, notifications, invitation candidates, foreground refresh and retained room controls. Harness captures render the same product components with controlled auth/API data; they do not measure LiveKit latency, real audio or production behavior.

The final recovery-label baseline correction was verified with one additional routed login test and recaptured in `runtime/login-zh.png`; see `checks/login-alignment.txt`. Password label glyphs end at y=411 and recovery glyphs also end at y=411. Mobile typecheck/lint and formatting were repeated after this style-only correction.

## Delivery boundary

Web implementation, functional regression and original-to-runtime comparison are complete for this revision. No API contract, database, provider configuration, room session ownership or deployment logic changed. Reverting this frontend batch restores the prior UI without data migration.

Android/iOS physical-device rendering, keyboard/safe-area behavior and audio permissions remain unverified for this batch. Public API/Pages and Android 0.0.70 still represent the preceding PR #23 release until this revision is separately merged and published. Neither the fixtures nor the export establish production or native acceptance.

PR #24: <https://github.com/cuilongsheng/Slogan/pull/24>. Automatic branch Pages deployment was observed for the initial revision, but a signed-out browser could not complete restoration. A no-cookie refresh with its explicit preview Origin returned 400 / `AUTH_CODE_REJECTED`; the production Origin returned the expected 401 / `REFRESH_TOKEN_INVALID`. The preview domain is not in the current browser-auth allowlist. No origin policy or provider configuration was weakened to make this branch preview work, and it is not offered as a functioning acceptance link. PR verification and Android build status are separate from the preceding production release.
