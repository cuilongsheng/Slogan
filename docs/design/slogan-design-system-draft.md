# Slogan Design System — reference extraction and draft

Status: **visual review failed; design direction and high-fidelity entry gate are not approved**. The Figma variables, components, and `02 UI` frames described below are drafts. Existing Figma values, screenshot observations, and new Slogan candidates are distinguished below. No production code is changed here.

The 2026-09-24 review rejected the high-fidelity result. The earlier work counted variables and component sets but did not demonstrate that representative instances reproduce the references' information density, type hierarchy, image/avatar treatment, compact controls, or desktop navigation rhythm. Authentication/profile drafts use oversized isolated fields and excessive empty space; admin drafts use tiny table type in a wide, sparse shell. These are observed defects, not approved Slogan patterns. Reinspect the raster sources at useful zoom through Desktop Bridge, record dimensions and confidence per reference, rebuild representative tokens/components, then review two or three pilot screens before expanding pages. Do not treat the existing `02 UI` expansion as approved.

### V2 visual review pilot (awaiting product-owner review)

- [Visual Audit & Pilot Components / V2](https://www.figma.com/design/56nIowZmvBhb0QJvOlDQdU/Slogan?node-id=115-1110) records the reference nodes and approximate card anatomy. The `RoomCard / V2` component set (`115:1181`) has open, password and full variants; `RoomStage / V2` (`115:1424`) has speaking and idle variants. An original six-person avatar sheet is saved at [assets/slogan-avatar-contact-sheet-v1.png](assets/slogan-avatar-contact-sheet-v1.png) and used only for portraits.
- The V2 card uses a 132 px height, 20 px radius, 18 px topic, 36 px host portrait, 29 px audience portraits and a separate capacity badge. Its three background roles and height are Figma variables; topic, host, time, capacity and corner radius use existing or new metrics. These are **pilot candidates**, derived from raster proportions and checked at 390 × 844, not exact source measurements.
- [Room list pilot](https://www.figma.com/design/56nIowZmvBhb0QJvOlDQdU/Slogan?node-id=115-1197) and [voice-room pilot](https://www.figma.com/design/56nIowZmvBhb0QJvOlDQdU/Slogan?node-id=115-1425) are isolated in `02 UI / Visual Review / Pilot V2`. The room uses a gradient shared-speaking stage, visible rules, 4 occupied and 2 vacant seats, one-line join notice, chat, private expression entry and separate bottom send/mic controls. The first room card links to the voice-room pilot. Neither page is approved; do not propagate V2 styling to other pages before review.

## Evidence and boundaries

- Reference board: [six mobile and three desktop screenshots](https://www.figma.com/design/56nIowZmvBhb0QJvOlDQdU/Slogan?node-id=59-1564). They are raster references. The six mobile images are 1200 × 2664 and appear to represent roughly 400 × 888 logical pixels; all inferred logical sizes are estimates, not source design measurements.
- Existing Slogan source: `00 Foundations` (`22:72`), `Components / Core` (`22:145`), and current Figma variables. Slogan already has a purple brand scale, semantic light surfaces, 4–40 spacing values, 10/14/20/28/full radii, 12/14/16/20/28/34 type sizes, 56 px primary buttons, and a 191 px RoomCard.
- Keep only reusable visual characteristics from the screenshots: information density, hierarchy, card anatomy, avatar sizes, status treatment, compact chips, and persistent navigation. Do not reuse their logos, photos, gradients, illustrations, copy, or product-specific layout.
- The three new desktop images are `100:1999` (Grafana website mega menu), `100:2002` (documentation page), and `100:2005` (documentation page). Use them **only to extract transferable token details**. They do not prescribe Slogan's admin page structure, navigation tree, components, features, or permissions.

## Direction for review

Slogan should feel **clear, calm, and conversation-first**: light canvas, strong dark text, purple as the primary action, restrained mint/coral/amber for semantic states, and a quieter dark voice-room surface. Use solid fills or Slogan's own restrained gradients; no photographic backgrounds. Keep the current Noto Sans SC family until a typography sample is reviewed in both Chinese and English.

## Foundation tokens

The earlier table was a **starter set**, not a complete foundation. The complete audit has three layers: primitives (raw values), semantic roles (what a value means), and component tokens (where it is applied). A category can be listed here without immediately creating dozens of Figma variables. Create and validate values needed by the pilot first.

| Group | Draft tokens / decisions | Values and status |
| --- | --- | --- |
| Color primitives | `purple/50,100,500,600,700`; `neutral/0,25,50,100,200,500,700,900`; `mint`, `coral`, `sky`, `amber`, `red` | **Existing Figma values.** Keep them as the starting palette; do not sample reference-brand colors. |
| Semantic colors | `color/bg/canvas,surface,subtle,brand,brand-soft,room`; `color/text/primary,secondary,tertiary,inverse,brand,error`; `color/border/default,strong,focus,error`; `color/state/success,warning,error,info,disabled,selected,online,speaking,muted` | First roles **partly existing**; new roles are **proposals**. Resolve light surfaces, dark room, desktop navigation, and interactive states against pilot screens. |
| Gradient | `gradient/brand-soft`, `gradient/room` | **Proposal.** Each must specify stops, angle, intended surface, and solid-color fallback. No screenshot background or branded gradient is reused. |
| Typography family/weight | Noto Sans SC with system fallback; Regular 400, Medium 500, Bold 700 | **Draft.** Confirm actual Figma font availability and Chinese/English rendering. Define family and weight separately from size. |
| Typography scale | caption 12/18; body-sm 14/20; body 16/24; section 20/28; title 28/38; display 34/44; button 16/24 | Sizes mostly **existing**; line heights are **draft estimates**. Add role names, tracking (default 0 pending review), max lines, overflow and numeric alignment rules. Test Chinese and English truncation. |
| Spacing | 4, 8, 12, 16, 24, 32, 40; candidate 48, 64 | 4–40 **existing Figma**. 48/64 **proposal** for page sections and desktop layouts. |
| Layout/grid | mobile viewport 390 × 844 pilot; horizontal page inset 16/24 candidate; admin content max width, columns and responsive breakpoints to derive from Slogan's own prototype | **Proposal.** Desktop screenshots do not determine the admin layout. Define safe-area and responsive rules when pilot pages are approved. |
| Size | touch target min 44; primary control 56; avatar 24/32/48/64; icon canvas 24; navigation height, sidebar width, card min/max height and content width | 44/56 and some component sizes **existing**; other values **candidates**. Each size needs a component or layout use case. |
| Radius | 10, 14, 20, 28, full | **Existing Figma.** Suggested use: input 14; cards 20; modal 28; pills full. Avoid adding extra radius values without a real component need. |
| Border/stroke | width 1; focus 2; default/strong/interactive/error colors; divider and selected-rail usage | **Proposal** based on existing field treatment and desktop screenshots. Do not use border color as the only selected-state signal. |
| Shadow/elevation | `shadow/card`: 0 4 16 rgba(29,27,32,.08); `shadow/floating`: 0 10 30 rgba(29,27,32,.14); layer order for page, sticky nav, dropdown, modal, toast | Shadows are **proposals**, not measured values. Prefer fill/border for cards; reserve elevation for floating surfaces. Define stacking order without assuming CSS z-index numbers in Figma. |
| Opacity | disabled content, scrim, hover/pressed overlay | **Open candidates.** Set after contrast checks; avoid reducing important text contrast merely to convey disabled state. |
| Motion | duration/short, duration/medium; easing/standard, easing/emphasized; reduced-motion behavior | **Open candidates.** Define only for meaningful transitions after testing interactions. Avoid motion as the sole state indicator. |
| Iconography | 24 × 24 default canvas, rounded 1.8 px outline; 16/20 sizes only where density requires; clear optical alignment | **Implemented for generic icons.** The 54 original SVGs are editable Figma components; product artwork remains a separate decision. |
| Accessibility/localization | contrast targets, keyboard focus, target size, Chinese/English expansion, empty/error text length | **Acceptance rules**, not all Figma variables. Validate on the pilot and desktop layout. |

The reference board suggests compact room cards around **120 logical px** and small audience avatars around **24–32 px**, but those are raster estimates. Existing Slogan `Room / Card` is **342 × 191 px**. The new **358 × 124 px** compact card is a pilot candidate, not yet an approved replacement.

### Screenshot-by-screenshot extraction (Desktop Bridge, 2026-09-24)

The table records **transferable patterns**, not layouts, artwork, brand colors, copy, or behavior to reproduce. Confidence is high for hierarchy/anatomy and low for exact logical pixels because the sources are raster exports.

| Reference node | Observed visual detail | Candidate Slogan token/component | Confidence |
| --- | --- | --- | --- |
| `59:1645` messages/list | Quiet white surface, strong name versus secondary preview, circular avatars, hairline separators, persistent five-item bottom navigation, generous row touch area | `ListRow`, `Avatar`, `Divider`, `MobileNavigation`; body 14–16, metadata 12–14, avatar 40–56, row about 72–88 logical px | High anatomy; medium size |
| `59:1642` profile | Soft tinted promotional band, 2-up stat cards, progress ring, primary pill button, membership comparison with visual hierarchy | `StatCard`, `ProgressRing`, `Button`, `FeatureComparison`; card radius around 16–20, 16–24 inner padding | High anatomy; low size |
| `59:1639` room discovery overlay | Full-height dark overlay/drawer, dense room rows, round avatars, compact language and count tags, compact action controls | `RoomDrawer`, `RoomListRow`, `Avatar`, `Badge`; dark scrim, compact 36–44 control, 48–64 avatar | High anatomy; medium size |
| `59:1566` people discovery | Active pill tabs, narrow colored announcement band, profile list rows, online dot, language indicators, tag cluster, right aligned action pill | `Tabs`, `Announcement`, `PersonRow`, `OnlineStatus`, `Tag`, `Button`; chip 24–32 high, avatar about 64 logical px | High anatomy; medium size |
| `59:1636` room list | **Compact full-width tinted room tiles**, small metadata pills at top, topic as strongest line, host identity bottom-left, overlapped audience avatars and numeric count bottom-right, roughly 10–12 logical px between tiles | `RoomCard/Compact`, `RoomMetaBadge`, `AvatarStack`, `LiveIndicator`; tile about 116–132 high, radius about 16–20, inset 12–16 | High anatomy; medium size |
| `104:48` live room | **The room is the entire viewport**: immersive full-bleed color, header/host actions at top, one large shared focal stage, horizontal participant strip, live activity/chat layered below, persistent composer and actions at bottom. This is a spatial structure, not a grid of participant cards. | `RoomHeader`, `RoomStage`, `ParticipantStrip`, `ChatMessage`, `LiveAction`, `Composer`, `AIHint`; stage about 250–300 logical px, participant avatar about 40–48, bottom action target ≥44 | High structure; low pixel values |
| `100:1999` desktop menu | Dense nested navigation, multi-column information hierarchy, quiet divider and floating surface | admin sidebar labels/indentation, overlay elevation, compact navigation rhythm | High hierarchy; low pixel values |
| `100:2002` desktop docs | Narrow left navigation, nested active rail, quiet off-white sidebar, visible main content width, right secondary rail | `AdminSidebarItem`, `Breadcrumb`, active rail, content column and divider tokens | High hierarchy; low pixel values |
| `100:2005` desktop docs | Compact search at top of sidebar, small section labels, selected row tint and accent rail, readable content/notice blocks | `AdminSearch`, `AdminSidebarGroup`, `Notice`, focus/selected states | High hierarchy; low pixel values |

**Design correction:** the first `02 UI` room screen uses a 2×2 grid of participant cards and does not convey a shared room. Replace that composition only after the referenced tokens and components are recorded and validated. The first room-list screen's 182 px white cards are too tall and sparse compared with the compact, tinted reference; replace them with a Slogan-specific compact card without copying reference artwork or backgrounds.

### Figma build and review state

- [Reference Tokens / V1](https://www.figma.com/design/56nIowZmvBhb0QJvOlDQdU/Slogan?node-id=104-446) shows the earlier estimated dimensions and candidate roles. The recorded Figma count was **126 variables** across Primitives (37), Semantic (42), and Metrics (47); this is an inventory, not evidence that the token choices passed visual review. The later expression-assistance addition uses `purple/assist-panel` and its semantic alias `color/bg/assist-panel`; both have explicit scopes and web code syntax.
- [Reference Components / V1](https://www.figma.com/design/56nIowZmvBhb0QJvOlDQdU/Slogan?node-id=104-573) has a recorded **17 component sets and 55 variants**: Button, Input, Avatar/Presence, Badge, Tabs, Mobile Navigation, Admin Sidebar Item, RoomCard/Compact, RoomHeader, Participant, ChatMessage, SpeakingQueue, TopicCard, AIHint, Composer, RoomStage, and Admin Safety TableRow. This count does not establish visual quality, completeness, or correct token binding. Existing modal, sheet, and upload components remain in the earlier library.
- [02 UI](https://www.figma.com/design/56nIowZmvBhb0QJvOlDQdU/Slogan?node-id=102-2766) contains redesigned mobile [room list](https://www.figma.com/design/56nIowZmvBhb0QJvOlDQdU/Slogan?node-id=104-858) and [voice room](https://www.figma.com/design/56nIowZmvBhb0QJvOlDQdU/Slogan?node-id=104-954). The admin safety cases screen remains marked Draft. The two mobile screenshots were checked for visible clipping and spacing; the direction still needs the product owner's visual review.
- The room list uses 124 px tinted cards with CEFR/category, status, topic, host, remaining time, people preview, and capacity. The voice room uses a full-viewport ambient surface, shared stage, participant strip, speaking queue, chat activity, and persistent composer. No reference photo, artwork, branding, or background was reused.
- [SVG Icons / V1](https://www.figma.com/design/56nIowZmvBhb0QJvOlDQdU/Slogan?node-id=105-1058) contains 54 original editable 24 × 24 icon components. The [source SVGs and remaining asset list](icons/README.md) are in this repository. Major icon placeholders on the two mobile screens and admin draft now use these vectors. The two redesigned screens have not yet been verified in Present mode as an interaction prototype.

### Private native-language expression assistance

The first high-fidelity voice-room pass omitted a required V1 flow. [OpenSpec AI expression assistance](../../openspec/specs/ai-expression-assistance/spec.md) and [temporary speech processing](../../openspec/specs/temporary-speech-processing/spec.md) define an explicit, private in-room request: native-language text or a short voice clip of at most 30 seconds produces an English expression for the requesting member. The room microphone does not trigger this request or broadcast its input or result.

- [Voice-room entry](https://www.figma.com/design/56nIowZmvBhb0QJvOlDQdU/Slogan?node-id=107-1740) opens a [private overlay](https://www.figma.com/design/56nIowZmvBhb0QJvOlDQdU/Slogan?node-id=107-1747). The entry is separate from the room microphone and states that only the requester can see the result.
- [ExpressionAssist / Sheet](https://www.figma.com/design/56nIowZmvBhb0QJvOlDQdU/Slogan?node-id=107-1722) has reusable Consent, ConsentDetails, Ready, Recording, Loading, Result, TextInput, Error, and Quota variants. The first-use path shows persistent voice-processing consent; every audio request has its own confirmation. Text input does not require voice consent.
- The [result state](https://www.figma.com/design/56nIowZmvBhb0QJvOlDQdU/Slogan?node-id=107-1671) shows a primary English phrase, an optional alternative with tone, and the AI error notice. It never auto-plays or speaks for the user. Failure offers retry or text fallback without changing room media; quota exhaustion leaves the room usable.
- [Low-fi flow note](https://www.figma.com/design/56nIowZmvBhb0QJvOlDQdU/Slogan?node-id=108-1786) maps the same-screen entry and overlay states without duplicating full room screens. Native Figma prototype links connect the entry, consent, recording, loading, result, and text routes; the text field and recording timer remain illustrative until runtime implementation.

### Voice-room pilot revision (Desktop Bridge, 2026-09-24)

The [voice-room pilot](https://www.figma.com/design/56nIowZmvBhb0QJvOlDQdU/Slogan?node-id=104-954) now illustrates a room with capacity 6 and 4 occupants. Its two vacant slots are host-only invite actions. The implementation rule is `vacant slots = configured capacity − current occupants`; invitation does not reserve a slot. The static Figma sample is arranged in two rows, not a runtime wrapping layout.

The member component places a 14 × 10 flag badge at the avatar's upper-left, with the identity marker and name together immediately below. Only muted members show a centered 16 px mic-off SVG on a 28 px dark overlay. The host marker uses a crown in place of an undersized character. The host view shows a remove action on other members; it opens a confirmation overlay. The persistent room-rules notice uses Slogan's own rule categories. The bottom composer has a separate input field, then external send and microphone buttons on its right. The header uses a compact power/exit icon and a separate three-dot report menu. These are reusable components and semantic/size variables in `00 Foundations`; the menu, report form, remove confirmation, invite sheet, and host-exit handoff sheet are in `02 UI`.

The local [country flag collection](icons/country-flags/README.md) contains 249 ISO 3166-1 alpha-2 source SVGs and a code/name manifest. The pilot still uses illustrative Figma flag instances; the full 249-flag collection has **not** been imported into Figma. Select actual flags from explicit member country codes during implementation. Overlay entry links are connected in Figma; form input, submit, invitation delivery, removal, and host transfer require runtime behavior and remain visual prototype states.

### Desktop screenshot details worth translating into Slogan tokens

| Reusable detail observed | Slogan candidate to test | Boundary |
| --- | --- | --- |
| Strong heading/body/metadata contrast | `text/title` 20–28, `text/body` 14–16, `text/meta` 12–14; line heights from the type scale above | Candidate values; screenshot export scale is unknown, so these are not exact measurements. |
| Dense but readable navigation and nested labels | `space/nav-item` 8/12, `size/nav-row` 36–40, indentation step 12–16 | Define Slogan's navigation structure from its own admin prototype. |
| Quiet selection and hover emphasis | `color/state/selected` soft tint, `border/selected` brand accent, `color/state/hover` subtle neutral | Use Slogan purple rather than Grafana orange; check keyboard focus separately. |
| Fine dividers, bounded notices and floating menu | `border/default` 1, `radius/notice` 10–14, `shadow/floating` only for overlay | Do not copy the menu composition or promotional card. |
| Compact search and utility controls | `size/control/compact` 36–40, padding 8/12, icon 16–20 | Candidate; maintain an adequate clickable target in the final admin UI. |

These screenshots support a **visual token audit**, not an admin page design. Admin forms, tables, case detail, filters, and actions still need Slogan requirements and prototype decisions.

## Component contract for the pilot

| Component | Draft size/anatomy | States or variants to cover |
| --- | --- | --- |
| Button | primary 56 px high; compact 44–48 px candidate; label 16/24 | primary/secondary/quiet/destructive; default/pressed/disabled/loading; optional icon slot |
| Input | field control 56 px high; label/help/error outside the control; 14 px radius | empty/focused/filled/error/disabled; text/select/password/search |
| Avatar | 24, 32, 48, 64 px candidates; circular crop and initials fallback | online/offline/speaking/host; no copied reference portraits |
| Badge / Tag | 24–28 px high candidate, 8–12 px horizontal padding, full radius | CEFR, language, room status, password, host, online, muted, warning |
| Card | 16–20 px padding candidate; 20 px radius; fill or 1 px border before shadow | default/selected/disabled/urgent |
| Tabs | minimum 44 px target; selected indicator or filled pill | default/selected/disabled; Chinese/English label lengths |
| Navigation | mobile bottom bar uses existing 84 px frame as baseline; admin uses a separate desktop shell | active/inactive/notification/permission denied |
| Modal / Sheet | existing Figma Modal 342 × 420 and Bottom Sheet 360 × 360 are starting references | confirmation/destructive/error/success; focus, close, scroll |
| RoomCard | topic, CEFR, status, people count, time, host and join method; compact vs comfortable pilot | public/password/link, available/full/ended/disabled, loading |
| SpeakerCard | avatar, nickname, CEFR, mic state, host marker | muted/speaking/reconnecting/removed; 2–6 members |
| TopicCard | topic title, category, optional illustration-free accent | default/selected/empty |
| RoomHeader | topic, level, count, end-time countdown, overflow actions | normal/ending soon/extended/reconnecting |
| SpeakingQueue | ordered member slots and current speaker emphasis | join/leave/reorder/host transfer |
| AIHint | private prompt/result/limit/error; distinguish from shared room content | idle/loading/result/error/quota; text and short-voice entry |

These are **component responsibilities**, not approval of every V1 business behavior. Component variants should encode visual state without multiplying full-page frames.

## Icon intake list

Use 24 × 24 SVG as the default grid, consistent rounded 1.8 px outline, and a 44 px or larger touch target. The inventory below is covered by the [54-icon source set](icons/README.md), except for product-specific artwork listed there. Check licenses and style consistency before importing any third-party assets.

1. Core navigation: back, close, home/rooms, discover/search, history, profile, settings, more.
2. Room actions: create/plus, share/link/copy, calendar, clock, people/capacity, lock, filter, refresh.
3. Voice: microphone, microphone-off, speaking/audio-level, headphones/device, network-off/reconnect, leave/end, host/crown, member-remove.
4. Safety and AI: rules/info, report/flag, block, warning, check/success, error, appeal, sparkle/AI, send, record/stop/play.
5. Admin: dashboard, case, user, role, audit, filter, sort, export, alert; plus sidebar expand/collapse, search, breadcrumb, help/info, and external link. This is a candidate inventory, not evidence of approved admin features.

## Prototype coverage gate

The mobile prototype supports the 0.0.1 main path and some exception screens, but is not a confirmed complete V1 prototype. The 2026-09-24 visual review also means the high-fidelity entry gate is **closed**: reference extraction, tokens, core components, and representative instances need revision before more high-fidelity pages are drawn. Before expansion, review at least: direct public-room join, connected profile completion, room-state handling, in-room rules, member reconnect and host-transfer outcomes, plus distinct V1 flows for appointment, AI, post-room, friends/invitations, restrictions/appeals, and admin. Keep same-page variations as variants/annotations; add frames only for distinct screens or materially different layouts.

## Review sequence

1. Agree which OpenSpec changes define the target version and sign off the prototype coverage matrix.
2. Review this direction and token candidates against the six mobile references and three desktop screenshots. Use the desktop screenshots only for visual token decisions. Obtain an approved Slogan admin wireframe before fixing admin table, form, or case-detail patterns.
3. Create the approved Figma variables, styles, and core component sets. Reconcile Figma and `apps/mobile/src/styles/tokens.ts` without changing product code during design work.
4. Draw and inspect two mobile pilot views (room list and voice room), then one admin view after its scope/wireframe is agreed. Adjust by hand, then expand approved patterns to remaining screens.
5. Prototype main navigation and local component states in Figma Design during each stage. Prefer plan-available links, overlays, and interactive components. Prototype variable actions require a paid plan. Figma Make is an optional user-operated trial within available credits; agent use requires Desktop Bridge support for that file type. Check Starter sharing/publishing limits before using it.
