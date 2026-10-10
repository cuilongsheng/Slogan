# API client

`openapi/openapi.yaml` is the sole contract. Generate this package's `src/generated/schema.d.ts` with the following commands; never edit it manually:

```bash
pnpm --filter @slogan/api-client generate
pnpm --filter @slogan/api-client generate:check
```

`generate:check` fails if generated output differs from the current YAML. `createSloganApiClient` accepts an explicit API base URL and an optional `fetch` implementation. The package does not store sessions or define business error copy. Mobile consumes it through `apps/mobile/src/api/client.ts`.

The generator temporarily requires package-isolated TypeScript 5.9; mobile still checks generated types with the project's pinned TypeScript 6.
