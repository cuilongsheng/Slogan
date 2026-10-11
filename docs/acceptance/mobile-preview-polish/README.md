# Mobile preview corrections — 2026-10-11

## Scope and cause

This Level 0 repair batch corrects existing unavailable controls and presentation defects. The owner explicitly requested temporary assistance unavailability, English typography improvements, an opaque create-room action area, and centered web navigation. It does not activate a provider, change the API contract, or provision accounts.

- WeChat already had `disabled`, but no visual disabled treatment. The option now dims and retains its unavailable accessibility hint/state.
- English rule copy used the Chinese font and a long uninterrupted sentence. The rule region now uses explicit Latin typography, a normal apostrophe, and sentence grouping while retaining every prohibition.
- Navigation labels were absolutely positioned at a fixed left offset suitable only for short Chinese labels. Four equal columns now center both the icon and label in normal layout flow.
- The creation footer contained only the rounded action, leaving its surrounding area transparent over scrolled form content. It now spans the full page width with an opaque surface and a top separator, within the existing keyboard-avoiding container.
- The assistance sheet mounted a private recorder before a recording began. Closing invoked cancellation both directly and from unmount; recorder cleanup could also modify the shared audio mode. The unavailable release state now lives outside the recorder-owning component. Opening/closing it invokes no recorder hook, consent request, microphone mutation, or translation upload. The accept control is disabled and the localized development notice is visible. The available implementation is preserved for a separately approved activation.

The reported Android exit has not been reproduced with native crash logs. The changed unavailable path removes the identified audio-session side effects; do not claim that a browser capture proves all native crashes are resolved.

## Original design evidence

Connected Figma Desktop Bridge only; original frames were inspected and exported without alteration:

| Region          | Page / frame                           | Node     | Viewport |
| --------------- | -------------------------------------- | -------- | -------- |
| Navigation      | 02 UI / Rooms / Pilot V2 · review      | 115:1197 | 390×844  |
| Room rules      | 02 UI / Voice Room / Pilot V2 · review | 115:1425 | 390×844  |
| Creation action | 02 UI / Rooms / Create · V1            | 111:979  | 390×844  |
| Assistance      | 02 UI / Voice Translation / Start · V2 | 115:1627 | 390×844  |

Authorized differences: English copy wrapping/typography, responsive label centering, full-width opaque action background, disabled treatment/development notice, and a larger close hit target. This is not an overall 1:1 acceptance of all screens.

## Runtime evidence

The actual React Native Web components ran in the existing local visual harness with explicit fixture auth/session adapters. These captures prove rendered component states, not production APIs, Google sign-in, LiveKit behavior, or Android device behavior. The empty room-list request fails because no fixture API server was started; only its navigation region is in scope.

| Region / state                      | Evidence                                                     | Observation                                                                                                                      |
| ----------------------------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| English navigation                  | [navigation-en.png](navigation-en.png)                       | Four centered icon/label columns; no fixed-offset text overflow                                                                  |
| English rules                       | [voice-en.png](voice-en.png)                                 | Latin font, normal apostrophe, separated instructions and prohibitions                                                           |
| English unavailable assistance      | [assistance-disabled-en.png](assistance-disabled-en.png)     | Disabled accept control and development notice; Close returns to the same voice view                                             |
| Chinese unavailable assistance      | [assistance-disabled-zh.png](assistance-disabled-zh.png)     | “功能开发中” visible; Close returns to the same voice view                                                                       |
| Full creation viewport              | [create-en.png](create-en.png)                               | Opaque bottom action surface and separator                                                                                       |
| Focused input with reduced viewport | [create-short-viewport-en.png](create-short-viewport-en.png) | 390×480 viewport simulates reduced visible space; button background remains opaque. This is not a real software-keyboard capture |

Formatting and `git diff --check` were performed. No test suite, lint, typecheck, build, production deployment, or APK update was run for this batch, following the owner's no-test instruction. A regression case was added for disabled consent and closing without recorder/API/microphone work; it remains unexecuted. Native close behavior and real keyboard behavior remain owner/device acceptance items.

## Follow-up delivery

The optional-profile and public-trial changes were subsequently implemented in the same authorized release branch. See [optional profile](../optional-profile/README.md) and [public trial accounts](../public-trial-accounts/README.md) for their separate database, auth and runtime evidence. Automated suites remain unexecuted under the owner instruction. Native crash reproduction and keyboard acceptance remain separate.
