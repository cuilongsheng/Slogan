## Why

The V2 login design uses username and password as the main entrance, but the mobile version currently only has Google login. The existing backend already provides registration, email verification, password login and retrieval interfaces; the frontend needs to complete these real processes while keeping Google login and browser refresh sessions secure.

## What Changes

- Press Confirmed Figma V2 to realize login, registration, email to be verified, retrieval and reset password pages and corresponding input, loading, error, and success status.
- The email authentication interface connected to the only OpenAPI contract; the web password login uses the same HttpOnly refresh Cookie as Google, and the native side uses SecureStore.
- Google login remains available, WeChat QR code remains explicitly blocked due to lack of creation and polling contracts.
- Compare 390×844 manuscripts, run tests and builds, and record real mail delivery and device acceptance boundaries.

## Capabilities

### New Capabilities

- `mobile-email-password-auth`: Mobile username and password registration, verification, login and retrieval process.

## Impacted delivery stages

- Architecture
- Prototype / Figma
- Backend / API
- Frontend
- Test / Acceptance
