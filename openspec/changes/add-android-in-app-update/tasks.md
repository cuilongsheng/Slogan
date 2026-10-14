## Implementation

- [x] 1.1 Create editable Figma update states and document frame-to-component mapping; inspect resulting layers and screenshot for layout.
- [x] 1.2 Add an Android platform service and local Expo module for release reads, bounded downloads, cancellation, integrity/identity checks and system installation; review native lifecycle, redirect and file access paths.
- [x] 1.3 Add localized update observer and Me manual entry with safe-route gating, throttling and permission-return handling; review state transitions and cleanup against the spec.
- [x] 1.4 Document first-install bootstrap, installation permission, distribution identity and rollback; review against existing delivery workflow.
- [x] 1.5 Apply the owner's branded update-only dialog correction from original available/download frames; inspect logo asset, heading, inline progress and action dimensions while preserving all update callbacks.

## Deferred verification and release

- [ ] 2.1 When requested, run the final affected static/test/native build suite and compare Figma states against the running UI; do not report deferred evidence as passed.
- [ ] 2.2 On a physical Android device, exercise newer/current/offline releases, permission grant/denial, download/install cancellation and a same-signature upgrade preserving login; record device evidence.
- [ ] 2.3 After verification, publish through existing guarded CI and record exact release version/commit and public artifact evidence.
