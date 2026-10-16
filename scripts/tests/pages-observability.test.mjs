import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApiProxy } from '../pages-api-proxy.mjs';
for (const app of ['admin', 'mobile']) {
  test(`${app} health proxy preserves unavailable status and rejects HTML fallback`, async () => {
    const env = { API_UPSTREAM_ORIGIN: 'https://slogan-api-pi.vercel.app' };
    const request = () => new Request(`https://slogan-${app}.pages.dev/v1/health/ready`);
    const unavailable = createApiProxy({
      fetchUpstream: async () => Response.json({ status: 'not_ready' }, { status: 503 }),
    });
    const response = await unavailable.fetch(request(), env);
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { status: 'not_ready' });
    assert.match(response.headers.get('cache-control'), /no-store/);
    const html = createApiProxy({
      fetchUpstream: async () =>
        new Response('<html>fallback</html>', { headers: { 'content-type': 'text/html' } }),
    });
    assert.equal((await html.fetch(request(), env)).status, 502);
  });
}
