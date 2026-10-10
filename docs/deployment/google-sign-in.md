# Google Sign-In Configuration

Google authentication is already implemented in the API, admin web client, mobile web client, and native Android client. Enabling it requires coordinated provider and deployment configuration; changing only the backend capability flag is insufficient.

## Reuse one Web OAuth client

The API's `GOOGLE_OAUTH_CLIENT_ID`, admin's `VITE_GOOGLE_WEB_CLIENT_ID`, mobile's `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`, and GitHub repository variable `SLOGAN_GOOGLE_WEB_CLIENT_ID` must contain the same Web application client ID. Client IDs are public. Keep `GOOGLE_OAUTH_CLIENT_SECRET` server-side; never place it in a frontend variable, README, workflow, APK, or repository.

The Android delivery workflow passes the repository variable into Expo prebuild and JS bundling. Setting it only in a local mobile `.env` does not configure hosted Actions builds, which intentionally disable dotenv loading.

## Google Cloud

In the existing OAuth project, inspect the Web application client and configure these Authorized JavaScript origins:

- `https://slogan-preview-mobile.pages.dev`
- `https://slogan-preview-admin.pages.dev`

The browser code uses the Google Identity Services popup code flow. Its redirect URI is the frontend origin; keep the provider configuration and API origin allowlists consistent. Inspect the consent-screen audience and publishing status before describing login as publicly available. Do not assume a client usable by its owner is available to all visitors.

Android also requires a matching Android OAuth client for package `com.slogan.mobile` and the SHA-1 fingerprint of the certificate that signs the downloadable APK. A development certificate or a SHA-256 fingerprint does not substitute for that exact SHA-1 registration. The existing release pipeline checks the controlled installation certificate and must retain it so installed applications remain upgradeable. iOS is outside this delivery scope.

## Deployment variables

| Target                               | Variable                           | Value / ownership                                                                                             |
| ------------------------------------ | ---------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Vercel API, Production and Preview   | `GOOGLE_OAUTH_CLIENT_ID`           | Existing Web OAuth client ID                                                                                  |
| Vercel API, Production and Preview   | `GOOGLE_OAUTH_CLIENT_SECRET`       | Existing Web OAuth secret; server-side only                                                                   |
| Vercel API, Production and Preview   | `GOOGLE_OAUTH_REDIRECT_URIS`       | `https://slogan-preview-mobile.pages.dev,https://slogan-preview-admin.pages.dev,slogan://oauth/google/native` |
| Vercel API, Production and Preview   | `CORS_ALLOWED_ORIGINS`             | Preserve existing permitted origins and include both frontend HTTPS origins                                   |
| Vercel API, Production and Preview   | `GOOGLE_OAUTH_ENABLED`             | `true`, only after all required provider values are present                                                   |
| Admin Pages, Production and Preview  | `VITE_GOOGLE_WEB_CLIENT_ID`        | Same Web OAuth client ID                                                                                      |
| Mobile Pages, Production and Preview | `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | Same Web OAuth client ID                                                                                      |
| GitHub repository Actions variable   | `SLOGAN_GOOGLE_WEB_CLIENT_ID`      | Same public Web OAuth client ID; not the secret                                                               |

Save the required API credentials before enabling the flag: the API refuses startup when Google is enabled with missing configuration. Redeploy the API after changes and rebuild both Pages clients and Android after build-time variable changes. Existing APKs do not acquire new client IDs from a backend redeployment.

## Acceptance and rollback

`GET /v1/auth/capabilities` returning `google: true` proves that the deployed configuration enables the capability; it does not prove OAuth login. Actual browser authorization, code exchange, onboarding, session refresh/logout, and Android provider login remain separate evidence. A normal Google visitor must not receive admin or safety roles, and Google/email identities must not be silently merged.

Disable `GOOGLE_OAUTH_ENABLED` and redeploy the API to stop new Google exchanges if provider configuration fails. Retain username/password access and controlled-account roles. Do not rotate the OAuth secret or delete existing users as part of a capability rollback.

References: [Google popup code model](https://developers.google.com/identity/oauth2/web/guides/use-code-model), [Google Android client registration](https://codelabs.developers.google.com/sign-in-with-google-android), and [Vercel environment variables](https://vercel.com/docs/cli/env). These references describe provider behavior, not acceptance of this deployment.
