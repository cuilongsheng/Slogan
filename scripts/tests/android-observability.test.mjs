import { test } from 'node:test';
import assert from 'node:assert/strict';
import { androidObservabilityEnvironment } from '../release/prepare-android-observability.mjs';

const revision = 'a'.repeat(40);
const input = {
  GITHUB_REF: 'refs/heads/main',
  GITHUB_EVENT_NAME: 'push',
  SLOGAN_RELEASE_COMMIT: revision,
  EXPO_PUBLIC_OBSERVABILITY_ENABLED: 'true',
  EXPO_PUBLIC_OBSERVABILITY_ENVIRONMENT: 'production',
  EXPO_PUBLIC_SENTRY_DSN: 'https://0123456789abcdef@o123.ingest.us.sentry.io/123',
  EXPO_PUBLIC_SENTRY_TRACES_SAMPLE_RATE: '0.1',
  SENTRY_AUTH_TOKEN: 'PRIVATE_UPLOAD_CANARY',
  SENTRY_ORG: 'test-org',
  SENTRY_PROJECT: 'slogan-mobile',
};
test('monitored Android binds the source revision without persisting private build credentials', () => {
  const values = androidObservabilityEnvironment(input, revision);
  assert.equal(values.EXPO_PUBLIC_OBSERVABILITY_RELEASE, `slogan-mobile@${revision}`);
  assert.equal(values.EXPO_PUBLIC_OBSERVABILITY_BUILD, revision);
  assert.equal(values.EXPO_PUBLIC_SENTRY_TRACES_SAMPLE_RATE, '0.1');
  assert.ok(!JSON.stringify(values).includes(input.SENTRY_AUTH_TOKEN));
  assert.ok(!('SENTRY_AUTH_TOKEN' in values));
});
test('rejects untrusted refs, mismatched artifacts and missing upload credentials', () => {
  for (const patch of [
    { GITHUB_REF: 'refs/pull/1/merge' },
    { GITHUB_EVENT_NAME: 'pull_request' },
    { SLOGAN_RELEASE_COMMIT: 'b'.repeat(40) },
    { SENTRY_AUTH_TOKEN: '' },
    { EXPO_PUBLIC_OBSERVABILITY_ENABLED: 'false' },
  ])
    assert.throws(() => androidObservabilityEnvironment({ ...input, ...patch }, revision));
});
