import createClient from 'openapi-fetch';

import type { paths } from './generated/schema';

export type SloganApiPaths = paths;

export interface SloganApiClientOptions {
  baseUrl: string;
  fetch?: typeof globalThis.fetch;
  onRequest?: (request: Request, schemaPath: string) => void;
}

export function createSloganApiClient({ baseUrl, fetch, onRequest }: SloganApiClientOptions) {
  let url: URL;

  try {
    url = new URL(baseUrl);
  } catch {
    throw new Error('A valid absolute API base URL is required.');
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('The API base URL must use HTTP or HTTPS.');
  }

  const client = createClient<paths>({
    baseUrl: url.toString().replace(/\/$/, ''),
    ...(fetch ? { fetch } : {}),
  });
  if (onRequest)
    client.use({
      onRequest: ({ request, schemaPath }) => {
        onRequest(request, schemaPath);
      },
    });
  return client;
}

export type SloganApiClient = ReturnType<typeof createSloganApiClient>;
