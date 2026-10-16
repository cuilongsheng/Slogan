# Compact Me page — local implementation

Status: implementation complete; tests, runtime visual comparison and deployment deferred by owner. No runtime or 1:1 PASS claim.

Change: `compact-me-page-layout`. Route: `/me`, authenticated mobile user. API operations are unchanged; the existing profile draft/edit, language persistence, vocabulary, safety appeals, report history, logout and pending Android updater actions retain their implementations.

## Original Figma target

Desktop Bridge file `56nIowZmvBhb0QJvOlDQdU`, page `102:2766` / 02 UI, original frame `152:1467` / Me / 精简个人中心 · V3, 390x844. Source [capture](figma/me-original.png) was exported after the owner's latest edits and before code changes. The original design was not mutated during implementation.

| Region | Source evidence | Component mapping |
| --- | --- | --- |
| Heading | Removed by owner | Remove MainPageTitle from MeScreen |
| Profile | Avatar x23/y47, 52x52; name x83/y66, 18/27 bold | settings/profile/photo/profileName; authenticated avatar/name, bounded text |
| Language | x20/y113; 102x27 and112x27; gap8; 14/20 medium; original row height42 | languages/language/languageText; expanded hitSlop, existing persistent selection |
| Menu | x20, width350; 1px #EFEFF3 dividers; labels x26, 14/20 medium; approx44px rows | list/item/title; responsive margins and divider token |
| Logout | 342x46, radius14 | Shared largeAction dimensions, local radius override |

## Retained behavior and evidence boundary

The three illustrated entries appear first: vocabulary, restrictions/appeals, edit profile. Previously requested My reports and supported-Android Check for updates remain as additional divider rows. Main bottom navigation remains, with logout above it. These retained product controls are documented differences from the static three-row source and must be included in the later runtime comparison.

Web RoomPage uses 49px simulated system chrome versus the source's profile y47; physical native safe-area chrome varies by device. Profile/content geometry is implemented in normal responsive flow, not hard-coded absolute coordinates from the screenshot. Long names truncate within the row; small visual language pills use larger touch hit areas. Short screens scroll the menu while keeping logout/navigation outside the scroll area.

Source and diff were inspected. No lint, typecheck, tests, build, browser/Android runtime capture or deployment was run. Final affected checks and source-to-runtime comparison remain in the OpenSpec task list.


## Menu visual correction — 2026-10-16

The owner requested the revised Me V3 screenshot before merging, with no tests or deployment in this delivery. This is a Level 0 visual correction; routes, authorization, API contracts and action behavior are unchanged.

Desktop Bridge confirmed the original `152:1467` frame at 390×844. [Current original capture](figma/me-menu-refresh-2026-10-16.png) records the white identity panel, 52px avatar, 18/27 bold name, unchanged 80×24 language options and compact menu rows. Identity content follows a 14px horizontal inset and 25px top/bottom padding; menu labels use the source #6D6975 color, 14/20 medium typography, dividers and right chevrons. The three illustrated menu icons and chevron are exported from the original Bridge nodes as PNG assets, without modifying the design or substituting generic icons. Authenticated avatar/name remain dynamic.

Asset mapping: vocabulary `I230:3555;106:1370`, restrictions `I230:3564;105:1181`, edit profile `I230:3569;105:1213`, right chevron `230:3560`. Original PNGs are exported at 3× for native rendering. Existing My reports, Android Check for updates and main navigation remain available as documented above; the three screenshot actions stay first. Logout retains its existing size, position and behavior. Native safe-area and web simulated status-bar placement remain platform dependent.

Tests, lint, typecheck, build, runtime visual comparison and deployment were explicitly deferred by the owner. Source/diff review does not establish runtime, device or 1:1 visual acceptance. Delivery commits use `[skip ci]` to defer the repository's automatic test and deployment workflows until a later release.

The API Vercel configuration also disables native Git deployment for the exact delivery branch `codex/merge-reviewed-v1-20261016`; the existing `main` Git-deployment exclusion remains. This prevents a PR preview deployment independently of GitHub Actions and does not disable later workflow-driven releases.
