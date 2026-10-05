import { spawnSync } from 'node:child_process';
import { access, copyFile, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const API_ROUTES = { version: 1, include: ['/v1', '/v1/*'], exclude: [] };
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
  await copyFile(new URL('scripts/pages-api-proxy.mjs', root), new URL('_worker.js', output));
  await writeFile(new URL('_routes.json', output), `${JSON.stringify(API_ROUTES, null, 2)}\n`);
}

async function main() {
  const site = sites[process.argv[2]];
  if (!site) throw new Error('Choose admin or mobile');
  const origin = validateSiteOrigin(process.env[site.key], site.key);
  const result = spawnSync('pnpm', site.args, {
    cwd: fileURLToPath(root),
    stdio: 'inherit',
    env: { ...process.env, [site.key]: origin, EXPO_NO_DOTENV: '1' },
  });
  if (result.error || result.status !== 0) throw new Error('Pages frontend build failed');
  await packagePages(new URL(site.output, root));
  console.log(`Pages ${process.argv[2]} output includes worker and API routes`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
