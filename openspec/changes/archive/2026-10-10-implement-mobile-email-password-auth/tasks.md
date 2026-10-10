## 1. Design and Contract

- [x] 1.1 Record the page structure, key coordinates and status of the four Figma frames of V2, and check the existing OpenAPI request, response and email link format.
- [x] 1.2 Added browser password login cookie entry and generated OpenAPI and client types; tested Origin, Cookie, security response and refresh recovery.

## 2. Front-end process

- [x] 2.1 Press V2 to restore the login form, registration/retrieval portal and available Google secondary buttons; implement input verification, status and server-side error mapping.
- [x] 2.2 Implement registration, email verification and resend process, using real API and not persisting passwords or management tokens.
- [x] 2.3 implements retrieval request, email link reset, and successful return to login; maintains existence fuzzy prompts.
- [x] 2.4 Access native SecureStore and web page HttpOnly Cookie session to verify navigation, refresh, exit and account status.

## 3. Verification

- [x] 3.1 running format, lint, typecheck, related tests, Web/iOS build and OpenSpec strict; fix the problems introduced by this change.
- [x] 3.2 Compare the original Figma four frames in a 390×844 browser and check the interaction; record the acceptance status of the real SMTP/native device/WeChat code scan.
