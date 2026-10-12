import assert from 'node:assert/strict';
import test from 'node:test';
import { waitForProductionPagesApi } from '../build-pages.mjs';
const commit = 'a'.repeat(40);
const env = { CF_PAGES_BRANCH: 'main', CF_PAGES_COMMIT_SHA: commit };
test('preview and local builds never wait for or query the production API', async () => {
  await waitForProductionPagesApi(
    {},
    {
      fetchApi: () => {
        throw new Error('must not fetch');
      },
    },
  );
  await waitForProductionPagesApi(
    { ...env, CF_PAGES_BRANCH: 'codex/room-fix' },
    {
      fetchApi: () => {
        throw new Error('must not fetch');
      },
    },
  );
});
test('old API and HTML fallback cannot publish new Pages; an exact migrated API commit releases the gate', async () => {
  let time = 0,
    calls = 0;
  await waitForProductionPagesApi(env, {
    now: () => time,
    pause: async (ms) => {
      time += ms;
    },
    fetchApi: async () => {
      calls++;
      if (calls === 1) return Response.json({}, { headers: { 'x-slogan-commit': 'b'.repeat(40) } });
      if (calls === 2)
        return new Response('<html>login</html>', { headers: { 'x-slogan-commit': commit } });
      return Response.json({ password: true }, { headers: { 'x-slogan-commit': commit } });
    },
  });
  assert.equal(calls, 3);
});
test('missing commit and readiness timeout fail closed rather than publishing against stale API', async () => {
  await assert.rejects(
    waitForProductionPagesApi({ CF_PAGES_BRANCH: 'main' }),
    /commit is required/,
  );
  let time = 0;
  await assert.rejects(
    waitForProductionPagesApi(env, {
      now: () => time,
      pause: async (ms) => {
        time += ms;
      },
      timeoutMs: 30_000,
      fetchApi: async () => {
        throw new Error('unavailable');
      },
    }),
    /previous Pages deployment must remain active/,
  );
});
