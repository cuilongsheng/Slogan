import { readFile, readdir, writeFile, rm, copyFile } from 'node:fs/promises';
import { resolve, join, relative } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import {
  buildMetadata,
  currentRevision,
  requireCleanRelease,
  runTool,
  uploadSourceMaps,
  removePublicMaps,
} from './observability-build.mjs';

/** NFT copies workspace JavaScript without adjacent maps. Attach only byte-identical build maps. */
export async function attachWorkspaceSourceMaps(
  directory,
  sourceRoot = fileURLToPath(new URL('../', import.meta.url)),
) {
  async function attach(path) {
    let entries;
    try {
      entries = await readdir(path, { withFileTypes: true });
    } catch (error) {
      if (error.code === 'ENOENT') return;
      throw error;
    }
    for (const entry of entries) {
      const target = join(path, entry.name);
      if (entry.isDirectory()) await attach(target);
      else if (entry.name.endsWith('.js')) {
        const source = join(
          sourceRoot,
          relative(resolve(directory, 'functions'), target).split('.func/')[1],
        );
        if (!(await readFile(source)).equals(await readFile(target)))
          throw new Error('Workspace JavaScript differs from its source map build');
        const map = JSON.parse(await readFile(source + '.map', 'utf8'));
        if (map.version !== 3 || !map.sources?.length)
          throw new Error('Missing workspace source map');
        await copyFile(source + '.map', target + '.map');
      }
    }
  }
  async function visit(path) {
    for (const entry of await readdir(path, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      if (entry.name.endsWith('.func'))
        await attach(join(path, entry.name, 'packages/shared/dist'));
      else await visit(join(path, entry.name));
    }
  }
  await visit(resolve(directory, 'functions'));
}

/** Post-compiler upload. Input must be the exact output subsequently deployed with --prebuilt. */
export async function uploadVercelArtifacts(directory, metadata, upload = uploadSourceMaps) {
  if (!metadata.enabled) return [];
  const output = resolve(directory);
  await rm(join(output, 'slogan-observability-artifacts.json'), { force: true });
  const outputConfig = JSON.parse(await readFile(join(output, 'config.json'), 'utf8'));
  if (outputConfig.version !== 3) throw new Error('Unsupported Vercel output');
  const functions = [];
  async function visit(path) {
    for (const entry of await readdir(path, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const location = join(path, entry.name);
      if (!entry.name.endsWith('.func')) {
        await visit(location);
        continue;
      }
      const configPath = join(location, '.vc-config.json');
      const config = JSON.parse(await readFile(configPath, 'utf8'));
      if (config.runtime !== 'nodejs24.x' || typeof config.handler !== 'string')
        throw new Error('Unexpected API function runtime');
      const handler = resolve(location, config.handler);
      if (!handler.startsWith(location + '/') || !handler.endsWith('.js'))
        throw new Error('Invalid API handler');
      const map = JSON.parse(await readFile(handler + '.map', 'utf8'));
      if (map.version !== 3 || !Array.isArray(map.sources) || !map.sources.length)
        throw new Error('Missing API compiler source map');
      await readFile(handler, 'utf8');
      functions.push({
        name: relative(join(output, 'functions'), location),
        handler: config.handler,
        runtime: config.runtime,
        location,
        configPath,
        config,
      });
    }
  }
  await visit(join(output, 'functions'));
  if (
    !functions.some((fn) => fn.name === 'index.func' && fn.handler.endsWith('apps/api/src/main.js'))
  )
    throw new Error('NestJS API entry not found');
  // Validate every function before the first upload. Never upload only Nest dist.
  for (const fn of functions) {
    await upload('api', fn.location, metadata);
    fn.config.environment = {
      ...fn.config.environment,
      SENTRY_RELEASE: metadata.release,
      SENTRY_DIST: metadata.build,
    };
    delete fn.config.environment.SENTRY_AUTH_TOKEN;
    delete fn.config.environment.SENTRY_ORG;
    delete fn.config.environment.SENTRY_PROJECT;
    await writeFile(fn.configPath, JSON.stringify(fn.config, null, 2) + '\n');
    await removePublicMaps(fn.location);
  }
  const manifest = await Promise.all(
    functions.map(async ({ name, handler, runtime, location }) => ({
      name,
      handler,
      runtime,
      handlerSha256: createHash('sha256')
        .update(await readFile(join(location, handler)))
        .digest('hex'),
    })),
  );
  await writeFile(
    join(output, 'slogan-observability-artifacts.json'),
    JSON.stringify(
      { release: metadata.release, build: metadata.build, functions: manifest },
      null,
      2,
    ) + '\n',
  );
  return manifest;
}

async function main() {
  const target = process.argv[2] ?? 'preview';
  if (!['preview', 'production'].includes(target)) throw new Error('Choose preview or production');
  const metadata = buildMetadata('api', process.env, currentRevision());
  if (!metadata.enabled)
    throw new Error('Enable source map upload before a monitored prebuilt release');
  requireCleanRelease();
  const buildEnv = { ...metadata.env };
  // Upload credentials never enter Vercel's compiler or function environment.
  delete buildEnv.SENTRY_AUTH_TOKEN;
  delete buildEnv.SENTRY_ORG;
  delete buildEnv.SENTRY_PROJECT;
  runTool('pnpm', ['--filter', '@slogan/shared', 'build'], buildEnv);
  runTool(
    'pnpm',
    [
      '--allow-build',
      'esbuild',
      'dlx',
      'vercel@63.1.2',
      'build',
      '--target',
      target,
      '--non-interactive',
    ],
    buildEnv,
  );
  await attachWorkspaceSourceMaps('.vercel/output');
  const manifest = await uploadVercelArtifacts('.vercel/output', metadata);
  console.log(`Prepared ${manifest.length} monitored Vercel functions; not deployed`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(() => {
    console.error('Monitored Vercel build or source map upload failed');
    process.exitCode = 1;
  });
}
