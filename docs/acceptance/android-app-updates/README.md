# Android app updates — implementation record

Status: IMPLEMENTED LOCALLY / VERIFICATION DEFERRED. The owner explicitly requested no tests during this turn. No native build, runtime comparison, physical-device installation or deployment has run.

Change: `add-android-in-app-update`; branch: `codex/android-in-app-update`.

## Design target

Desktop Bridge confirmed file `56nIowZmvBhb0QJvOlDQdU`, page `102:2766` / `02 UI`. Existing Me `152:1467`, incoming-room dialog `212:3205` and Button / V1 component set `104:586` were inspected. No existing update target existed. Original screens remain unchanged.

New editable section `215:3248` / Android app updates / Optional upgrade:

| State | Node | Runtime mapping |
| --- | --- | --- |
| Available | `215:3249` | AppUpdateProvider available |
| Downloading | `215:3260` | Progress, bytes percentage, cancel |
| Permission | `215:3271` | Permission explanation and settings |
| Download/install failure | `215:3282` | Recoverable error and retry |
| Download ready | `217:3307` | Install retry after installer cancellation |
| Current version | `217:3318` | Manual current-version receipt |
| Check failure | `217:3329` | Manual check retry |
| Me manual entry | `217:3340` | MeScreen compact Check for updates row |

Target frames: 390 × 844, centered dialog width342, padding24, gaps16, title16/24, body14/22, action height46/radius23. Buttons are component instances; canvas, ink, lavender and purple use existing variable bindings. No rasterized full-screen design was imported. Figma composition screenshot is design inspection only, not runtime acceptance.

Design capture: [update states](figma/update-states.png).

## Source review

- Platform service returns unavailable on web/iOS; Android requires the local module and embedded release stamp.
- Root provider performs non-blocking, bounded-frequency checks and preserves the installed app after errors or dismissal.
- Download cancellation invalidates pending UI completion, stops the native connection and cleans partial bytes. Room/call routes take precedence. Returning with installation permission granted continues installation once.
- Metadata and APK stay within fixed release sources, with actual installed identity and APK integrity checked natively. Files exposed to the installer are in the restricted verified cache path.
- Me provides a manual check. Chinese/English labels are in the existing locale catalog.

## Evidence pending

Affected static/test suite, native build and autolinking verification, Figma-to-runtime visual comparison, Android permission/installer upgrade and cancellation coverage, and guarded publication all remain pending. No PASS or production-release claim is made.
