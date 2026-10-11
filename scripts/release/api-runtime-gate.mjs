import { API_ORIGIN, assertMain } from './deployment-gate.mjs';
const sha = process.env.SLOGAN_RELEASE_COMMIT;
if (!/^[a-f0-9]{40}$/.test(sha || '')) throw new Error('RELEASE_COMMIT_REQUIRED');
await assertMain(sha);
const deadline = Date.now() + 300_000;
let success = false;
while (Date.now() < deadline) {
  const response = await fetch(`${API_ORIGIN}/v1/auth/capabilities`, {
    cache: 'no-store',
    signal: AbortSignal.timeout(30_000),
  }).catch(() => null);
  if (
    response?.ok &&
    response.headers.get('x-slogan-commit') === sha &&
    response.headers.get('content-type')?.includes('application/json')
  ) {
    const body = await response.json().catch(() => null);
    if (
      body &&
      typeof body.password === 'boolean' &&
      typeof body.google === 'boolean' &&
      typeof body.email === 'boolean'
    ) {
      success = true;
      break;
    }
  }
  await new Promise((accept) => setTimeout(accept, 10_000));
}
if (!success) throw new Error('API_RUNTIME_COMMIT_MISMATCH');
