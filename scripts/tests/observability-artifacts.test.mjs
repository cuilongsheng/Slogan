import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { pathToFileURL, fileURLToPath } from 'node:url';
import test from 'node:test';

test('actual CLI inject and Node SDK preserve the same Debug ID after privacy filtering', async () => {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const directory = await mkdtemp(`${tmpdir()}/slogan-observability-artifacts-`);
  try {
    await mkdir(`${directory}/dist`);
    await writeFile(`${directory}/package.json`, '{"type":"module"}');
    const file = `${directory}/dist/canary.js`;
    await writeFile(
      file,
      'export function canary() { throw new Error("PRIVATE_CANARY"); }\n//# sourceMappingURL=canary.js.map\n',
    );
    await writeFile(
      `${file}.map`,
      JSON.stringify({
        version: 3,
        file: 'canary.js',
        sources: ['src/canary.ts'],
        sourcesContent: ['export function canary() { throw new Error("PRIVATE_CANARY"); }'],
        names: ['canary'],
        mappings: 'AAAA',
      }),
    );
    execFileSync('pnpm', ['exec', 'sentry-cli', 'sourcemaps', 'inject', `${directory}/dist`], {
      cwd: root,
      stdio: 'pipe',
    });
    const map = JSON.parse(await readFile(`${file}.map`, 'utf8'));
    assert.match(map.debugId, /^[a-f0-9-]{36}$/);
    const script = `
      import { initializeErrorReporting, reportError, flushErrors } from ${JSON.stringify(pathToFileURL(`${root}apps/api/dist/infrastructure/observability/error-reporting.js`).href)};
      const events = [];
      initializeErrorReporting('api', { OBSERVABILITY_ENABLED:'true', OBSERVABILITY_ENVIRONMENT:'test', OBSERVABILITY_RELEASE:'slogan-api@abcdef123456', OBSERVABILITY_BUILD:'abcdef123456', SENTRY_DSN:'https://0123456789abcdef@o123.ingest.us.sentry.io/123' }, () => ({ send:async e => { events.push(e); return {statusCode:200}; }, flush:async () => true }));
      const { canary } = await import(${JSON.stringify(pathToFileURL(file).href)});
      try { canary(); } catch (e) { reportError(e); }
      await flushErrors();
      process.stdout.write(JSON.stringify(events));
    `;
    const output = execFileSync(process.execPath, ['--input-type=module', '-e', script], {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, NODE_ENV: 'test', OBSERVABILITY_ENABLED: 'false' },
    });
    const events = JSON.parse(output);
    assert.equal(events.length, 1);
    assert.ok(!output.includes('PRIVATE_CANARY'));
    assert.equal(events[0][1][0][1].debug_meta.images[0].debug_id, map.debugId);
    assert.equal(events[0][1][0][1].debug_meta.images[0].code_file, 'dist/canary.js');
    const httpScript = `
      import * as Sentry from '@sentry/nestjs';
      import { createSentryOptions } from ${JSON.stringify(pathToFileURL(`${root}apps/api/dist/infrastructure/observability/sentry-options.js`).href)};
      const events=[];
      Sentry.init({...createSentryOptions({dsn:'https://0123456789abcdef@o123.ingest.us.sentry.io/123',environment:'test',tracesSampleRate:0}),
        transport:()=>({send:async e=>{events.push(e);return {statusCode:200}},flush:async()=>true})});
      const {canary}=await import(${JSON.stringify(pathToFileURL(file).href)});
      try {canary()} catch(e) {Sentry.captureException(e)}
      await Sentry.flush(1000); process.stdout.write(JSON.stringify(events));
    `;
    const httpOutput = execFileSync(process.execPath, ['--input-type=module', '-e', httpScript], {
      cwd: `${root}apps/api`,
      encoding: 'utf8',
      env: { ...process.env, NODE_ENV: 'test' },
    });
    const httpEvents = JSON.parse(httpOutput);
    assert.equal(httpEvents[0][1][0][1].debug_meta.images[0].debug_id, map.debugId);
    assert.equal(httpEvents[0][1][0][1].debug_meta.images[0].code_file, 'app:///dist/canary.js');
    assert.ok(!httpOutput.includes('PRIVATE_CANARY'));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

for (const trigger of [
  'setTimeout(() => { throw new Error("PRIVATE_CANARY"); }, 0)',
  'Promise.reject(new Error("PRIVATE_CANARY"))',
]) {
  test(`actual ESM startup has a sanitized, bounded fatal exit (${trigger.startsWith('Promise') ? 'rejection' : 'exception'})`, () => {
    const root = fileURLToPath(new URL('../../', import.meta.url));
    const script = `import { initializeErrorReporting } from ${JSON.stringify(pathToFileURL(`${root}apps/api/dist/infrastructure/observability/error-reporting.js`).href)};
      initializeErrorReporting('realtime', { OBSERVABILITY_ENABLED:'true', OBSERVABILITY_ENVIRONMENT:'test', OBSERVABILITY_RELEASE:'slogan-api@abcdef123456', OBSERVABILITY_BUILD:'abcdef123456', OBSERVABILITY_FLUSH_TIMEOUT_MS:'100', SENTRY_DSN:'https://0123456789abcdef@o123.ingest.us.sentry.io/123' }, () => ({ send: async e => { process.stdout.write(JSON.stringify(e)); return {statusCode:200}; }, flush: () => new Promise(() => {}) }));
      ${trigger};`;
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
      encoding: 'utf8',
      timeout: 2000,
      env: { ...process.env, NODE_ENV: 'test' },
    });
    assert.equal(result.status, 1);
    assert.equal(result.stderr, 'unhandled_api_error\n');
    assert.ok(result.stdout.includes('realtime'));
    assert.ok(!result.stdout.includes('PRIVATE_CANARY'));
  });
}
