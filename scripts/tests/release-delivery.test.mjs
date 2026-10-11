import assert from 'node:assert/strict';
import test from 'node:test';
import { deploymentState, PAGE_CHECKS } from '../release/deployment-gate.mjs';
const status = { statuses: [] };
const names = [...PAGE_CHECKS, 'Phase-one verification', 'Guarded production API'];
const checks = (conclusion = 'success', state = 'completed') => ({
  check_runs: names.map((name) => ({ name, status: state, conclusion })),
});
test('requires exact Pages, verification, and guarded production checks', () => {
  assert.equal(deploymentState(status, checks()), true);
  for (const name of names)
    assert.equal(
      deploymentState(status, {
        check_runs: checks().check_runs.filter((row) => row.name !== name),
      }),
      false,
    );
  assert.equal(deploymentState(status, checks(null, 'in_progress')), false);
});
test('failed or cancelled gates stop APK publication', () => {
  for (const conclusion of ['failure', 'cancelled', 'timed_out', 'neutral', null])
    assert.throws(() => deploymentState(status, checks(conclusion)));
});

test('production runtime gate rejects stale API, stale Pages and HTML fallback; permits three matching commits', async () => {
  const { assertRuntime, API_ORIGIN, SITES } = await import('../release/deployment-gate.mjs');
  const original = globalThis.fetch;
  const sha = 'a'.repeat(40);
  try {
    for (const bad of [API_ORIGIN, SITES[0], SITES[1], 'html', null]) {
      globalThis.fetch = async (url) => {
        if (bad === 'html')
          return new Response('<html>login</html>', { headers: { 'content-type': 'text/html' } });
        const origin = new URL(url).origin;
        const commit = origin === bad ? 'b'.repeat(40) : sha;
        return Response.json(origin === API_ORIGIN ? { password: true } : { commit }, {
          headers: { 'x-slogan-commit': commit },
        });
      };
      if (bad) await assert.rejects(assertRuntime(sha));
      else await assertRuntime(sha);
    }
  } finally {
    globalThis.fetch = original;
  }
});
test('a completed older build cannot update latest when main moved', async () => {
  const { assertMain } = await import('../release/deployment-gate.mjs');
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => Response.json({ object: { sha: 'b'.repeat(40) } });
    await assert.rejects(assertMain('a'.repeat(40)), /main changed/);
  } finally {
    globalThis.fetch = original;
  }
});
