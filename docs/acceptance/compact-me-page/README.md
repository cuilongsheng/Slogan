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
