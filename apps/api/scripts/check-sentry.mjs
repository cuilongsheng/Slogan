// Isolated local harness; these routes are never registered in AppModule.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as Sentry from '@sentry/nestjs';
import { createSentryOptions } from '../dist/infrastructure/observability/sentry-options.js';

const envelopes = [];
const fatalMode = process.argv[2];
Sentry.init({
  ...createSentryOptions({
    dsn: 'https://fixture@o123.ingest.us.sentry.io/123',
    environment: 'test',
    release: `slogan-api@${'a'.repeat(40)}`,
    tracesSampleRate: 0.1,
  }),
  // Deterministic harness-only sampling, production uses the configured rate.
  tracesSampler: () => 1,
  transport: () => ({
    send: async (envelope) => {
      envelopes.push(envelope);
      if (fatalMode) console.log(JSON.stringify(envelope));
      return { statusCode: 200 };
    },
    flush: async () => true,
  }),
});
if (fatalMode) {
  if (fatalMode === 'uncaught') {
    setTimeout(() => {
      throw new Error('PRIVATE_CANARY');
    }, 0);
  } else {
    void Promise.reject(new Error('PRIVATE_CANARY'));
  }
  await new Promise(() => {});
}
for (const mode of ['uncaught', 'rejection']) {
  const child = spawnSync(process.execPath, [fileURLToPath(import.meta.url), mode], {
    encoding: 'utf8',
    timeout: 10_000,
  });
  assert.equal(child.status, 1, `${mode} must still terminate the process`);
  assert.ok(child.stderr.includes('Fatal API error; shutting down'));
  assert.ok(!`${child.stdout}${child.stderr}`.includes('PRIVATE_CANARY'));
  const captured = child.stdout
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));
  assert.equal(captured.length, 1);
  assert.equal(captured[0][1][0][0].type, 'event');
}
const { Controller, Get, Module, HttpException } = await import('@nestjs/common');
const { NestFactory } = await import('@nestjs/core');
const { SentryModule } = await import('@sentry/nestjs/setup');
const { ApiExceptionFilter } = await import('../dist/common/filters/api-exception.filter.js');
class HarnessController {
  ok() {
    return { ok: true };
  }
  fail() {
    throw new Error('PRIVATE_CANARY');
  }
  unavailable() {
    throw new HttpException('PRIVATE_CANARY', 503);
  }
  denied() {
    throw new HttpException('Denied', 403);
  }
}
Controller('fixture')(HarnessController);
for (const method of ['ok', 'fail', 'unavailable', 'denied']) {
  Get(method)(
    HarnessController.prototype,
    method,
    Object.getOwnPropertyDescriptor(HarnessController.prototype, method),
  );
}
class HarnessModule {}
Module({ imports: [SentryModule.forRoot()], controllers: [HarnessController] })(HarnessModule);
const app = await NestFactory.create(HarnessModule, { logger: false });
app.useGlobalFilters(new ApiExceptionFilter({ warn() {}, error() {} }));
app.setGlobalPrefix('v1');
try {
  await app.listen(0, '127.0.0.1');
  const base = await app.getUrl();
  for (const [path, status] of [
    ['ok', 200],
    ['fail', 500],
    ['unavailable', 503],
    ['denied', 403],
  ]) {
    const response = await fetch(`${base}/v1/fixture/${path}?secret=PRIVATE_CANARY`, {
      headers: { authorization: 'Bearer PRIVATE_CANARY', cookie: 'secret=PRIVATE_CANARY' },
    });
    assert.equal(response.status, status);
    if (path === 'fail') assert.equal((await response.json()).code, 'INTERNAL_ERROR');
  }
  Sentry.logger.info('PRIVATE_CANARY');
  Sentry.metrics.count('PRIVATE_CANARY', 1);
  assert.equal(await Sentry.flush(2000), true);
  const items = envelopes.flatMap((envelope) => envelope[1]);
  const errors = items.filter(([header]) => header.type === 'event');
  const spans = items
    .filter(([header]) => header.type === 'span')
    .flatMap(([, body]) => body.items);
  assert.equal(errors.length, 2, '500 and 503 must each report exactly once; 403 must not report');
  assert.ok(
    spans.some((span) => span.attributes['sentry.op']?.value === 'http.server'),
    'automatic incoming HTTP span required',
  );
  assert.ok(
    spans.some(
      (span) =>
        span.attributes['sentry.op']?.value === 'http.server' && span.name === 'GET /v1/fixture/ok',
    ),
    'HTTP root span must contain its route template',
  );
  assert.ok(spans.every((span) => span.attributes['sentry.environment']?.value === 'test'));
  assert.ok(
    spans.every(
      (span) => span.attributes['sentry.release']?.value === `slogan-api@${'a'.repeat(40)}`,
    ),
  );
  assert.ok(
    items.every(([header]) => ['event', 'span'].includes(header.type)),
    `only errors and tracing allowed: ${JSON.stringify(items.map(([header]) => header.type))}`,
  );
  assert.ok(
    !JSON.stringify(envelopes).includes('PRIVATE_CANARY'),
    'private data must never reach transport',
  );
  console.log(
    JSON.stringify({
      errors: errors.length,
      spans: spans.length,
      products: ['Error Monitoring', 'Tracing'],
      processErrors: ['uncaught', 'rejection'],
      cloudDelivery: 'not tested',
    }),
  );
} catch {
  // Closing the SDK removes its fatal handler; assertions must still fail CI.
  process.stderr.write('Sentry runtime verification failed\n');
  process.exitCode = 1;
} finally {
  await app.close();
  await Sentry.close(2000);
}
