## Context

Original Me frame `152:1467` in Desktop Bridge file `56nIowZmvBhb0QJvOlDQdU`, page `102:2766`, is 390x844. Latest identity: avatar x23/y65/52x52, name x86/y65/18px, language controls x86 and174/y99/80x18. The explicit 46px instruction overrides language pill height, requiring additional vertical flow space. Current inputs/actions range from27 to56px.

## Goals / Non-Goals

Goals: unify reusable control sizing, move language actions beside avatar, retain readable input content and actual callbacks.
Non-goals: API, auth, updater transport, audio lifecycle, bottom-navigation redesign or deployment changes.

## Decisions

- Use a semantic shared control-height token and existing component primitives; do not alter every numeric height indiscriminately because icons, avatars, rows and chrome have separate meaning.
- Use normal flex flow for the name/language column with bounded name width. Language controls remain80px wide and12px type from the latest frame, with height overridden by the owner's explicit request.
- Single-line input padding centers text without clipping. Composer action circles resize both axes to46.
- Multiline sizing is an optional clarification pending reply; implementation defaults to46 with bounded content growth if no reply arrives. This fallback is an implementation assumption, not a separate accepted requirement.
- Existing reports/update rows and navigation remain authorized differences from the static Me sample.

## Risks / Trade-offs

- Taller selection chips consume more vertical space → preserve scroll containers and content-sized cards, verify390x844 and narrow widths.
- Native font metrics differ from web → set explicit line height/padding and separately report physical-device evidence.
- Historical visual receipts describe old dimensions → save fresh captures in a new acceptance directory, not over old production receipts.

## Verification and rollback

Affected mobile static checks and existing visual harness validate controls and Me layout; capture original and runtime together, noting authorized height/content differences. Native device acceptance remains separate. Revert this isolated UI commit to roll back; no data migration.
