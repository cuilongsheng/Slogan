import { execFileSync, spawnSync } from 'node:child_process';
import { readdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
export function buildMetadata(app, input, sha) {
  const prefix = app === 'admin' ? 'VITE_' : app === 'mobile' ? 'EXPO_PUBLIC_' : '';
  const enabled =
    input[`${prefix}OBSERVABILITY_ENABLED`] === 'true' ||
    (app === 'api' && input.SENTRY_UPLOAD_SOURCEMAPS === 'true');
  if (!enabled) return { enabled: false, env: { ...input } };
  const rawRate = input[`${prefix}SENTRY_TRACES_SAMPLE_RATE`];
  const rate = rawRate === undefined ? 0.1 : Number(rawRate);
  if (rawRate?.trim() === '' || !Number.isFinite(rate) || rate < 0 || rate > 1)
    throw new Error('Invalid tracing build sample rate');
  if (app === 'mobile' && ['1', 'true'].includes(input.EXPO_PUBLIC_USE_RN_FETCH ?? '') && rate > 0)
    throw new Error('Sampled API tracing requires Expo fetch redirect protection');
  if (!/^[0-9a-f]{40}$/.test(sha)) throw new Error('Invalid release revision');
  const environment = input[`${prefix}OBSERVABILITY_ENVIRONMENT`];
  const dsn = input[`${prefix}SENTRY_DSN`];
  if (
    !['production', 'preview', 'test'].includes(environment) ||
    !/^https:\/\/[0-9a-f]{16,64}@(?:[a-z0-9-]+\.)*ingest(?:\.[a-z]+)?\.sentry\.io\/[0-9]+$/.test(
      dsn ?? '',
    )
  )
    throw new Error('Invalid observability build configuration');
  const build = input[`${prefix}OBSERVABILITY_BUILD`] ?? sha;
  if (!/^[0-9a-f]{7,40}(?:\.[0-9]{1,12})?$/.test(build))
    throw new Error('Invalid observability build identifier');
  if (
    !input.SENTRY_AUTH_TOKEN ||
    !/^[a-z0-9][a-z0-9_-]{0,99}$/.test(input.SENTRY_ORG ?? '') ||
    !/^[a-z0-9][a-z0-9_-]{0,99}$/.test(input.SENTRY_PROJECT ?? '')
  )
    throw new Error('Missing observability upload configuration');
  const release = `slogan-${app}@${sha}`;
  return {
    enabled: true,
    release,
    build,
    env: {
      ...input,
      SENTRY_LOG_LEVEL: 'error',
      SENTRY_DISABLE_TELEMETRY: '1',
      [`${prefix}OBSERVABILITY_RELEASE`]: release,
      [`${prefix}OBSERVABILITY_BUILD`]: build,
      SENTRY_RELEASE: release,
      SENTRY_DIST: build,
    },
  };
}
export function currentRevision() {
  return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
}
export function requireCleanRelease() {
  const status = execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' });
  if (status.trim()) throw new Error('Monitored releases require a clean source checkout');
}
export async function removePublicMaps(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) await removePublicMaps(path);
    else if (entry.name.endsWith('.map')) await rm(path);
  }
}
export function runTool(command, args, env, cwd = root) {
  const result = spawnSync(command, args, { cwd, env, stdio: 'inherit' });
  if (result.error || result.status !== 0) throw new Error('Observability build step failed');
}
export function runPrivateUpload(command, args, env, cwd = root) {
  const result = spawnSync(command, args, {
    cwd,
    env: { ...env, SENTRY_LOG_LEVEL: 'error', SENTRY_DISABLE_TELEMETRY: '1' },
    stdio: 'pipe',
    maxBuffer: 1024 * 1024,
  });
  if (result.error || result.status !== 0)
    throw new Error('Observability source map upload failed');
}
export async function uploadSourceMaps(app, directory, metadata, upload = runPrivateUpload) {
  if (!metadata.enabled) return;
  if (app === 'mobile')
    upload(
      'pnpm',
      ['--filter', '@slogan/mobile', 'exec', 'sentry-expo-upload-sourcemaps', directory],
      metadata.env,
    );
  else {
    upload(
      'pnpm',
      ['exec', 'sentry-cli', 'sourcemaps', 'inject', '--ignore', '**/node_modules/**', directory],
      metadata.env,
    );
    upload(
      'pnpm',
      [
        'exec',
        'sentry-cli',
        'sourcemaps',
        'upload',
        '--release',
        metadata.release,
        '--dist',
        metadata.build,
        '--ignore',
        '**/node_modules/**',
        directory,
      ],
      metadata.env,
    );
  }
}
