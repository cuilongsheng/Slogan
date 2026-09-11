# Figma Index

Record only confirmed design targets. Do not copy visual specifications into this file.

| Product area | Figma file | Page | Frame | Node ID | Route | Status |
| --- | --- | --- | --- | --- | --- | --- |
| Foundations | `Slogan` | `00 Foundations` | `Foundations / Overview` | `22:72` | Design reference | Confirmed |
| Components | `Slogan` | `00 Foundations` | `Components / Core` | `22:145` | Design reference | Confirmed |
| Authentication | `Slogan` | `01 Prototype` | `Auth / Sign in` | `22:206` | Prototype start | Confirmed |
| Authentication | `Slogan` | `01 Prototype` | `Auth / Register` | `22:240` | Sign in -> Register | Confirmed |
| Authentication | `Slogan` | `01 Prototype` | `Auth / Verify Email` | `22:295` | Register -> Verify email | Confirmed |
| Authentication | `Slogan` | `01 Prototype` | `Auth / Forgot Password` | `22:342` | Sign in -> Forgot password | Confirmed |
| Authentication | `Slogan` | `01 Prototype` | `Auth / WeChat QR` | `22:390` | Sign in -> WeChat | Confirmed |
| Authentication | `Slogan` | `01 Prototype` | `Auth / WeChat QR Expired` | `22:454` | WeChat -> Timeout | Confirmed |
| Authentication | `Slogan` | `01 Prototype` | `Auth / WeChat QR Success` | `22:520` | WeChat -> Demo QR click | Confirmed |
| Authentication | `Slogan` | `01 Prototype` | `Auth / Google Account Chooser` | `22:562` | Sign in -> Google | Confirmed |
| Authentication | `Slogan` | `01 Prototype` | `Auth / Google Error` | `22:613` | Google -> Use another account | Confirmed |
| First profile | `Slogan` | `01 Prototype` | `Profile / First setup` | `22:657` | Successful sign in -> Profile | Confirmed |
| First profile | `Slogan` | `01 Prototype` | `Profile / First setup — Scrolled` | `22:733` | Profile scroll reference | Confirmed |
| First profile | `Slogan` | `01 Prototype` | `Profile / First setup — Validation` | `22:809` | Required-field error reference | Confirmed |

Figma file: [Slogan](https://www.figma.com/design/56nIowZmvBhb0QJvOlDQdU/Slogan). The `Mobile Prototype / V1` section is node `22:205` and contains all 12 mobile frames at 390 x 844.

## Prototype evidence

- The prototype contains 21 confirmed reactions, covering username/password sign-in, registration, email verification, password recovery, WeChat waiting/success/expired/refresh states, Google account selection/cancel/failure/retry, and entry into first profile setup.
- `Profile / Scroll View` (`22:669`) uses vertical scrolling. Its 542 px viewport contains `Profile / Scroll Content` (`22:670`) at 1015 px, while the primary completion action remains in a separate sticky region.
- The prototype section contains 108 component instances and no top-level frames outside the named section.
- Final lint scanned 681 nodes. It reported 0 critical findings for contrast, text styles, default names, and token use. The remaining 42 warnings are the intentional black/white vector paths inside the demo QR illustration.
- The QR image and Google accounts are prototype-only examples. The Figma file contains no App ID, Client ID, secret, callback URL, real account, or usable production QR code.

Figma is visual truth. OpenSpec defines behavior and OpenAPI defines API contracts.
