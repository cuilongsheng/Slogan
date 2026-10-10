<p align="center">
  <img src="assets/brand/slogan-logo.png" width="96" alt="Slogan logo" />
</p>

<h1 align="center">Slogan</h1>

<p align="center">Practice English through real conversations. Find a room, speak together, and build your vocabulary.</p>

<p align="center">
  <strong>English</strong><br />
  <a href="https://slogan-preview-mobile.pages.dev">Try on the web</a> ·
  <a href="https://slogan-preview-mobile.pages.dev/downloads/android">Download Android</a> ·
  <a href="https://slogan-preview-admin.pages.dev">Admin console</a>
</p>

Slogan is a realtime voice community for practicing spoken English, with Android and web clients, an admin console, and a NestJS API. People join topic-based rooms of 2–6 participants by proficiency level, exchange text messages, invite partners, and use native-language expression assistance to find something to say in English. The admin console provides room management, safety cases, restriction appeals, permissions, and audit records.

Built as a TypeScript and pnpm monorepo, the project focuses on room lifecycle management, consistency between realtime services and the database, secure sessions, and coordinated delivery of the API, frontends, and APK. It is currently a controlled `0.0.x` pilot.

## Contents

- [Try Slogan](#try-slogan)
- [Screenshots](#screenshots)
- [Features and current scope](#features-and-current-scope)
- [Architecture](#architecture)
- [Technology](#technology)
- [Run locally](#run-locally)
- [Configuration and API](#configuration-and-api)
- [Verification and delivery](#verification-and-delivery)
- [Documentation](#documentation)
- [Contributing and license](#contributing-and-license)

## Try Slogan

| Entry         | Link                                                                                                                                                       | Notes                                                                                               |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Web client    | [Open Slogan](https://slogan-preview-mobile.pages.dev)                                                                                                     | Microphone permission and access to the voice service are required for audio                        |
| Android       | [Download page](https://slogan-preview-mobile.pages.dev/downloads/android) / [Download APK](https://slogan-preview-mobile.pages.dev/downloads/android.apk) | Currently arm64; uses a fixed pilot signing identity, with store release signing still unconfigured |
| Admin console | [Open admin](https://slogan-preview-admin.pages.dev)                                                                                                       | Requires the appropriate administrative permissions                                                 |
| Build history | [GitHub Releases](https://github.com/cuilongsheng/Slogan/releases)                                                                                         | Release commits, APK files, and verification metadata                                               |

The pilot uses five accounts provisioned by the maintainer: one platform administrator, one safety officer, and three ordinary users. Hosting is a role within a room membership, not a global account role. Account passwords are not published in the repository.

As of October 10, 2026, the public pilot uses provisioned password login. Google login and email registration are disabled. `GET /v1/auth/capabilities` reports the capabilities of a particular deployment. A self-hosted installation requires its own identity configuration and cannot reuse the public pilot accounts.

## Screenshots

These English screenshots show actual mobile components running in React Native Web at a 390 × 844 viewport. Rooms, people, and HTTP responses use isolated acceptance fixtures. They demonstrate interface and interaction states, rather than production users, real voice calls, or Android device validation.

<table>
  <tr>
    <th>Discover rooms</th><th>Voice room</th><th>Create a room</th>
  </tr>
  <tr>
    <td><img src="docs/readme/images/rooms.png" width="260" alt="English room discovery screen" /></td>
    <td><img src="docs/readme/images/voice-room.png" width="260" alt="English voice room with four seats per row" /></td>
    <td><img src="docs/readme/images/create-room.png" width="260" alt="English room creation with three proficiency ranges" /></td>
  </tr>
  <tr>
    <th>Expression assistance</th><th>In-app invitation</th><th>Reconnecting</th>
  </tr>
  <tr>
    <td><img src="docs/readme/images/expression-assistance.png" width="260" alt="English expression assistance result" /></td>
    <td><img src="docs/readme/images/invite.png" width="260" alt="Invite available people inside the app" /></td>
    <td><img src="docs/readme/images/reconnecting.png" width="260" alt="English reconnecting screen" /></td>
  </tr>
</table>

See [image notes](docs/readme/README.md) for provenance, fixture boundaries, and the capture method.

## Features and current scope

| Area                    | Implemented capabilities                                                                                                                                        | Boundaries                                                                                                               |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Discovery and creation  | Room list, immediate / scheduled rooms, 2–6 seats, A1–A2 / B1–B2 / C1–C2 ranges, four-digit room passwords                                                      | Language filters and topic categories are deferred; discovery avatar previews lack API fields                            |
| Entry and voice         | Direct entry from a room card; a password prompt for protected rooms; automatic device checks and warnings; LiveKit audio, mute, member state, and reconnection | LiveKit must be configured; device permissions and audio behavior require device validation                              |
| Room interaction        | Room text messages, four seats per row, member management, host handoff, and fast exit                                                                          | Room messages are not one-to-one private conversations                                                                   |
| In-app invitations      | Hosts select currently available people; authenticated foreground presence heartbeats                                                                           | Invitations do not reserve seats; the server rechecks eligibility and capacity on entry                                  |
| Expression and learning | Hold to speak in a native language, release for English; room microphone muted during recording; vocabulary, restrictions and appeals, logout                   | AI / transcription requires external providers, feature flags, and processing consent; availability varies by deployment |
| Administration          | Active / scheduled rooms, expanded room cards, safety cases, appeals, degraded incidents, roles, and audit records                                              | Authorization is enforced on the server; the admin interface is currently primarily Chinese                              |
| Delivery                | PR previews, Android builds, production deployment after merge, and a gated public APK download                                                                 | Database migrations are separate; PR APKs currently connect to the production API                                        |

A dedicated partner discovery page and one-to-one conversation list / messaging are not finished; their discovery navigation items remain static. iOS delivery is deferred. Continuous room speech processing, post-room keywords, and some governance capabilities have backend implementations but require separate configuration, workers, and external-service acceptance. See [OpenSpec](openspec/) for requirements and ongoing changes; a visible entry alone does not establish feature completion.

## Architecture

![Slogan system architecture](docs/readme/architecture.svg)

Mobile and admin clients call the NestJS control plane over HTTP. Clients connect directly to LiveKit for voice tracks. PostgreSQL holds business facts such as accounts, sessions, rooms, memberships, messages, and durable commands. Redis supports presence, coordination, and queues in standalone runtimes. Vercel deployments use managed queues for short realtime cleanup tasks.

Key engineering decisions:

- **Database and media ownership:** the database determines membership eligibility and room state; LiveKit carries media. Credential versions and recovery rules govern stale connections.
- **Fast exit with durable cleanup:** business state and a pending cleanup command are persisted before returning. Background processing retries realtime cleanup without making the user wait for LiveKit.
- **Sessions and permissions:** administrative roles are distinct from room hosting. Short-lived access tokens, revocable refresh sessions, browser HttpOnly refresh cookies, and native SecureStore handle the client-specific session lifecycle.
- **One API contract:** NestJS generates `openapi/openapi.yaml`; client types are generated from this contract rather than maintained independently.
- **A layered modular backend:** presentation handles requests, application orchestrates use cases, domain defines business rules, and infrastructure integrates storage and external services.
- **Separate acceptance and release evidence:** automated tests, original-design comparisons, cloud checks, and device audio validation establish different results. A successful build does not prove all of them.

A continuous room speech worker and a short cleanup consumer have different runtime needs. Continuous audio processing requires a worker suitable for long-lived connections; an individual managed queue invocation is not a substitute. See the [Vercel queue deployment guide](docs/deployment/room-experience-vercel-queues.md).

## Technology

| Layer                      | Technologies                                                            |
| -------------------------- | ----------------------------------------------------------------------- |
| Workspace                  | TypeScript, Node.js 24.21.0, pnpm 12.3.4                                |
| Mobile / web               | React 19, React Native 0.86, Expo 57, Expo Router, React Native Web     |
| Admin                      | React, Vite, React Router, TanStack Query, Tailwind CSS                 |
| Backend                    | NestJS 12, Prisma 7, PostgreSQL, Redis, BullMQ, Vercel Queues           |
| Realtime audio             | LiveKit client and server SDKs                                          |
| Contracts and verification | OpenAPI, openapi-typescript, Jest, Vitest, Playwright                   |
| Delivery                   | Vercel API, Cloudflare Pages, GitHub Actions / Releases, Android Gradle |

```text
apps/
  mobile/       Android and web client
  admin/        Admin console
  api/          NestJS API, Prisma migrations, and workers
packages/
  api-client/   OpenAPI-generated types and client
  shared/       Pure TypeScript shared definitions
openapi/        The sole published API contract
openspec/       Current requirements, changes, and archives
assets/         Branding, fonts, and design assets
tests/          End-to-end tests and visual runtime harness
scripts/        Pages builds, delivery, and dependency checks
docs/           Development, deployment, acceptance, and releases
```

## Run locally

Install Git, Node.js (nvm recommended), pnpm, Docker, and Docker Compose. Native Android builds also need a JDK and Android SDK; see the [Android delivery guide](docs/deployment/android-automatic-delivery.md) for versions and build steps.

### 1. Install and copy environment templates

```bash
git clone https://github.com/cuilongsheng/Slogan.git
cd Slogan
nvm use
corepack enable
pnpm install --frozen-lockfile

cp apps/api/.env.example apps/api/.env
cp apps/admin/.env.example apps/admin/.env
cp apps/mobile/.env.example apps/mobile/.env
```

Set independent random values of at least 32 characters for `JWT_ACCESS_SECRET`, `REFRESH_TOKEN_PEPPER`, and `ROOM_PASSWORD_PEPPER` in `apps/api/.env`. Template placeholders are not suitable for public deployments. External capabilities are disabled by default; keep them disabled initially. Do not commit real `.env` files or account inputs.

### 2. Start local data services and apply migrations

```bash
docker compose -f apps/api/docker-compose.dev.yml up -d --wait
pnpm --filter @slogan/api db:migrate:deploy
```

This Compose configuration starts local PostgreSQL and Redis at the addresses used by the API template. The migration command targets the current `DATABASE_URL`; confirm that it points to the local database before running it.

### 3. Start the apps in separate terminals

```bash
# Terminal 1: API, http://localhost:3000 by default
pnpm dev:api

# Terminal 2: admin, http://localhost:5173 by default
pnpm dev:admin

# Terminal 3: mobile web, http://localhost:8082
pnpm --filter @slogan/mobile exec expo start --web --port 8082
```

Use `http://localhost:3000` as the frontend API base URL during development, without appending `/v1`. A fresh database has no pilot accounts. Follow the [account provisioning guide](docs/preview-accounts-runbook.md) to configure controlled accounts and permissions. Full email registration requires a mail provider; see the [email authentication guide](docs/email-password-auth-runbook.md).

For real voice, configure `REALTIME_ENABLED`, `LIVEKIT_*`, and `REDIS_URL` in the API and start the appropriate consumer described in the [realtime deployment guide](docs/deployment/room-experience-vercel-queues.md). Running the pages alone does not make voice services ready.

Native LiveKit uses custom native modules and requires a development build or APK. Expo Go cannot validate the complete voice experience. A phone accessing a local API needs a reachable LAN address, suitable server binding, allowed origins, and device networking; `localhost` on a phone refers to the phone itself.

## Configuration and API

| Scope               | Reference                                                 | Purpose                                                                                                    |
| ------------------- | --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| API                 | [apps/api/.env.example](apps/api/.env.example)            | Database, session secrets, allowed origins, authentication, LiveKit, Redis, AI / STT, and governance flags |
| Admin               | [apps/admin/.env.example](apps/admin/.env.example)        | `VITE_API_BASE_URL`                                                                                        |
| Mobile              | [apps/mobile/.env.example](apps/mobile/.env.example)      | `EXPO_PUBLIC_API_BASE_URL`                                                                                 |
| Local data services | [docker-compose.dev.yml](apps/api/docker-compose.dev.yml) | Local PostgreSQL / Redis                                                                                   |

Browser authentication checks allowed origins. Update the API allowlists and redeploy when frontend origins change. `EXPO_PUBLIC_*` and `VITE_*` are client-visible configuration and must not contain server secrets.

Public Pages deployments use a same-origin `/v1` proxy. Set each frontend variable to **that site's full HTTPS origin**, rather than the backend domain. Native Android builds connect to the Vercel API directly. See [automatic delivery configuration](docs/deployment/android-automatic-delivery.md) for values and proxy boundaries.

[openapi/openapi.yaml](openapi/openapi.yaml) is the API contract. After changing the API, generate the contract and client in order, then check for drift:

```bash
pnpm --filter @slogan/api openapi:generate
pnpm --filter @slogan/api-client generate
pnpm --filter @slogan/api openapi:check
pnpm --filter @slogan/api-client generate:check
```

Do not edit generated client types manually. See the [API client documentation](packages/api-client/README.md) for usage and the [API README](apps/api/README.md) for backend modules and learning material.

## Verification and delivery

Choose checks appropriate to the change:

```bash
pnpm lint
pnpm typecheck
pnpm deps:check
pnpm test
pnpm build

# API integration / end-to-end verification; starts an isolated test database
pnpm verify:api

# Pages, visual checks, and browser flows
pnpm test:e2e

# Full repository verification
pnpm verify
```

Database tests require Docker. External-service and device capabilities need additional acceptance. The visual harness runs real components with explicit test adapters, without production accounts or a real audio provider. See the [acceptance documentation](docs/acceptance/README.md) for evidence and known differences.

![Slogan delivery flow](docs/readme/delivery.svg)

| Trigger          | API / frontends                                              | Android                                                                                                               |
| ---------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| PR / branch push | Git integrations create Vercel and Pages preview deployments | Actions builds downloadable workflow artifacts; the public APK stays unchanged                                        |
| Merge to `main`  | Vercel and both Pages projects deploy production versions    | After build and verification of all three deployed versions, publish to Releases and update the stable download entry |

The APK release gate checks the API's `x-slogan-commit`, both Pages `release.json` files, current `main`, APK metadata, and SHA-256. The download page reads release metadata; large APKs are not committed into the frontend source. PR APKs currently use the production API rather than the matching backend preview.

API builds do not automatically apply Prisma migrations. Schema releases require backup, compatible migrations, and rollback sequencing through the [deployment runbook](docs/runbooks/deployment.md). Redis configuration and data lifecycle are also separate from Git-driven application deployment.

## Documentation

Start with the [documentation index](docs/README.md) for current guides and dated evidence.

| Topic                        | References                                                                                                                                                                                  |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Current product requirements | [OpenSpec specifications](openspec/specs/) / [ongoing changes](openspec/changes/)                                                                                                           |
| Engineering conventions      | [Project guide](AGENTS.md) / [delivery lifecycle](workflow/delivery-lifecycle.md)                                                                                                           |
| Development and structure    | [Development](docs/development.md) / [project structure](docs/architecture/project-structure.md)                                                                                            |
| Backend and contract         | [API README](apps/api/README.md) / [OpenAPI](openapi/openapi.yaml)                                                                                                                          |
| Account setup                | [Controlled pilot accounts](docs/preview-accounts-runbook.md) / [email authentication](docs/email-password-auth-runbook.md)                                                                 |
| Delivery and operations      | [Android delivery](docs/deployment/android-automatic-delivery.md) / [realtime queues](docs/deployment/room-experience-vercel-queues.md) / [deployment runbook](docs/runbooks/deployment.md) |
| Evidence and releases        | [Acceptance records](docs/acceptance/) / [release records](docs/releases/)                                                                                                                  |

Some documents record a particular date, commit, or delivery stage; read them in that context. `docs/init/PRD_V1.md` is a frozen historical baseline. OpenSpec owns current product requirements, OpenAPI owns the API contract, and confirmed original Figma designs own visual truth.

## Contributing and license

Define behavior and scope through OpenSpec before implementing feature changes, and provide the relevant verification evidence. Access Figma files only through the connected Desktop Bridge. UI restoration requires a direct comparison between the original design and the running frontend. Keep secrets, provisioned account passwords, and raw user audio out of commits.

The code is released under the [MIT License](LICENSE). Third-party assets retain their own licenses, including [fonts under OFL](assets/fonts/OFL.txt) and [country flags under MIT](docs/design/icons/country-flags/LICENSE).
