# Compact Partners/Messages and shared bar

Status: implemented locally; tests, build, runtime visual comparison and deployment deferred by the owner. No runtime or 1:1 PASS claim.

Change: `compact-social-list-layout`; routes `/partners`, `/messages`, and shared bar on all four main tabs. Project-local figma-to-frontend workflow used. No API contract, network cadence, authentication or media lifecycle changes.

## Original source

Desktop Bridge file `56nIowZmvBhb0QJvOlDQdU`, page `102:2766` / 02 UI, latest selected original frame `217:3386` / Partners / Available · V2 (390x844), shared bar `217:3391`. Selection ancestry identified the owner's current frame among several older copies with the same name. Both original targets were inspected and exported without mutation.

Captures: [Partners](figma/partners-original.png), [bottom bar](figma/bar-original.png).

| Region | Original measurements | Code mapping |
| --- | --- | --- |
| Header | 16px bold, line32, centered presentation | Optional MainPageTitle styles used only by two lists |
| Row | Approx61px spacing, margins16/24, divider #EFEFF3 | PeerRow; no filled card/background |
| Avatar | 42px; fallback initial16/22 bold; #F5F2FF surface | PeerAvatar uses actual supplied avatar or visible initial on missing/failed image |
| Name/detail | 12/21 bold and12/18 regular, gap4, bounded copy | Single-line truncation in shared copy column |
| Action | 34px purple circle, existing20px white SVG/PNG | Full-row accessible chat/open action, matching icon asset |
| Bar | Height61, white, icons24/y8, labels11/16/y36, no stroke/circle | Shared BottomNavigation updated consistently across all four main tabs |
| Bar colors | Active #6247E8, inactive labels/Discover #787587, other icons #B2ADBE | Semantic navigation tokens with one active index |

## Preserved behavior and explicit application

The owner applied the Partners reference to Messages as well. Message previews remain actual message/call data; unread counts remain visible and accessible, and long press keeps the existing hide-history operation. Availability, paging, focused foreground polling and empty/error refresh callbacks remain unchanged. Static repeated names in the design are sample content, not runtime fixtures. Real avatars are kept when supplied.

The source's manually uneven tab x positions are normalized to equal responsive touch targets with each icon centered over its label. Web heading spacing compensates for the existing simulated status-chrome height; native headings remain below native safe-area chrome. These responsive/source-data boundaries must be considered in the later comparison. Source capture alone does not prove actual rendering or interaction behavior.

## Pending evidence

Affected static/test/build checks; routed populated/empty/error/unread captures for both lists; narrow width/long text/failed avatar coverage; four-tab active/unread bar comparison; Android device rendering. All remain pending until the owner requests the final test/deployment round.
