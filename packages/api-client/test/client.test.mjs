import assert from 'node:assert/strict';
import test from 'node:test';

import { createSloganApiClient } from '../src/index.ts';

test('requires an absolute HTTP API base URL', () => {
  assert.throws(() => createSloganApiClient({ baseUrl: '' }), /absolute API base URL/);
  assert.throws(() => createSloganApiClient({ baseUrl: 'file:///tmp/api' }), /HTTP or HTTPS/);
});

test('uses the configured origin and injected fetch for a contract path', async () => {
  let requestedUrl;
  const client = createSloganApiClient({
    baseUrl: 'https://api.example.test/',
    fetch: async (request) => {
      requestedUrl = request.url;
      return new globalThis.Response(
        JSON.stringify({ userId: 'user-1', onboardingState: 'ELIGIBLE' }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      );
    },
  });

  const result = await client.GET('/v1/me');

  assert.equal(requestedUrl, 'https://api.example.test/v1/me');
  assert.equal(result.data?.onboardingState, 'ELIGIBLE');
});

test('request observer receives a contract template with no parameter interpolation', async () => {
  const observed = [];
  const client = createSloganApiClient({
    baseUrl: 'https://api.example.test',
    onRequest: (request, schemaPath) => observed.push({ request, schemaPath }),
    fetch: async (request) => {
      assert.equal(observed[0].request, request);
      return new globalThis.Response('{}', { headers: { 'content-type': 'application/json' } });
    },
  });
  await client.GET('/v1/rooms/{roomId}', { params: { path: { roomId: 'PRIVATE_CANARY' } } });
  assert.equal(observed[0].schemaPath, '/v1/rooms/{roomId}');
});
