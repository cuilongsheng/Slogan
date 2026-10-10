## Why

The mobile terminal currently only has the project startup page. The existing identity and data backend already provides OAuth redemption, session refresh and first-time data interfaces. It is necessary to integrate the confirmed mobile design into the real process and keep the entry boundaries for unfinished data and underage users.

## What Changes

### Confirmed scope

- Implement native Google login, WeChat login portal, secure session storage, refresh, logout and recovery at startup; use the existing OpenAPI contract and do not save provider secrets on the client.
- Implements the first two-step data page, form verification, server submission and `PROFILE_REQUIRED` / `AGE_RESTRICTED` / `ELIGIBLE` navigation; the back-end data CEFR accepts and returns the three interval values ​​used in the design.
- Use Figma V2's login, basic information, learning preferences, age restrictions and WeChat code scanning frame as visual basis to record the visual differences in the login page caused by the confirmed range.
- Complete mobile Chinese/English copywriting, related testing, construction and available runtime/visual evidence.
- Provides a Google Web authorization code pop-up window entry for the 390×844 browser preview on Mac; the backend `HttpOnly` Cookie carries the browser refresh session, and the login is restored after the page is refreshed; it is only used as a development preview and will not be regarded as native device acceptance.

### Non-goals

- Username and password, email verification, password retrieval and account binding will be changed separately; there will be no inoperable entrances in this batch.
- Room, LiveKit, production release and real provider acceptance are not included in this batch of code delivery.
- Do not extend the browser preview into a standalone web product; the browser session is only restored within the current browser session, and the token is not saved in the client's normal persistent storage.

### Unresolved decisions

- OpenAPI does not have avatar upload and WeChat code scanning creation/polling interfaces; the corresponding end-to-end capabilities remain `BLOCKED` in this change, and no fake QR codes or fake upload successes are displayed.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `identity-and-profile`: The first data CEFR can choose the A1–A2, B1–B2, C1–C2 range; the old single-level data remains readable.

## Impact

- Stages: Architecture, Backend/API, Frontend, Test/Acceptance.
- Scope: `apps/mobile` authentication, session, data, routing and localization; `apps/api` adjusts profile CEFR constraints, Prisma enumeration and migration, and supports server-side redemption of native Google server authorization code and ID token signature verification; generate a unique OpenAPI contract by NestJS code-first, and then update `packages/api-client`; retain other independent uncommitted changes in the workspace.
- Depends on: Google Web/iOS/Android developer configuration, server-side approved native code tags, real device or development build, avatar upload contract decision.
