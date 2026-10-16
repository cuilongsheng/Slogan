// Local compiler/packaging harness. No account configuration, env files or deployment.
import assert from 'node:assert/strict';
import { access, cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const directory = await mkdtemp(join(tmpdir(), 'slogan-observability-vercel-'));
try {
  const filter = (path) =>
    !['node_modules', '.git', '.vercel', 'coverage', 'logs'].includes(basename(path)) &&
    !basename(path).startsWith('.env');
  for (const path of [
    'package.json',
    'pnpm-lock.yaml',
    'pnpm-workspace.yaml',
    'tsconfig.base.json',
    'apps/api',
    'packages/shared',
    'packages/api-client',
  ]) {
    const target = join(directory, path);
    await mkdir(join(target, '..'), { recursive: true });
    await cp(join(root, path), target, { recursive: true, filter });
  }
  await mkdir(join(directory, '.vercel'), { recursive: true });
  await mkdir(join(directory, 'global'));
  await writeFile(
    join(directory, 'global/config.json'),
    JSON.stringify({ telemetryEnabled: false, updateAuto: false }),
  );
  await writeFile(
    join(directory, '.vercel/project.json'),
    JSON.stringify({
      orgId: 'team_observability_fixture',
      projectId: 'prj_observability_fixture',
      settings: {
        framework: 'nestjs',
        nodeVersion: '24.x',
        rootDirectory: 'apps/api',
        installCommand: 'true',
        buildCommand: null,
        devCommand: null,
        outputDirectory: null,
      },
    }),
  );
  const env = {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    TMPDIR: process.env.TMPDIR,
    CI: '1',
    NODE_ENV: 'test',
    VERCEL_TELEMETRY_DISABLED: '1',
  };
  const install = spawnSync(
    'pnpm',
    ['install', '--offline', '--frozen-lockfile', '--ignore-scripts'],
    { cwd: directory, env, stdio: 'inherit' },
  );
  assert.equal(install.status, 0, 'fixture dependencies must install from the local store');
  const result = spawnSync(
    'pnpm',
    [
      '--allow-build',
      'esbuild',
      'dlx',
      'vercel@63.1.2',
      'build',
      '--cwd',
      directory,
      '--global-config',
      join(directory, 'global'),
      '--non-interactive',
    ],
    { env, cwd: root, stdio: 'inherit' },
  );
  assert.equal(result.status, 0, 'isolated Vercel compiler must succeed');
  const artifacts = [];
  for (const [name, topic, source] of [
    ['index', null, 'src/main'],
    ['api/realtime', 'slogan-realtime', 'api/realtime'],
    ['api/observability', 'slogan-observability', 'api/observability'],
    ['api/maintenance', 'slogan-maintenance', 'api/maintenance'],
    ['api/maintenance-seed', null, 'api/maintenance-seed'],
    ['api/live-updates', null, 'api/live-updates'],
  ]) {
    // The isolated monitoring commit can precede the separate managed-queue
    // feature. Verify every consumer that exists in this checkout.
    if (name !== 'index') {
      try {
        await access(join(directory, 'apps/api', source + '.ts'));
      } catch {
        continue;
      }
    }
    const output = join(directory, '.vercel/output/functions', `${name}.func`);
    const config = JSON.parse(await readFile(join(output, '.vc-config.json'), 'utf8'));
    assert.equal(config.runtime, 'nodejs24.x');
    assert.deepEqual(config.environment, {});
    if (topic) assert.equal(config.experimentalTriggers[0].topic, topic);
    const map = JSON.parse(await readFile(join(output, 'apps/api', `${source}.js.map`), 'utf8'));
    assert.ok(map.sources.length > 0);
    assert.equal(map.version, 3);
    artifacts.push({
      name,
      runtime: config.runtime,
      handler: config.handler,
      topic,
      sourceMap: `apps/api/${source}.js.map`,
    });
  }
  console.log(
    JSON.stringify(
      { compiler: 'vercel@63.1.2', artifacts, evidence: 'isolated-local-build-only' },
      null,
      2,
    ),
  );
} finally {
  await rm(directory, { recursive: true, force: true });
}
