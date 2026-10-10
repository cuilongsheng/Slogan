## 1. Contract and data level

- [x] 1.1 Add three interval values ​​to the profile field and Prisma enumeration and retain the old six values; use data policy testing and migration checks to verify that the old and new values ​​can be read and written, and the room level still only accepts a single level.
- [x] 1.2 Generate OpenAPI by NestJS code-first and regenerate `packages/api-client`; run contract drift check on both sides to confirm that the mobile terminal uses the same contract.

## 2. Login and session

- [x] 2.1 Add Google native SDK, development build, secure storage and language dependencies and configuration, verify dependency installation, type checking and enter the client without secret.
- [x] 2.2 implements Google native server authorization code redemption, server ID token verification and login page loading/cancellation/failure state; no session is established when testing request parameters, signature rejection and cancellation.
- [x] 2.3 Implement token secure storage, startup recovery, solo refresh, 401 cleanup and logout; use relevant unit/integration tests to verify rotation and failure paths.
- [x] 2.4 implements Google Web code popup, origin redemption and clickable main login button for Mac browser preview; verification success code, cancellation and missing configuration errors do not accept preview as native login.
- [x] 2.5 implements backend `HttpOnly` refresh Cookie, same-session page refresh recovery and safe exit for web preview; verifies that the native SecureStore remains unchanged, without browser normal storage tokens, source restrictions and refresh rotation.

## 3. First time information and navigation

- [x] 3.1 Implement two-step information page, effective Google avatar pre-filling, form verification, Chinese and English copywriting and design status; use interface testing to check required/error/interval selection.
- [x] 3.2 Connect `/v1/me` and `/v1/me/profile`, restrict routing and display minor pages according to server status; test `PROFILE_REQUIRED`, `AGE_RESTRICTED`, `ELIGIBLE` branches.
- [x] 3.3 Clarify the `BLOCKED` experience and product/contract differences between WeChat code scanning and avatar uploading, and verify that there are no fake QR codes, fake uploads or fake login successes.

## 4. Verification and acceptance

- [x] 4.1 Runs affected format, lint, typecheck, tests, builds, contracts and OpenSpec strict checks, logging accurate results.
- [x] 4.2 Record Figma 390×844 comparison, available runtime/device evidence and real provider/avatar/WeChat blocking; only mark actual executed projects as PASS.
- [x] 4.3 Reviewed the 390×844 landing page with user-provided blueprints, documented clear visual differences and Desktop Bridge/real provider blocking, and completed static, test, and build checks of the new web path.
- [x] 4.4 Perform runtime verification on the real browser Google login, page refresh recovery, logout and `/ready` navigation with an existing account, and update the contract, test and acceptance records.
- [ ] 4.5 Use the new account to verify the real first-time information page and submit; native device verification and missing avatar/WeChat contracts continue to be blocked according to the acceptance record.
