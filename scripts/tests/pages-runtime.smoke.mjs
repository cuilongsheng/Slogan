// Runs the actual output workers in Cloudflare's workerd; outbound traffic is loopback only.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { copyFile, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer as createSocketServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

async function unusedPort() {
  const server = createSocketServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

// Uses a bounded readiness poll, without connecting to any platform account.
async function ready(origin, child, output) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`workerd exited before readiness: ${output()}`);
    try {
      const response = await fetch(`${origin}/rooms`, { signal: AbortSignal.timeout(500) });
      if (response.ok) return;
    } catch {
      /* starting */
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`workerd readiness timed out: ${output()}`);
}

test(
  'actual admin and mobile _worker.js execute in workerd with native fetch, Headers.getAll and ASSETS binding',
  { timeout: 60_000 },
  async () => {
    const directory = await mkdtemp(join(tmpdir(), 'slogan-workerd-'));
    const workerRoot = new URL('../../', import.meta.url);
    const expectedCookies = [
      'slogan_web_refresh=synthetic; Path=/v1/auth/web; HttpOnly; Secure; SameSite=Lax',
      'expired=; Path=/v1/auth/web; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; Secure; SameSite=Lax',
    ];
    let upstreamCalls = 0;
    const upstream = createServer(async (request, response) => {
      upstreamCalls++;
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
      if (request.url === '/v1/redirect') {
        response.writeHead(307, {
          location: 'https://fixture-api.onrender.com/v1/destination?q=1',
        });
        response.end();
        return;
      }
      if (request.url === '/v1/external') {
        response.writeHead(307, { location: 'https://evil.test/v1' });
        response.end();
        return;
      }
      if (request.url === '/v1/missing') {
        response.writeHead(404, { 'content-type': 'application/json' });
        response.end('{"code":"NOT_FOUND"}');
        return;
      }
      response.writeHead(200, {
        'content-type': 'application/json',
        'set-cookie': expectedCookies,
        'cache-control': 'public, max-age=3600',
      });
      response.end(
        JSON.stringify({
          method: request.method,
          url: request.url,
          bytes: Buffer.concat(chunks).toString('base64'),
          origin: request.headers.origin,
          authorization: request.headers.authorization,
          cookie: request.headers.cookie,
          spoofedIp: request.headers['x-real-ip'] ?? null,
        }),
      );
    });
    let child;
    let logs = '';
    try {
      await new Promise((resolve) => upstream.listen(0, '127.0.0.1', resolve));
      const ports = await Promise.all([unusedPort(), unusedPort(), unusedPort()]);
      const outputs = ['apps/admin/dist/_worker.js', 'apps/mobile/dist-pages/_worker.js'];
      for (const [index, file] of outputs.entries()) {
        await copyFile(new URL(file, workerRoot), join(directory, `worker${index}.mjs`));
        assert.equal(
          await readFile(new URL(file, workerRoot), 'utf8'),
          await readFile(new URL('scripts/pages-api-proxy.mjs', workerRoot), 'utf8'),
        );
      }
      await writeFile(
        join(directory, 'assets.mjs'),
        'export default { fetch(request) { return new Response("ASSETS:" + new URL(request.url).pathname); } };',
      );
      const services = outputs.map(
        (_file, index) =>
          `(name = "site${index}", worker = (modules = [(name = "main", esModule = embed ${JSON.stringify(`worker${index}.mjs`)})], compatibilityDate = "2026-10-04", globalOutbound = "upstream", bindings = [(name = "API_UPSTREAM_ORIGIN", text = "https://fixture-api.onrender.com"), (name = "ASSETS", service = "assets")]))`,
      );
      services.push(
        `(name = "unconfigured", worker = (modules = [(name = "main", esModule = embed ${JSON.stringify('worker0.mjs')})], compatibilityDate = "2026-10-04", globalOutbound = "upstream", bindings = [(name = "ASSETS", service = "assets")]))`,
      );
      services.push(
        '(name = "assets", worker = (modules = [(name = "main", esModule = embed "assets.mjs")], compatibilityDate = "2026-10-04"))',
      );
      services.push(
        `(name = "upstream", external = (address = "127.0.0.1:${upstream.address().port}", http = ()))`,
      );
      services.push('(name = "internet", network = (allow = []))');
      const sockets = ports.map(
        (port, index) =>
          `(name = "socket${index}", address = "127.0.0.1:${port}", http = (), service = "${index < 2 ? `site${index}` : 'unconfigured'}")`,
      );
      await writeFile(
        join(directory, 'config.capnp'),
        `using Workerd = import "/workerd/workerd.capnp";\nconst config :Workerd.Config = (services = [${services.join(',')}], sockets = [${sockets.join(',')}]);\n`,
      );
      child = spawn(
        'pnpm',
        ['dlx', 'workerd@1.20261004.1', 'serve', join(directory, 'config.capnp')],
        { detached: true, stdio: ['ignore', 'pipe', 'pipe'] },
      );
      child.stdout.on('data', (data) => {
        logs += data.toString();
      });
      child.stderr.on('data', (data) => {
        logs += data.toString();
      });
      for (const port of ports) await ready(`http://127.0.0.1:${port}`, child, () => logs);
      for (const port of ports.slice(0, 2)) {
        const origin = `http://127.0.0.1:${port}`;
        const bytes = new Uint8Array([0, 255, 13, 10, 123, 125]);
        const response = await fetch(`${origin}/v1/auth/web/refresh?x=1&x=2`, {
          method: 'POST',
          body: bytes,
          headers: {
            origin: 'https://fixture.pages.dev',
            authorization: 'Bearer synthetic',
            cookie: 'slogan_web_refresh=synthetic',
            'x-real-ip': '1.2.3.4',
          },
        });
        assert.equal(response.status, 200);
        assert.equal(response.headers.get('cache-control'), 'private, no-store');
        assert.deepEqual(response.headers.getSetCookie(), expectedCookies);
        assert.deepEqual(await response.json(), {
          method: 'POST',
          url: '/v1/auth/web/refresh?x=1&x=2',
          bytes: Buffer.from(bytes).toString('base64'),
          origin: 'https://fixture.pages.dev',
          authorization: 'Bearer synthetic',
          cookie: 'slogan_web_refresh=synthetic',
          spoofedIp: null,
        });
        const redirect = await fetch(`${origin}/v1/redirect`, { redirect: 'manual' });
        assert.equal(redirect.status, 307);
        assert.equal(redirect.headers.get('location'), `${origin}/v1/destination?q=1`);
        assert.equal((await fetch(`${origin}/v1/external`, { redirect: 'manual' })).status, 502);
        assert.equal((await fetch(`${origin}/v1/missing`)).status, 404);
        assert.equal(await (await fetch(`${origin}/rooms`)).text(), 'ASSETS:/rooms');
      }
      const unconfigured = `http://127.0.0.1:${ports[2]}`;
      assert.equal((await fetch(`${unconfigured}/v1`)).status, 503);
      assert.equal(
        await (await fetch(`${unconfigured}/assets/logo.png`)).text(),
        'ASSETS:/assets/logo.png',
      );
      assert.equal(upstreamCalls, 8);
      assert.ok(
        !logs.includes('Falling back'),
        'workerd must support the requested compatibility date',
      );
      assert.ok(!logs.includes('Uncaught'), 'workerd must not emit an uncaught runtime exception');
    } finally {
      if (child?.pid) {
        const stopped = new Promise((resolve) => child.once('exit', resolve));
        try {
          process.kill(-child.pid, 'SIGTERM');
        } catch {
          /* already exited */
        }
        if (child.exitCode === null) await stopped;
      }
      upstream.closeAllConnections();
      await new Promise((resolve) => upstream.close(resolve));
      await rm(directory, { recursive: true, force: true });
    }
  },
);
