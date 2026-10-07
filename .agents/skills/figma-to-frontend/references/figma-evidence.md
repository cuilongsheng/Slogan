# Figma Evidence

## Confirm the Target

Record the file, page, exact frame, node ID, viewport, route, role, and neighboring frames that represent runtime states. A file-level URL, similarly named frame, or selected child is not enough when multiple targets exist.

When figma-console-mcp tools are available, use them by job:

| Job | Preferred tool |
| --- | --- |
| Confirm Bridge, file, page, and selection | `figma_get_status` |
| Orient within pages and frame hierarchy | `figma_get_file_data` or targeted `figma_get_file_for_plugin` |
| Inspect variables, styles, and semantic tokens | `figma_get_design_system_kit`, then targeted variable/style reads |
| Inspect important reusable components and variants | `figma_get_component_for_development` with a concrete node ID |
| Capture current original visual evidence | `figma_capture_screenshot` using Desktop Bridge plugin export on the full target frame and necessary regions |
| Inspect a missing structural fact | non-mutating targeted Plugin API inspection through `figma_execute` |

Only use tools verified to read the connected Desktop Bridge. Generic file-data or screenshot tools are allowed only when their actual transport is the Bridge; never use their cloud/REST fallback. Do not repeatedly fetch a large file after the target node is known.

## Evidence to Collect

- hierarchy and Auto Layout;
- dimensions, constraints, padding, gaps, alignment, and overflow;
- typography, colors, borders, radii, effects, variables, and theme mode;
- actual font availability and exact weight/style, line height, wrapping and truncation;
- component instances, variants, and represented interactive states;
- exact icons, images, logos, and other assets;
- responsive behavior explicitly represented by the design.

Map semantic meaning to existing frontend tokens and components. A different name does not require a duplicate abstraction.

Keep a concrete frame-region-to-component/asset map. Check every visible control's intended product action against requirements and the API contract: an ordinary message composer cannot be implemented as an AI translation launcher. Treat expanded versus folded layout as source evidence, not a local implementation preference.

## Missing Evidence

Ask Figma for a missing fact before guessing it. If quota, connection, permissions, or unavailable data prevents inspection, record the exact blocked evidence and continue only with work that does not depend on it.
