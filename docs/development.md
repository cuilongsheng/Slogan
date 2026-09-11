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

## Current Backend Boundary

Identity/profile APIs, PostgreSQL persistence, rotating sessions and the generated OpenAPI
contract are implemented locally. Product UI, generated frontend client, rooms, Redis, LiveKit,
moderation, STT, AI, hosted CI, deployment and production monitoring remain outside this change.
