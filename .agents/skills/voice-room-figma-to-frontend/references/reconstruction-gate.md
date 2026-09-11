# Independent Reconstruction Gate

Use this gate only for explicit 1:1/high-fidelity restoration or when structured design evidence remains uncertain.

## Invariants

- The original target frame stays unchanged and remains visual truth.
- Create reconstruction in an empty area of the same page with a clear temporary name such as `__AI_RECONSTRUCTION__<Frame>`.
- Rebuild from extracted evidence. Do not clone, duplicate, reparent original children, or copy the original frame as a shortcut.
- Do not delete the reconstruction without authorization.

## Procedure

1. Reconfirm the active file, page, and target immediately before any Figma mutation.
2. Derive an internal reconstruction specification covering root geometry, nested layout, tokens, type, assets, components, variants, and bindings.
3. Generate the smallest Figma Plugin API program needed to reconstruct the target independently.
4. Execute it in a safe empty area and capture a reconstruction screenshot.
5. Compare original to reconstruction for geometry, hierarchy, spacing, typography, tokens, assets, effects, and meaningful component semantics.
6. For material mismatches, identify missing or misunderstood evidence, query it, correct only the affected reconstruction, and compare again.

Passing this gate proves that the design evidence was understood. It does not replace final original-Figma-to-runtime validation.

