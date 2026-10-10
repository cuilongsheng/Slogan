## Context

V2 frame of Figma file `56nIowZmvBhb0QJvOlDQdU`: login `118:2970`, registration `118:3001`, verification email `118:3063`, retrieval password `118:3186`, all are 390×844. The back-end mailbox process has been implemented locally in `implement-email-password-auth-backend`, and the real SMTP delivery acceptance has yet to be configured. OpenAPI is the only contract.

## Decisions

1. The login page restores the username, password, main login button, registration and forgotten password portals of V2, and the Google button at the bottom continues to call the existing OAuth process. The WeChat entrance remains unavailable until the QR code scanning API exists.
2. Log in with the native username and password to consume the token pair of `/v1/auth/password/exchange` and store it in SecureStore. The browser adds `/v1/auth/web/password/exchange`, verifies the allowed Origin, the server sets the HttpOnly refresh Cookie shared with Google, and only returns a short-term access token. Refresh and exit reuse existing cookie endpoint. Passwords and refresh tokens do not enter browser storage, URLs, or logs.
3. The management credentials returned by registration are only used for retransmission in the page memory; after the page is refreshed, you are prompted to resubmit the registration information. The token of the email confirmation and reset link is placed in the URL fragment. The address bar is cleared immediately after the page is read, and then POST is triggered by user operation. Unverified account cannot establish session.
4. Error copy is classified according to contract code. Login credential errors are displayed uniformly, registration uniqueness errors point to specific inputs, and retrieval requests always display unified acceptance results. 429/503 Allow safe retry without forging success.
5. The page inherits AuthPage, semantic tokens, Expo Router and existing Chinese and English resources. The form does not persist the password; clear the form's sensitive status when returning to the login page.

## Risks and rollback

- The lack of Origin restrictions in browser password entry will bring cross-site cookie risks: reuse the Origin whitelist and SameSite/Lax/Secure policy of the Google cookie endpoint, and test rejecting illegal sources. Remove new entry when rolling back; existing Google Cookie session remains unchanged.
- The email link may be leaked through history, logs or referrer: only the fragment is read and removed immediately, and the POST body does not record plain text; if the back-end link template does not comply with the agreement, the front-end displays a safe alternative entry for manually entering the token and records the obstruction.
- When the mail service is not configured, it is impossible to prove that the registered/retrieval mail is actually delivered: the interface display service is unavailable, and the acceptance is reserved for BLOCKED; local capture or fake data cannot be used to claim real delivery.
- The current database does not need to be migrated. The release sequence is back-end Cookie entrance and OpenAPI, generated client, front-end; rolling back the front-end will not affect the native password interface or existing Google users.
