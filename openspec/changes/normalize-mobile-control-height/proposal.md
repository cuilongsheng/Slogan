## Why

The owner identified inconsistent input and button heights across mobile pages after the preceding release. The revised Me design also places language selection under the display name beside the avatar.

## What Changes

- Standardize single-line inputs and regular button actions on a shared 46 logical-pixel height, including dialog and composer actions.
- Place Me avatar beside a name/language column following the latest original frame; retain the language option dimensions from the latest original frame.
- Preserve current routing, data, callbacks, unread and media behavior. Selection options (levels, capacity, access, timing modes, profile preferences, languages, filters and report categories), system/navigation chrome, avatars, list rows and inline text links retain their source dimensions.
- For multiline editing, use a 46px default with bounded growth; this is the provisional option presented to the owner and remains subject to their reply.

## Capabilities

### New Capabilities

- `mobile-control-sizing`: shared mobile control geometry and readable input content.

### Modified Capabilities

## Impact

Mobile UI primitives, styles and affected screens; no API, schema, native module or provider changes.

## Impacted delivery stages

- Prototype / Figma
- Frontend
- Test / Acceptance

## Approval

Owner's 2026-10-14 instruction directly authorizes implementation. Original Figma frame `152:1467` is read-only. The owner clarified that selection options are excluded from the46px normalization; its18px language pills are retained. This request does not itself publish another release.
