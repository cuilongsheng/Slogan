// Protocol regression against the real controller; identities/session storage are isolated fixtures.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createServer } from 'node:https';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import test from 'node:test';
import { chromium } from '@playwright/test';
import { createApiProxy } from '../pages-api-proxy.mjs';

const requireApi = createRequire(new URL('../../apps/api/package.json', import.meta.url));
const { Test } = requireApi('@nestjs/testing');
const { ConfigService } = requireApi('@nestjs/config');
const { ValidationPipe } = requireApi('@nestjs/common');
const dist = new URL('../../apps/api/dist/', import.meta.url);
const load = (file) => import(new URL(file, dist));
const { BrowserAuthController } = await load(
  'modules/auth/presentation/browser-auth.controller.js',
);
const { AuthService } = await load('modules/auth/application/services/auth.service.js');
const { EmailAuthService } = await load('modules/auth/application/services/email-auth.service.js');
const { SessionService } = await load('modules/auth/application/services/session.service.js');
const { AuthError } = await load('modules/auth/domain/errors/auth.error.js');
const { ApiExceptionFilter } = await load('common/filters/api-exception.filter.js');

async function serve(proxy, tls, hostname, env) {
  const server = createServer(tls, async (incoming, outgoing) => {
    try {
      const origin = `https://${incoming.headers.host}`;
      const headers = new Headers();
      for (const [key, value] of Object.entries(incoming.headers))
        if (value) headers.set(key, Array.isArray(value) ? value.join(', ') : value);
      const response = await proxy.fetch(
        new Request(`${origin}${incoming.url}`, {
          method: incoming.method,
          headers,
          body: ['GET', 'HEAD'].includes(incoming.method) ? undefined : incoming,
          duplex: 'half',
        }),
        env,
      );
      outgoing.statusCode = response.status;
      for (const [key, value] of response.headers)
        if (key !== 'set-cookie') outgoing.setHeader(key, value);
      const cookies = response.headers.getSetCookie();
      if (cookies.length) outgoing.setHeader('set-cookie', cookies);
      outgoing.end(Buffer.from(await response.arrayBuffer()));
    } catch {
      outgoing.statusCode = 500;
      outgoing.end('fixture failed');
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { server, origin: `https://${hostname}:${server.address().port}` };
}

async function browserCall(page, path, body) {
  return page.evaluate(
    async ({ path, body }) => {
      const response = await fetch(path, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      return {
        status: response.status,
        body: response.status === 204 ? null : await response.json(),
        cache: response.headers.get('cache-control'),
      };
    },
    { path, body },
  );
}

test(
  'both HTTPS sites preserve real controller origin checks, production cookies, refresh rotation and logout',
  { timeout: 60_000 },
  async () => {
    const directory = await mkdtemp(join(tmpdir(), 'slogan-pages-browser-'));
    const servers = [];
    let app;
    let browser;
    try {
      execFileSync(
        'openssl',
        [
          'req',
          '-x509',
          '-newkey',
          'rsa:2048',
          '-nodes',
          '-keyout',
          join(directory, 'key.pem'),
          '-out',
          join(directory, 'cert.pem'),
          '-days',
          '1',
          '-subj',
          '/CN=localhost',
          '-addext',
          'subjectAltName=DNS:localhost,IP:127.0.0.1',
        ],
        { stdio: 'ignore' },
      );
      const tls = {
        key: await readFile(join(directory, 'key.pem')),
        cert: await readFile(join(directory, 'cert.pem')),
      };
      let upstreamOrigin;
      const proxy = createApiProxy({
        fetchUpstream: (url, options) => {
          const target = new URL(url);
          return fetch(`${upstreamOrigin}${target.pathname}${target.search}`, options);
        },
      });
      const env = {
        API_UPSTREAM_ORIGIN: 'https://fixture-api.onrender.com',
        ASSETS: {
          fetch: async () =>
            new Response('<html><body>Isolated Pages auth fixture</body></html>', {
              headers: { 'content-type': 'text/html' },
            }),
        },
      };
      const mobile = await serve(proxy, tls, 'localhost', env);
      servers.push(mobile.server);
      const admin = await serve(proxy, tls, '127.0.0.1', env);
      servers.push(admin.server);
      const rejectedSite = await serve(proxy, tls, 'localhost', env);
      servers.push(rejectedSite.server);
      const config = new ConfigService({
        NODE_ENV: 'production',
        GOOGLE_OAUTH_REDIRECT_URIS: `${mobile.origin},${admin.origin}`,
        CORS_ALLOWED_ORIGINS: [mobile.origin, admin.origin],
        AUTH_RATE_LIMIT_POINTS: 100,
        AUTH_RATE_LIMIT_DURATION_SECONDS: 60,
      });
      const active = new Set();
      let revision = 0;
      const issue = () => {
        const refreshToken = randomBytes(32).toString('base64url');
        active.add(refreshToken);
        return {
          refreshToken,
          accessToken: `synthetic-access-${++revision}`,
          accessTokenExpiresInSeconds: 900,
        };
      };
      const sessions = {
        refresh: async (token) => {
          if (!active.delete(token))
            throw new AuthError('REFRESH_TOKEN_INVALID', 'Refresh token is invalid');
          return issue();
        },
        verifyAccessToken: async () => ({ sessionId: 'fixture' }),
        revoke: async () => {
          active.clear();
        },
      };
      const loginResult = () => ({
        userId: 'fixture-user',
        created: false,
        onboardingState: 'READY',
        tokens: issue(),
      });
      const module = await Test.createTestingModule({
        controllers: [BrowserAuthController],
        providers: [
          { provide: ConfigService, useValue: config },
          { provide: AuthService, useValue: { exchange: async () => loginResult() } },
          { provide: EmailAuthService, useValue: { login: async () => loginResult() } },
          { provide: SessionService, useValue: sessions },
        ],
      }).compile();
      app = module.createNestApplication({ logger: false });
      app.setGlobalPrefix('v1');
      app.useGlobalPipes(
        new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
      );
      app.useGlobalFilters(new ApiExceptionFilter({ warn() {}, error() {} }));
      await app.listen(0, '127.0.0.1');
      upstreamOrigin = await app.getUrl();
      browser = await chromium.launch({ headless: true });
      for (const site of [mobile, admin]) {
        const context = await browser.newContext({ ignoreHTTPSErrors: true });
        try {
          const page = await context.newPage();
          await page.goto(site.origin);
          const login = await browserCall(page, '/v1/auth/web/password/exchange', {
            username: 'fixture-user',
            password: 'synthetic-password-123',
          });
          assert.equal(login.status, 200);
          assert.equal(login.cache, 'private, no-store');
          assert.ok(!('refreshToken' in login.body));
          const [before] = await context.cookies(`${site.origin}/v1/auth/web/refresh`);
          assert.ok(before);
          assert.equal(before.name, 'slogan_web_refresh');
          assert.equal(before.httpOnly, true);
          assert.equal(before.secure, true);
          assert.equal(before.sameSite, 'Lax');
          assert.equal(before.path, '/v1/auth/web');
          assert.equal(before.domain, new URL(site.origin).hostname);
          assert.equal(await page.evaluate(() => globalThis.document.cookie), '');
          assert.equal((await context.cookies(`${site.origin}/v1/rooms`)).length, 0);
          await page.reload();
          const refreshed = await browserCall(page, '/v1/auth/web/refresh');
          assert.equal(refreshed.status, 200);
          assert.ok(!('refreshToken' in refreshed.body));
          const [after] = await context.cookies(`${site.origin}/v1/auth/web/refresh`);
          assert.notEqual(before.value, after.value);
          // Reuse rejected by the existing controller and its clear-cookie branch.
          const replay = await proxy.fetch(
            new Request(`${site.origin}/v1/auth/web/refresh`, {
              method: 'POST',
              headers: { origin: site.origin, cookie: `slogan_web_refresh=${before.value}` },
            }),
            env,
          );
          assert.equal(replay.status, 401);
          assert.match(replay.headers.getSetCookie()[0], /Expires=Thu, 01 Jan 1970/);
          const mismatch = await browserCall(page, '/v1/auth/web/google/exchange', {
            authorizationCode: 'synthetic-code',
            redirectUri: rejectedSite.origin,
          });
          assert.equal(mismatch.status, 400);
          const google = await browserCall(page, '/v1/auth/web/google/exchange', {
            authorizationCode: 'synthetic-code',
            redirectUri: site.origin,
          });
          assert.equal(google.status, 200);
          assert.equal((await browserCall(page, '/v1/auth/web/logout')).status, 204);
          assert.equal((await context.cookies(`${site.origin}/v1/auth/web/refresh`)).length, 0);
          assert.equal((await browserCall(page, '/v1/auth/web/refresh')).status, 401);
        } finally {
          await context.close();
        }
      }
      const untrusted = await browser.newContext({ ignoreHTTPSErrors: true });
      try {
        const page = await untrusted.newPage();
        await page.goto(rejectedSite.origin);
        const rejected = await browserCall(page, '/v1/auth/web/password/exchange', {
          username: 'fixture-user',
          password: 'synthetic-password-123',
        });
        assert.equal(rejected.status, 400);
        assert.equal(rejected.body.code, 'AUTH_CODE_REJECTED');
        assert.equal((await untrusted.cookies()).length, 0);
      } finally {
        await untrusted.close();
      }
      const missingOrigin = await proxy.fetch(
        new Request(`${mobile.origin}/v1/auth/web/refresh`, { method: 'POST' }),
        env,
      );
      assert.equal(missingOrigin.status, 400);
    } finally {
      if (browser) await browser.close();
      if (app) await app.close();
      for (const server of servers) {
        server.closeAllConnections();
        await new Promise((resolve) => server.close(resolve));
      }
      await rm(directory, { recursive: true, force: true });
    }
  },
);
