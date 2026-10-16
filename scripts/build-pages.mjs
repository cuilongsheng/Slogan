import { spawnSync } from 'node:child_process';
import { access, copyFile, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { API_ORIGIN } from './release/deployment-gate.mjs';
import {
  buildMetadata,
  currentRevision,
  uploadSourceMaps,
  removePublicMaps,
  runTool,
  requireCleanRelease,
  verifyClientBuild,
} from './observability-build.mjs';

export const API_ROUTES = {
  version: 1,
  include: [
    '/v1',
    '/v1/*',
    '/downloads/android',
    '/downloads/android.apk',
    '/downloads/android.json',
  ],
  exclude: [],
};
const root = new URL('../', import.meta.url);
const sites = {
  admin: {
    key: 'VITE_API_BASE_URL',
    output: 'apps/admin/dist/',
    args: ['--filter', '@slogan/admin', 'exec', 'vite', 'build', '--mode', 'pages'],
  },
  mobile: {
    key: 'EXPO_PUBLIC_API_BASE_URL',
    output: 'apps/mobile/dist-pages/',
    args: [
      '--filter',
      '@slogan/mobile',
      'exec',
      'expo',
      'export',
      '--platform',
      'web',
      '--output-dir',
      'dist-pages',
      '--clear',
    ],
  },
};

export function validateSiteOrigin(value, key) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${key} must be the site's full HTTPS origin`);
  }
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.port ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  ) {
    throw new Error(`${key} must be the site's full HTTPS origin without a path`);
  }
  return url.origin;
}

export async function packagePages(output) {
  await access(new URL('index.html', output));
  const commit = process.env.CF_PAGES_COMMIT_SHA || process.env.SLOGAN_RELEASE_COMMIT;
  if (commit && !/^[a-f0-9]{40}$/.test(commit)) throw new Error('Invalid Pages release commit');
  await writeFile(
    new URL('release.json', output),
    JSON.stringify({ commit: commit || null, builtAt: new Date().toISOString() }) + '\n',
  );
  await copyFile(new URL('scripts/pages-api-proxy.mjs', root), new URL('_worker.js', output));
  await writeFile(new URL('_routes.json', output), `${JSON.stringify(API_ROUTES, null, 2)}\n`);
}

// Production assets must not overtake the guarded API/migration rollout.
export async function waitForProductionPagesApi(
  env = process.env,
  {
    fetchApi = fetch,
    now = Date.now,
    pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    timeoutMs = 15 * 60_000,
  } = {},
) {
  if (env.CF_PAGES_BRANCH !== 'main') return;
  const commit = env.CF_PAGES_COMMIT_SHA;
  if (!/^[a-f0-9]{40}$/.test(commit || '')) throw new Error('Production Pages commit is required');
  const deadline = now() + timeoutMs;
  while (now() < deadline) {
    try {
      const response = await fetchApi(`${API_ORIGIN}/v1/auth/capabilities`, {
        cache: 'no-store',
        signal: AbortSignal.timeout(15_000),
      });
      if (
        response.ok &&
        response.headers.get('content-type')?.includes('application/json') &&
        response.headers.get('x-slogan-commit') === commit
      ) {
        await response.json();
        return;
      }
    } catch {
      /* Keep the previously deployed assets when readiness cannot be confirmed. */
    }
    console.log('Waiting for the matching production API before publishing Pages');
    await pause(15_000);
  }
  throw new Error('Production API is not ready; previous Pages deployment must remain active');
}

async function main() {
  const site = sites[process.argv[2]];
  if (!site) throw new Error('Choose admin or mobile');
  const origin = validateSiteOrigin(process.env[site.key], site.key);
  const metadata = buildMetadata(process.argv[2], process.env, currentRevision());
  if (metadata.enabled) requireCleanRelease();
  runTool('pnpm', ['--filter', '@slogan/shared', 'build'], metadata.env);
  const args = [...site.args];
  if (process.argv[2] === 'mobile' && metadata.enabled) args.push('--source-maps');
  const result = spawnSync('pnpm', args, {
    cwd: fileURLToPath(root),
    stdio: 'inherit',
    env: { ...metadata.env, [site.key]: origin, EXPO_NO_DOTENV: '1' },
  });
  if (result.error || result.status !== 0) throw new Error('Pages frontend build failed');
  await verifyClientBuild(process.argv[2], fileURLToPath(new URL(site.output, root)), metadata);
  if (process.argv[2] === 'mobile')
    await uploadSourceMaps('mobile', fileURLToPath(new URL(site.output, root)), metadata);
  await removePublicMaps(fileURLToPath(new URL(site.output, root)));
  await packagePages(new URL(site.output, root));
  await waitForProductionPagesApi();
  console.log(`Pages ${process.argv[2]} output includes worker and API routes`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
