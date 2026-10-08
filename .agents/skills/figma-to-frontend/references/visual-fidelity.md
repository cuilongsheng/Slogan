# Original-to-Runtime Visual Acceptance

This gate compares the user's original Figma design with the implemented, running frontend. It is required for 1:1 claims. A rebuilt Figma frame, DOM assertion, successful build, or screenshot of only the reference is not runtime evidence.

## Establish a Comparable Pair

1. Read the exact approved frame through Desktop Bridge and export its current screenshot through the plugin. Record file/page/node, width and height, theme, relevant states, and source measurements.
2. Record the runtime route, build/ref, platform, viewport in logical pixels, pixel ratio, safe-area insets, loaded fonts, and data state. Use the target platform: a web preview alone cannot certify Android rendering.
3. Align capture conditions before judging pixels. Normalize only image scale or explicitly separated OS chrome; never stretch, crop away app differences, recolor, or edit the runtime image to make it match.
4. For controlled visual captures, use clearly labeled deterministic fixtures where different server content would obscure layout. Independently verify real interactions and APIs; fixtures do not prove integration.

Read actual fonts/weights/line heights, icon/photo assets, nested geometry, component variants, scroll bounds, and semantic variable values before implementing. A named style or a screenshot alone is insufficient when the property can be measured from the source.

## Compare the Actual Screen

Use side-by-side images plus a same-size overlay or image difference where available. Inspect the images, not just a scalar score. Save artifacts to the task's acceptance directory and link them in the report.

| Region | What must match |
| --- | --- |
| Page shell | content bounds, safe-area treatment, background, header/footer geometry |
| Sections/cards | hierarchy, order, width/height, padding, gaps, alignment, corners, borders, effects |
| Typography | actual family/weight, size, line height, wrapping, baseline and truncation |
| Assets | exact icons/photos, crop, scale, color, orientation; no fabricated substitutions |
| Controls | input/button size, touch target, label, position, directly visible versus folded content |
| States | loading/empty/error, selected/disabled, keyboard/focus, overlays, recording and exit |

Use source/runtime coordinates and dimensions to diagnose geometry differences. No universal percentage threshold proves fidelity: missing icons, folded content, or a wrong font can be material despite a low whole-image difference score. Do not choose a loose tolerance merely to pass. Any special tolerance or platform deviation must be explained and authorized rather than silently widening the criteria.

## Fix, Capture, Decide

- Fix differences supported by the original evidence, then recapture affected runtime states. Screenshots must correspond to final code; earlier screenshots become stale after relevant changes.
- A visible/measurable unapproved difference is FAIL. A missing asset or unfinished state is PARTIAL. An unavailable original/runtime capture is BLOCKED.
- PASS requires the comparable image pair, inspected region results, correct intended interactions, and no unresolved unapproved differences. A 1:1 result cannot hide PARTIAL regions in an aggregate PASS.
- Document OS chrome and unavoidable rasterization differences narrowly; they never excuse changed layout, font choice, icons, spacing, or interactions.
- If the user explicitly requests independent Figma reconstruction, treat it as a separate authorized design artifact. Do not mutate the source file just to validate frontend implementation.

## Minimum Delivery Evidence

For each target/state include original screenshot, final runtime screenshot, viewport/platform, overlay or comparison artifact when available, region findings, explicit authorized differences, and separate visual/behavior/API/device statuses. Missing evidence prevents the corresponding completion claim.
