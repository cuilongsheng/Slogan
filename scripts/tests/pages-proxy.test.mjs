import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { createApiProxy } from '../pages-api-proxy.mjs';
import { API_ROUTES, packagePages, validateSiteOrigin } from '../build-pages.mjs';

const env = { API_UPSTREAM_ORIGIN: 'https://fixture-api.onrender.com' };
const request = (path, options) => new Request(`https://fixture-admin.pages.dev${path}`, options);

test('preserves request bytes, method, query, credentials and Origin, strips untrusted forwarding and connection headers', async () => {
  const bytes = new Uint8Array([0, 255, 13, 10, 34, 123, 125]);
  let calls = 0;
  const proxy = createApiProxy({
    fetchUpstream: async (url, init) => {
      calls++;
      assert.equal(
        url,
        'https://fixture-api.onrender.com/v1/webhooks/livekit?target=https%3A%2F%2Fevil.test&x=1&x=2',
      );
      assert.equal(init.method, 'POST');
      assert.equal(init.redirect, 'manual');
      assert.equal(init.cache, 'no-store');
      assert.equal(init.headers.get('origin'), 'https://fixture-admin.pages.dev');
      assert.equal(init.headers.get('authorization'), 'Bearer synthetic-access');
      assert.equal(init.headers.get('cookie'), 'slogan_web_refresh=synthetic-cookie');
      for (const name of [
        'host',
        'connection',
        'x-remove',
        'x-forwarded-for',
        'forwarded',
        'cf-connecting-ip',
        'x-real-ip',
        'content-length',
      ])
        assert.equal(init.headers.get(name), null);
      assert.deepEqual(new Uint8Array(await new Response(init.body).arrayBuffer()), bytes);
      return new Response('denied', {
        status: 403,
        headers: {
          'content-type': 'application/json',
          'cache-control': 'public, max-age=100',
          etag: 'unsafe',
          connection: 'x-remove',
          'x-remove': 'unsafe',
        },
      });
    },
  });
  const response = await proxy.fetch(
    request('/v1/webhooks/livekit?target=https%3A%2F%2Fevil.test&x=1&x=2', {
      method: 'POST',
      body: bytes,
      headers: {
        origin: 'https://fixture-admin.pages.dev',
        authorization: 'Bearer synthetic-access',
        cookie: 'slogan_web_refresh=synthetic-cookie',
        host: 'evil.test',
        connection: 'x-remove',
        'x-remove': 'unsafe',
        'x-forwarded-for': '1.2.3.4',
        forwarded: 'for=1.2.3.4',
        'cf-connecting-ip': '1.2.3.4',
        'x-real-ip': '1.2.3.4',
        'content-length': '7',
      },
    }),
    env,
  );
  assert.equal(response.status, 403);
  assert.equal(await response.text(), 'denied');
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal(response.headers.get('etag'), null);
  assert.equal(response.headers.get('x-remove'), null);
  assert.equal(calls, 1);
});

test('preserves multiple host-only cookies including Expires commas and deletion, supports Workers getAll', async () => {
  const values = [
    'slogan_web_refresh=synthetic; Path=/v1/auth/web; HttpOnly; Secure; SameSite=Lax',
    'other=; Path=/v1/auth/web; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; Secure; SameSite=Lax',
  ];
  for (const workers of [false, true]) {
    const upstream = new Response(null, { status: 204 });
    for (const value of values) upstream.headers.append('set-cookie', value);
    if (workers)
      upstream.headers.getAll = (key) => {
        assert.equal(key, 'Set-Cookie');
        return values;
      };
    const response = await createApiProxy({ fetchUpstream: async () => upstream }).fetch(
      request('/v1/auth/web/logout', { method: 'POST' }),
      env,
    );
    assert.equal(response.status, 204);
    assert.deepEqual(response.headers.getSetCookie(), values);
    assert.equal(await response.text(), '');
  }
});

test('static and near-miss paths use Assets without upstream configuration; all API paths stay API', async () => {
  let staticCalls = 0;
  const proxy = createApiProxy({
    fetchUpstream: async () => Response.json({ code: 'NOT_FOUND' }, { status: 404 }),
  });
  const assets = {
    fetch: async () => {
      staticCalls++;
      return new Response('<html>SPA</html>');
    },
  };
  for (const path of ['/rooms/123', '/r/example', '/assets/a.js', '/v10', '/v1suffix'])
    assert.match(await (await proxy.fetch(request(path), { ASSETS: assets })).text(), /SPA/);
  for (const path of ['/v1', '/v1/', '/v1/missing']) {
    const response = await proxy.fetch(request(path), { ...env, ASSETS: assets });
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { code: 'NOT_FOUND' });
  }
  assert.equal(staticCalls, 5);
});

