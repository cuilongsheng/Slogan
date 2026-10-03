# Development

## Prerequisites

- Node.js 24.21.0 (`nvm use` reads `.nvmrc`)
- pnpm 12.3.4 (declared by the root `packageManager` field)

## Install

```bash
nvm use
corepack enable
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
```

## Run One Application

```bash
pnpm dev:admin
pnpm dev:mobile
pnpm dev:api
```

## Preview mobile login and run the API locally

To view the signed-out login page without provider credentials, start Expo Go mode from the repository root:

```bash
nvm use
pnpm install --frozen-lockfile
pnpm --filter @slogan/mobile exec expo start --go
```

Scan the QR code with Expo Go. The first route redirects to `/sign-in`; viewing this page does not require the API. Google sign-in is disabled in Expo Go because its native module needs a development build.

On a Mac, preview the same signed-out layout in a browser without installing Xcode or an iOS simulator:

```bash
pnpm --filter @slogan/mobile exec expo start --web
```

Open the local URL shown by Expo (usually `http://localhost:8081/sign-in`). The browser uses a 390×844 preview canvas; native status bar and home indicator are supplied by the device, not the page. The browser preview uses Google's Web code popup when configured. After login, the API stores its rotating refresh token in an `HttpOnly` Cookie, so a page reload in the same browser session restores the Slogan session. The browser keeps the access token only in memory. Use a development build on a simulator or device to verify native Google login and secure session restoration.

To test Google login in the browser on port 8082, configure the following values locally and restart Expo and the API after editing the environment files:

```text
apps/mobile/.env:
EXPO_PUBLIC_API_BASE_URL=http://localhost:3000
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=<Google Web OAuth client ID>

apps/api/.env:
GOOGLE_OAUTH_ENABLED=true
GOOGLE_OAUTH_CLIENT_ID=<same Google Web OAuth client ID>
GOOGLE_OAUTH_CLIENT_SECRET=<Google Web OAuth client secret>
GOOGLE_OAUTH_REDIRECT_URIS=slogan://oauth/google/native,http://localhost:8082
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://localhost:8082
```

Add `http://localhost:8082` to the Web OAuth client's Authorized JavaScript origins in Google Cloud. The Web client ID is public; keep the secret only in the ignored API `.env`. The button stays interactive and reports missing configuration on press, but provider login cannot complete until these values and the API are available. For native iOS, also set `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` and build the development client.

After changing either `.env`, stop and restart its running process. Nest watch mode does not reload OAuth values from an edited `.env` alone. A new Google authorization code is required after a failed exchange; do not reuse or paste an old code.

To run the local API, first start its persistent development PostgreSQL and Redis services and apply migrations:

```bash
docker compose -f apps/api/docker-compose.dev.yml up -d --wait
DATABASE_URL=postgresql://slogan:slogan@127.0.0.1:5432/slogan pnpm --filter @slogan/api db:migrate:deploy
pnpm dev:api
```

Before `pnpm dev:api`, set three independent random 32+ character values for `JWT_ACCESS_SECRET`, `REFRESH_TOKEN_PEPPER`, and `ROOM_PASSWORD_PEPPER` in the ignored `apps/api/.env`. The example strings are only placeholders. The API defaults to `127.0.0.1:3000`; for a physical phone on the same LAN, set `APP_HOST=0.0.0.0` in that file and `EXPO_PUBLIC_API_BASE_URL=http://<Mac LAN IP>:3000` in `apps/mobile/.env`. Keep PostgreSQL and Redis ports bound to localhost. A native development build and real Google credentials are still required to test Google login.

## Android native debug build on macOS

Use the SDK installed by Android Studio, rather than the Homebrew command-line-tools directory. The generated `apps/mobile/android/` directory is Git-ignored, so `local.properties` is machine-local.

