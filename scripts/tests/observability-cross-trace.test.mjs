import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
const root = fileURLToPath(new URL('../../', import.meta.url));

test('real browser SDK context continues in the Node SDK after header allowlisting', async () => {
  const source = `
    import * as Sentry from '@sentry/react';
    Sentry.init({ dsn:'https://0123456789abcdef@o123.ingest.us.sentry.io/123', defaultIntegrations:false,
      tracesSampleRate:1, beforeSendLog:()=>null,beforeSendMetric:()=>null,
      transport:()=>({send:async()=>({statusCode:200}),flush:async()=>true}) });
    Sentry.startSpan({name:'GET /v1/fixture',op:'http.client'},()=>console.log(JSON.stringify(Sentry.getTraceData())));
    await Sentry.close(1000);
  `;
  const browser = spawnSync(process.execPath, ['--input-type=module', '-e', source], {
    cwd: root + 'apps/admin',
    encoding: 'utf8',
    timeout: 10_000,
  });
  assert.equal(browser.status, 0, 'browser SDK fixture must initialize');
  const raw = JSON.parse(browser.stdout.trim());
  const { sanitizeTraceHeaders } = await import(
    pathToFileURL(root + 'packages/shared/dist/index.js')
  );
  const headers = sanitizeTraceHeaders(raw);
  assert.match(headers['sentry-trace'], /^[a-f0-9]{32}-[a-f0-9]{16}-1$/);
  const apiRequire = createRequire(pathToFileURL(root + 'apps/api/package.json'));
  const sdkModule = await import(pathToFileURL(apiRequire.resolve('@sentry/nestjs')));
  const Sentry = sdkModule.default ?? sdkModule;
  const { createSentryOptions } = await import(
    pathToFileURL(root + 'apps/api/dist/infrastructure/observability/sentry-options.js')
  );
  const envelopes = [];
  Sentry.init({
    ...createSentryOptions({
      dsn: 'https://0123456789abcdef@o123.ingest.us.sentry.io/123',
      environment: 'test',
      tracesSampleRate: 0.1,
    }),
    transport: () => ({
      send: async (envelope) => {
        envelopes.push(envelope);
        return { statusCode: 200 };
      },
      flush: async () => true,
    }),
  });
  const { createServer } = await import('node:http');
  const server = createServer((_request, response) => {
    response.end('PRIVATE_CANARY');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const response = await fetch(
      `http://127.0.0.1:${server.address().port}/v1/fixture?secret=PRIVATE_CANARY`,
      { headers },
    );
    await response.text();
    await Sentry.flush(1000);
    const spans = envelopes
      .flatMap((envelope) => envelope[1])
      .filter(([header]) => header.type === 'span')
      .flatMap(([, body]) => body.items);
    const incoming = spans.find((span) => span.attributes['sentry.op']?.value === 'http.server');
    assert.ok(incoming, 'continued incoming HTTP span must be sampled');
    assert.equal(incoming.trace_id, headers['sentry-trace'].split('-')[0]);
    assert.equal(incoming.parent_span_id, headers['sentry-trace'].split('-')[1]);
    assert.ok(!JSON.stringify(envelopes).includes('PRIVATE_CANARY'));
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await Sentry.close(1000);
  }
});
