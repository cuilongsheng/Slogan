# Architecture Overview

Status: project structure approved through `bootstrap-project-architecture`; runtime architecture is not yet implemented.

The approved target is a pnpm monorepo with a React Native + Expo mobile client, a PC admin frontend, a NestJS modular monolith, PostgreSQL persistence, Redis coordination, and LiveKit Cloud realtime audio. See `project-structure.md` for directory and dependency boundaries. These documents and directory placeholders are not proof of implemented runtime behavior.

Architecture decisions should be added only when required by an approved change. Use `docs/architecture/decisions/` for decisions with meaningful alternatives, migration cost, or rollback impact.