```bash
printf 'sdk.dir=%s/Library/Android/sdk\n' "$HOME" > apps/mobile/android/local.properties
cd apps/mobile/android
ANDROID_HOME="$HOME/Library/Android/sdk" ANDROID_SDK_ROOT="$HOME/Library/Android/sdk" ./gradlew :app:assembleDebug --no-daemon --max-workers=2
```

If Gradle reports an SSL handshake failure while downloading from Google Maven and this Mac uses an HTTP proxy, pass that proxy explicitly to Gradle with `-Dhttp.proxyHost`, `-Dhttp.proxyPort`, `-Dhttps.proxyHost`, and `-Dhttps.proxyPort`. Keep the official Maven repository configured by the project. A successful build produces `app/build/outputs/apk/debug/app-debug.apk`; `adb devices` must list a phone before installation or native behavior can be verified.

## Mobile API client

The mobile API types come only from `openapi/openapi.yaml`. Regenerate and check them after an API contract change:

```bash
pnpm --filter @slogan/api-client generate
pnpm --filter @slogan/api-client generate:check
```

`apps/mobile/src/api/client.ts` creates the typed client when a feature actually makes a request. Set `EXPO_PUBLIC_API_BASE_URL` to the API origin reachable from the target simulator or physical device; it is not a secret. There is no implicit localhost default, because localhost on a physical device points to that device.

For the mobile Google login and first profile flow, copy `apps/mobile/.env.example` to `apps/mobile/.env` and set the public Web and iOS Google client IDs. The Web ID must equal the API's `GOOGLE_OAUTH_CLIENT_ID`. Set `GOOGLE_OAUTH_ENABLED=true`, its Web client secret, and include `slogan://oauth/google/native` in `GOOGLE_OAUTH_REDIRECT_URIS` on the API. Create matching iOS and Android OAuth clients in Google Cloud; the Android client needs the app package and signing certificate SHA-1. Build a native development client after configuration changes: Expo Go cannot load the Google Sign-In module. A JS export or unit test does not prove provider login. See `docs/acceptance/implement-mobile-auth-profile.md` for the remaining provider and device checks.

The API now requires PostgreSQL and validated session secrets. Copy `apps/api/.env.example` to
`apps/api/.env`, replace both example secrets, and point `DATABASE_URL` at a local development
database before running `pnpm dev:api`. Google and WeChat remain disabled until valid test-app
credentials and redirect URIs are configured.

## API Test Database

The repository includes an isolated PostgreSQL test service bound only to
`127.0.0.1:54329`. It uses a Docker tmpfs and contains no personal data.

```bash
pnpm --filter @slogan/api db:test:up
pnpm --filter @slogan/api test:integration
pnpm verify:api
pnpm --filter @slogan/api db:test:down
```

`test:integration` runs the non-destructive, repeatable `prisma migrate deploy` before repository
tests. It never runs `migrate reset` and must never target a development or production database.

## Run One Workspace

```bash
pnpm --filter @slogan/admin typecheck
pnpm --filter @slogan/mobile test
pnpm --filter @slogan/api build
pnpm --filter @slogan/shared test
```

## Verify

```bash
pnpm format:check
pnpm deps:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
pnpm verify
```

Optional Expo diagnostics use a temporary, project-invoked tool rather than an unrecorded global
installation:

```bash
pnpm dlx expo-doctor@1.20.4 apps/mobile
```

`pnpm verify` is the repository-wide provider-neutral CI entry point; `pnpm verify:api` is the
focused backend equivalent. Neither command calls Google or WeChat. Mobile bundle checks are
bootstrap runtime evidence; they are not real-device evidence for permissions, microphone,
networking or audio behavior.

## Current frontend boundary

The mobile login and first-profile routes are implemented. Google provider login still requires configured OAuth clients and a native development build. Avatar upload, WeChat QR login, room flows, device audio behavior, and deployment remain separate work or blocked integrations; see `docs/acceptance/implement-mobile-auth-profile.md`.