test('proxies to the fixed Slogan Vercel production origin', async () => {
  let target;
  const proxy = createApiProxy({
    fetchUpstream: async (url) => {
      target = url;
      return Response.json({ password: true });
    },
  });
  const response = await proxy.fetch(request('/v1/auth/capabilities'), {
    API_UPSTREAM_ORIGIN: 'https://slogan-api-pi.vercel.app',
  });
  assert.equal(response.status, 200);
  assert.equal(target, 'https://slogan-api-pi.vercel.app/v1/auth/capabilities');
});

test('rejects missing, unapproved and non-origin configurations without fetch or credential disclosure', async () => {
  const proxy = createApiProxy({
    fetchUpstream: async () => {
      assert.fail('must not fetch');
    },
  });
  for (const value of [
    undefined,
    '',
    'http://fixture-api.onrender.com',
    'https://evil.test',
    'https://fixture-api.onrender.com.evil.test',
    'https://user:synthetic@fixture-api.onrender.com',
    'https://fixture-api.onrender.com/v1',
    'https://fixture-api.onrender.com?x=1',
    'https://fixture-api.onrender.com#x',
    'https://fixture-api.onrender.com:8443',
    'https://other-project.vercel.app',
    'https://slogan-api-pi.vercel.app.evil.test',
    'https://slogan-api-pi.vercel.app/v1',
    'https://user:synthetic@slogan-api-pi.vercel.app',
  ]) {
    const response = await proxy.fetch(request('/v1/auth/web/refresh'), {
      API_UPSTREAM_ORIGIN: value,
    });
    assert.equal(response.status, 503);
    assert.equal((await response.json()).code, 'API_PROXY_CONFIGURATION_INVALID');
  }
});

test('manual redirects rewrite only approved API Locations; external, credentials and non-API fail closed', async () => {
  for (const [location, safe] of [
    ['/v1/rooms?cursor=2', true],
    ['rooms?cursor=2', true],
    ['https://fixture-api.onrender.com/v1/rooms', true],
    ['https://fixture-admin.pages.dev/v1/rooms', true],
    ['https://evil.test/v1/rooms', false],
    ['//evil.test/v1/rooms', false],
    ['/sign-in', false],
    ['https://user:synthetic@fixture-api.onrender.com/v1', false],
    ['javascript:alert(1)', false],
  ]) {
    let calls = 0;
    const proxy = createApiProxy({
      fetchUpstream: async (_url, init) => {
        calls++;
        assert.equal(init.redirect, 'manual');
        return new Response(null, { status: 307, headers: { location } });
      },
    });
    const response = await proxy.fetch(
      request('/v1/old', { headers: { authorization: 'Bearer synthetic-access' } }),
      env,
    );
    assert.equal(response.status, safe ? 307 : 502);
    if (safe)
      assert.ok(response.headers.get('location').startsWith('https://fixture-admin.pages.dev/v1/'));
    assert.equal(calls, 1);
  }
});

test('rejects Domain cookies; transport failures and cold-start deadlines are sanitized without POST replay', async () => {
  const response = await createApiProxy({
    fetchUpstream: async () =>
      new Response('ok', {
        headers: { 'set-cookie': 'session=synthetic; DOMAIN=onrender.com; Path=/' },
      }),
  }).fetch(request('/v1'), env);
  assert.equal(response.status, 502);
  let calls = 0;
  const failed = await createApiProxy({
    fetchUpstream: async () => {
      calls++;
      throw new Error('sensitive upstream detail');
    },
  }).fetch(request('/v1', { method: 'POST', body: 'synthetic' }), env);
  assert.equal(failed.status, 502);
  assert.ok(!(await failed.text()).includes('sensitive'));
  const delayed = await createApiProxy({
    timeoutMs: 10,
    fetchUpstream: async (_url, { signal }) => {
      calls++;
      return new Promise((_resolve, reject) =>
        signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true }),
      );
    },
  }).fetch(request('/v1', { method: 'POST', body: 'synthetic' }), env);
  assert.equal(delayed.status, 504);
  assert.equal(calls, 2);
});

