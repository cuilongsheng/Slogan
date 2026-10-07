# Implementation and Validation

## Implement in the Existing Stack

Inspect before adding:

- route and application shell;
- feature/module organization;
- shared UI primitives and semantic tokens;
- state, forms, validation, localization, notifications, and permissions;
- API client and realtime integration;
- loading, empty, error, offline, and reconnect patterns;
- nearby tests and fixtures.

Reuse an existing component when it represents the same semantic role. Extend shared components backward-compatibly only when the design cannot otherwise be represented.

## Verification Evidence

Run repository checks that exist, normally lint, typecheck, relevant tests, and build. Distinguish failures introduced by the change from pre-existing failures.

Use Playwright for web/admin end-to-end paths. For React Native behavior, use the available runtime and device tooling; Playwright does not replace microphone, permission, native-language, reconnect, or real-device validation.

Apply the required [visual fidelity gate](visual-fidelity.md). Capture runtime evidence at the target viewport/device and compare against the original Figma frame for:

- page and section geometry;
- alignment, spacing, typography, color, border, radius, shadow, icons, and assets;
- overflow and represented responsive behavior;
- hover/focus/active/disabled/loading/empty/error/permission states when applicable.

When a mismatch is resolvable from Figma evidence, fix and compare again. Do not tune arbitrary CSS values without rechecking the source evidence.

Verify the actual intended action for each visible control, including text send/receive, recording press/release, navigation, keyboard avoidance, logout, and room exit where present. A button handler that calls a different valid API is still a failed integration. Record visual fidelity, behavior, API, and device evidence as separate results.

Retake the relevant runtime screenshots after final visual changes. Automated checks alone, web captures of a native task, or documenting unapproved differences cannot satisfy a 1:1 completion claim.

Use `PASS`, `PARTIAL`, `FAIL`, `BLOCKED`, or `NOT APPLICABLE`; never report PASS for an unexecuted check.
