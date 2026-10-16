import { readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { currentRevision, requireCleanRelease, runTool } from './observability-build.mjs';

export async function verifyMonitoredOutput(directory, revision) {
  const output = resolve(directory);
  const manifest = JSON.parse(
    await readFile(join(output, 'slogan-observability-artifacts.json'), 'utf8'),
  );
  if (
    manifest.release !== `slogan-api@${revision}` ||
    !Array.isArray(manifest.functions) ||
    !manifest.functions.length
  )
    throw new Error('Monitored output does not match the current commit');
  const directories = [];
  async function find(path) {
    for (const item of await readdir(path, { withFileTypes: true })) {
      if (!item.isDirectory()) continue;
      if (item.name.endsWith('.func')) directories.push(join(path, item.name));
      else await find(join(path, item.name));
    }
  }
  await find(join(output, 'functions'));
  if (directories.length !== manifest.functions.length)
    throw new Error('Unverified function found');
  for (const entry of manifest.functions) {
    const fn = resolve(output, 'functions', entry.name);
    if (!directories.includes(fn)) throw new Error('Invalid function manifest');
    const config = JSON.parse(await readFile(join(fn, '.vc-config.json'), 'utf8'));
    if (
      config.handler !== entry.handler ||
      config.environment?.SENTRY_RELEASE !== manifest.release ||
      config.environment?.SENTRY_DIST !== manifest.build ||
      config.environment?.SENTRY_AUTH_TOKEN
    )
      throw new Error('Unverified monitored function');
    const handler = resolve(fn, config.handler);
    if (
      !handler.startsWith(fn + '/') ||
      createHash('sha256')
        .update(await readFile(handler))
        .digest('hex') !== entry.handlerSha256
    )
      throw new Error('Monitored handler changed after source map upload');
  }
  return manifest;
}
async function main() {
  const target = process.argv[2];
  if (!['preview', 'production'].includes(target)) throw new Error('Choose preview or production');
  requireCleanRelease();
  const revision = currentRevision();
  await verifyMonitoredOutput('.vercel/output', revision);
  const env = { ...process.env };
  delete env.SENTRY_AUTH_TOKEN;
  delete env.SENTRY_ORG;
  delete env.SENTRY_PROJECT;
  runTool(
    'pnpm',
    [
      '--allow-build',
      'esbuild',
      'dlx',
      'vercel@63.1.2',
      'deploy',
      '--prebuilt',
      '--archive=tgz',
      ...(target === 'production' ? ['--prod'] : ['--target', 'preview']),
      '--meta',
      `githubCommitSha=${revision}`,
      '--env',
      `SLOGAN_RELEASE_COMMIT=${revision}`,
      '--yes',
      '--non-interactive',
    ],
    env,
  );
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(() => {
    console.error('Monitored deployment verification failed');
    process.exitCode = 1;
  });
}