test('HEAD preserves status/headers with no body, client cancellation reaches upstream', async () => {
  const proxy = createApiProxy({
    fetchUpstream: async (_url, init) => {
      assert.equal(init.method, 'HEAD');
      return new Response('not forwarded', { headers: { 'content-type': 'application/json' } });
    },
  });
  const response = await proxy.fetch(request('/v1', { method: 'HEAD' }), env);
  assert.equal(response.status, 200);
  assert.equal(await response.text(), '');
  const controller = new AbortController();
  const pending = createApiProxy({
    fetchUpstream: async (_url, { signal }) =>
      new Promise((_resolve, reject) =>
        signal.addEventListener('abort', () => reject(new Error('cancelled')), { once: true }),
      ),
  }).fetch(request('/v1', { signal: controller.signal }), env);
  controller.abort();
  assert.equal((await pending).status, 502);
});

test('Pages build validates public origin and packages executable source with API-only routes', async () => {
  for (const value of [
    undefined,
    '/v1',
    'http://localhost:3000',
    'https://site.pages.dev/v1',
    'https://user:synthetic@site.pages.dev',
    'https://site.pages.dev?q=1',
  ])
    assert.throws(() => validateSiteOrigin(value, 'PUBLIC_BASE'));
  assert.equal(
    validateSiteOrigin('https://site.pages.dev/', 'PUBLIC_BASE'),
    'https://site.pages.dev',
  );
  const directory = await mkdtemp(join(tmpdir(), 'slogan-pages-test-'));
  try {
    const output = pathToFileURL(`${directory}/`);
    await assert.rejects(packagePages(output));
    await writeFile(join(directory, 'index.html'), '<html>fixture</html>');
    await packagePages(output);
    assert.deepEqual(
      JSON.parse(await readFile(join(directory, '_routes.json'), 'utf8')),
      API_ROUTES,
    );
    assert.equal(
      await readFile(join(directory, '_worker.js'), 'utf8'),
      await readFile(new URL('../pages-api-proxy.mjs', import.meta.url), 'utf8'),
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('streams the response before the upstream body completes and preserves retryable API errors', async () => {
  let source;
  const stream = new ReadableStream({
    start(controller) {
      source = controller;
      controller.enqueue(new TextEncoder().encode('first'));
    },
  });
  const response = await createApiProxy({
    fetchUpstream: async () =>
      new Response(stream, {
        status: 429,
        headers: { 'retry-after': '60', 'content-type': 'text/event-stream' },
      }),
  }).fetch(request('/v1/stream'), env);
  assert.equal(response.status, 429);
  assert.equal(response.headers.get('retry-after'), '60');
  const reader = response.body.getReader();
  assert.equal(new TextDecoder().decode((await reader.read()).value), 'first');
  source.enqueue(new TextEncoder().encode('second'));
  source.close();
  assert.equal(new TextDecoder().decode((await reader.read()).value), 'second');
  assert.equal((await reader.read()).done, true);
});

test('Render HTML availability pages become sanitized JSON instead of a frontend parse error', async () => {
  for (const status of [200, 503]) {
    const response = await createApiProxy({
      fetchUpstream: async () =>
        new Response('<html>sensitive availability detail</html>', {
          status,
          headers: { 'content-type': 'text/html; charset=utf-8' },
        }),
    }).fetch(request('/v1/auth/web/refresh', { method: 'POST' }), env);
    assert.equal(response.status, status === 200 ? 502 : 503);
    assert.equal(response.headers.get('content-type'), 'application/json');
    assert.equal((await response.json()).code, 'API_PROXY_UPSTREAM_UNAVAILABLE');
  }
});

test('APK downloads use fixed public release redirects without forwarding credentials or query targets', async () => {
  const proxy = createApiProxy({ fetchUpstream: async () => assert.fail('no upstream request') });
  for (const [path, target] of [
    ['/downloads/android.apk', '/download/slogan.apk'],
    ['/downloads/android.json', '/download/android-release.json'],
    ['/downloads/android', ''],
  ]) {
    for (const method of ['GET', 'HEAD']) {
      const response = await proxy.fetch(
        request(path + '?target=https://evil.test', {
          method,
          headers: { authorization: 'Bearer synthetic', cookie: 'private=synthetic' },
        }),
        {},
      );
      assert.equal(response.status, 302);
      assert.equal(
        response.headers.get('location'),
        'https://github.com/cuilongsheng/Slogan/releases/latest' + target,
      );
      assert.equal(response.headers.get('cache-control'), 'no-store');
      assert.equal(response.headers.get('set-cookie'), null);
    }
    assert.equal((await proxy.fetch(request(path, { method: 'POST' }), {})).status, 405);
  }
  let staticCalls = 0;
  await proxy.fetch(request('/downloads/android.apk.evil'), {
    ASSETS: {
      fetch: async () => {
        staticCalls++;
        return new Response('static');
      },
    },
  });
  assert.equal(staticCalls, 1);
});
