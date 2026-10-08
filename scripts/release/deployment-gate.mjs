import { pathToFileURL } from 'node:url';
export const REPOSITORY = 'cuilongsheng/Slogan';
export const API_ORIGIN = 'https://slogan-api-pi.vercel.app';
export const SITES = [
  'https://slogan-preview-admin.pages.dev',
  'https://slogan-preview-mobile.pages.dev',
];
export const PAGE_CHECKS = [
  'Cloudflare Pages: slogan-preview-admin',
  'Cloudflare Pages: slogan-preview-mobile',
];
export function deploymentState(status, checks) {
  const vercel = status.statuses?.find((item) => item.context === 'Vercel');
  const pages = PAGE_CHECKS.map((name) => checks.check_runs?.find((item) => item.name === name));
  if (vercel && ['failure', 'error'].includes(vercel.state))
    throw new Error('Vercel deployment failed');
  for (const check of pages)
    if (check?.status === 'completed' && check.conclusion !== 'success')
      throw new Error(`${check.name} deployment failed`);
  return (
    vercel?.state === 'success' &&
    pages.every((item) => item?.status === 'completed' && item.conclusion === 'success')
  );
}
export async function github(path, { method = 'GET', body } = {}) {
  const token = process.env.GITHUB_TOKEN;
  const response = await fetch(`https://api.github.com/repos/${REPOSITORY}${path}`, {
    method,
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`GitHub ${method} ${path}: HTTP ${response.status}`);
  return response.json();
}
export async function assertMain(sha) {
  if ((await github('/git/ref/heads/main')).object.sha !== sha)
    throw new Error('main changed; this build cannot update latest');
}
export async function assertRuntime(sha) {
  const api = await fetch(`${API_ORIGIN}/v1/auth/capabilities`, {
    cache: 'no-store',
    signal: AbortSignal.timeout(45000),
  });
  if (
    !api.ok ||
    !api.headers.get('content-type')?.includes('application/json') ||
    api.headers.get('x-slogan-commit') !== sha
  )
    throw new Error('Production API does not match release commit');
  await api.json();
  for (const site of SITES) {
    const r = await fetch(`${site}/release.json?commit=${sha}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(30000),
    });
    if (
      !r.ok ||
      !r.headers.get('content-type')?.includes('application/json') ||
      (await r.json()).commit !== sha
    )
      throw new Error(`${site}: production commit mismatch`);
  }
}
export async function waitForDeployments(sha, { timeoutMs = 45 * 60000, pollMs = 20000 } = {}) {
  if (!/^[a-f0-9]{40}$/.test(sha ?? '')) throw new Error('A full release commit is required');
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await assertMain(sha);
    const [status, checks] = await Promise.all([
      github(`/commits/${sha}/status`),
      github(`/commits/${sha}/check-runs?per_page=100`),
    ]);
    if (deploymentState(status, checks)) {
      try {
        await assertRuntime(sha);
        return;
      } catch (e) {
        console.log(e.message);
      }
    }
    console.log('Waiting for API and both Pages production deployments');
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
  throw new Error('Production deployment gate timed out; latest APK was not changed');
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  waitForDeployments(process.env.SLOGAN_RELEASE_COMMIT).catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
