import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, access, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { buildMetadata, uploadSourceMaps, removePublicMaps } from '../observability-build.mjs';
import { observabilityReadiness } from '../observability-readiness.mjs';
const sha = 'a'.repeat(40);
test('disabled builds need no upload secret; enabled builds bind the actual revision', () => {
  assert.equal(buildMetadata('admin', {}, sha).enabled, false);
  assert.throws(
    () => buildMetadata('admin', { VITE_OBSERVABILITY_ENABLED: 'true' }, sha),
    /configuration/,
  );
  const metadata = buildMetadata(
    'mobile',
    {
      EXPO_PUBLIC_OBSERVABILITY_ENABLED: 'true',
      EXPO_PUBLIC_OBSERVABILITY_ENVIRONMENT: 'preview',
      EXPO_PUBLIC_SENTRY_DSN: 'https://0123456789abcdef@o123.ingest.us.sentry.io/123',
      SENTRY_AUTH_TOKEN: 'UPLOAD_CANARY',
      SENTRY_ORG: 'test-org',
      SENTRY_PROJECT: 'test-mobile',
    },
    sha,
  );
  assert.equal(metadata.env.EXPO_PUBLIC_OBSERVABILITY_RELEASE, `slogan-mobile@${sha}`);
  assert.ok(
    !Object.entries(metadata.env).some(
      ([key, value]) => key.startsWith('EXPO_PUBLIC_') && value === 'UPLOAD_CANARY',
    ),
  );
  for (const invalid of ['', 'NaN', '-0.1', '1.1'])
    assert.throws(
      () =>
        buildMetadata(
          'mobile',
          { ...metadata.env, EXPO_PUBLIC_SENTRY_TRACES_SAMPLE_RATE: invalid },
          sha,
        ),
      /sample rate/,
    );
  assert.throws(
    () => buildMetadata('mobile', { ...metadata.env, EXPO_PUBLIC_USE_RN_FETCH: 'true' }, sha),
    /redirect protection/,
  );
  assert.equal(
    buildMetadata(
      'mobile',
      {
        ...metadata.env,
        EXPO_PUBLIC_USE_RN_FETCH: 'true',
        EXPO_PUBLIC_SENTRY_TRACES_SAMPLE_RATE: '0',
      },
      sha,
    ).enabled,
    true,
  );
  assert.equal(observabilityReadiness('mobile', metadata.env).readyForSourceUpload, true);
  const invalid = observabilityReadiness('mobile', {
    ...metadata.env,
    EXPO_PUBLIC_SENTRY_DSN: 'PRIVATE_CANARY',
  });
  assert.equal(invalid.readyForSourceUpload, false);
  assert.ok(!JSON.stringify(invalid).includes('PRIVATE_CANARY'));
});
test('upload failure propagates and maps are removed only after upload', async () => {
  const directory = await mkdtemp(`${tmpdir()}/slogan-map-test-`);
  try {
    await writeFile(`${directory}/app.js.map`, '{}');
    await writeFile(`${directory}/app.js`, '');
    await assert.rejects(
      uploadSourceMaps(
        'api',
        directory,
        { enabled: true, env: {}, release: 'release', build: 'build' },
        () => {
          throw new Error('failed');
        },
      ),
      /failed/,
    );
    await access(`${directory}/app.js.map`);
    const calls = [];
    await uploadSourceMaps(
      'api',
      directory,
      { enabled: true, env: {}, release: 'release', build: 'build' },
      (...args) => {
        calls.push(args);
      },
    );
    assert.equal(calls.length, 2);
    await removePublicMaps(directory);
    await assert.rejects(access(`${directory}/app.js.map`));
    await access(`${directory}/app.js`);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
