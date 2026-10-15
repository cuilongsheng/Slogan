import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, access, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { verifyMonitoredOutput } from '../deploy-observability-vercel.mjs';
import {
  uploadVercelArtifacts,
  attachWorkspaceSourceMaps,
} from '../build-observability-vercel.mjs';
const metadata = {
  enabled: true,
  release: `slogan-api@${'a'.repeat(40)}`,
  build: 'a'.repeat(40),
  env: { SENTRY_AUTH_TOKEN: 'PRIVATE_CANARY' },
};
test('attaches workspace maps only to identical JavaScript from the same build', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'slogan-workspace-maps-'));
  try {
    const source = join(directory, 'source/packages/shared/dist');
    const target = join(directory, 'output/functions/index.func/packages/shared/dist');
    await mkdir(source, { recursive: true });
    await mkdir(target, { recursive: true });
    await writeFile(join(source, 'index.js'), 'export const build = 1;');
    await writeFile(join(source, 'index.js.map'), '{"version":3,"sources":["../src/index.ts"]}');
    await writeFile(join(target, 'index.js'), 'export const build = 2;');
    await assert.rejects(
      attachWorkspaceSourceMaps(join(directory, 'output'), join(directory, 'source')),
      /differs/,
    );
    await assert.rejects(access(join(target, 'index.js.map')));
    await writeFile(join(target, 'index.js'), 'export const build = 1;');
    await attachWorkspaceSourceMaps(join(directory, 'output'), join(directory, 'source'));
    await access(join(target, 'index.js.map'));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
async function fixture() {
  const output = await mkdtemp(join(tmpdir(), 'slogan-vercel-upload-'));
  await writeFile(join(output, 'config.json'), '{"version":3}');
  for (const name of ['index', 'api/realtime', 'api/observability']) {
    const fn = join(output, 'functions', `${name}.func`);
    const handler = name === 'index' ? 'apps/api/src/main.js' : `apps/api/${name}.js`;
    await mkdir(join(fn, handler, '..'), { recursive: true });
    await writeFile(
      join(fn, '.vc-config.json'),
      JSON.stringify({
        runtime: 'nodejs24.x',
        handler,
        environment: { SENTRY_AUTH_TOKEN: 'PRIVATE_CANARY' },
      }),
    );
    await writeFile(join(fn, handler), 'export const harmless = true;');
    await writeFile(join(fn, handler + '.map'), '{"version":3,"sources":["source.ts"]}');
  }
  return output;
}
test('uploads actual independent Vercel artifacts, retains matching release and removes private maps/credentials', async () => {
  const output = await fixture();
  const calls = [];
  try {
    const manifest = await uploadVercelArtifacts(output, metadata, async (app, path) => {
      calls.push({ app, path });
    });
    assert.equal(manifest.length, 3);
    assert.equal(calls.length, 3);
    await verifyMonitoredOutput(output, 'a'.repeat(40));
    await assert.rejects(verifyMonitoredOutput(output, 'b'.repeat(40)));
    for (const artifact of manifest) {
      const fn = join(output, 'functions', artifact.name);
      const config = JSON.parse(await readFile(join(fn, '.vc-config.json')));
      assert.equal(config.environment.SENTRY_RELEASE, metadata.release);
      assert.equal(config.environment.SENTRY_AUTH_TOKEN, undefined);
      await assert.rejects(access(join(fn, artifact.handler + '.map')));
    }
    await writeFile(
      join(output, 'functions/index.func/apps/api/src/main.js'),
      'changed after upload',
    );
    await assert.rejects(verifyMonitoredOutput(output, 'a'.repeat(40)), /changed after/);
    assert.ok(
      !(await readFile(join(output, 'slogan-observability-artifacts.json'), 'utf8')).includes(
        'PRIVATE_CANARY',
      ),
    );
  } finally {
    await rm(output, { recursive: true, force: true });
  }
});
test('rejects incomplete compiler output before uploading; upload failures cannot produce completion manifest', async () => {
  const output = await fixture();
  let count = 0;
  try {
    const map = join(output, 'functions/index.func/apps/api/src/main.js.map');
    await rm(map);
    await assert.rejects(
      uploadVercelArtifacts(output, metadata, async () => {
        count++;
      }),
    );
    assert.equal(count, 0);
    await writeFile(map, '{"version":3,"sources":["source.ts"]}');
    await assert.rejects(
      uploadVercelArtifacts(output, metadata, async () => {
        throw new Error('upload failed');
      }),
    );
    await assert.rejects(access(join(output, 'slogan-observability-artifacts.json')));
  } finally {
    await rm(output, { recursive: true, force: true });
  }
});
