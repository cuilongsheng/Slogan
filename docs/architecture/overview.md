# Architecture Overview

Slogan is a TypeScript / pnpm monorepo with an Expo / React Native mobile client, a React admin client, a NestJS modular API, PostgreSQL persistence, Redis coordination, and LiveKit realtime audio. See the [project structure](project-structure.md) for directory ownership and dependency boundaries, and the [project README](../../README.md#architecture) for the architecture diagram.

## Runtime boundaries

- The API owns durable room and membership state, authentication, permissions, safety records, and cleanup commands in PostgreSQL through Prisma. [OpenAPI](../../openapi/openapi.yaml) is the sole API contract; the shared client is generated from it.
- LiveKit carries room audio and realtime signals. Media-provider state does not replace database membership generations or authorization decisions. Durable commands reconcile provider cleanup after business departure has committed.
- Redis supports presence, rate limits, and queue coordination in persistent-process environments. Vercel uses a separate managed Queues consumer for short realtime cleanup tasks; that function does not replace continuous room-audio processing.
- Cloudflare Pages serves the two web clients and packages a same-origin `/v1/*` proxy. Android communicates with the public API directly. Provider integrations and credentials remain server-side.
- Git integrations deploy API and web revisions. The Android workflow publishes a matching APK only after the production commit gate passes. Database migrations and infrastructure configuration remain explicit release operations.

Consult the [deployment runbook](../runbooks/deployment.md) for release sequencing. Architecture and source configuration describe implementation boundaries; actual cloud, provider, and device behavior requires the corresponding [acceptance](../acceptance/README.md) and [release records](../releases/README.md).

Add architecture decisions only when an approved change requires meaningful alternatives, migration cost, or rollback reasoning. Current product intent belongs in OpenSpec, not in an obsolete architecture draft.
