import '../src/infrastructure/observability/instrument-operations.js';
import { reportError, flushErrors } from '../src/infrastructure/observability/error-reporting.js';
import { timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { QueueClient } from '@vercel/queue';
// Independent daily reseed restores the managed chain after a deployment or extended outage.
export default async function seed(request: IncomingMessage, response: ServerResponse) {
  if (request.method !== 'GET') {
    response.writeHead(405).end();
    return;
  }
  const secret = process.env.CRON_SECRET;
  if (!secret || process.env.VERCEL_ENV !== 'production') {
    response.writeHead(503).end();
    return;
  }
  const expected = Buffer.from(`Bearer ${secret}`),
    actual = Buffer.from(request.headers.authorization ?? '');
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    response.writeHead(401).end();
    return;
  }
  try {
    await new QueueClient().send(
      'slogan-maintenance',
      { kind: 'maintenance' },
      {
        retentionSeconds: 604800,
        idempotencyKey: `maintenance-seed-${Math.floor(Date.now() / 60_000)}`,
      },
    );
    if (process.env.OBSERVABILITY_MONITOR_ENABLED === 'true') {
      const interval = Number(process.env.OBSERVABILITY_MONITOR_INTERVAL_SECONDS ?? 60);
      if (!Number.isInteger(interval) || interval < 60 || interval > 3600)
        throw new Error('INVALID_MONITOR_INTERVAL');
      const window = Math.floor(Date.now() / (interval * 1000));
      await new QueueClient().send(
        'slogan-observability',
        { kind: 'monitor', window },
        {
          retentionSeconds: 604800,
          idempotencyKey: `monitor-production-${interval}-${window}`,
        },
      );
    }
    response
      .writeHead(200, { 'content-type': 'application/json' })
      .end(JSON.stringify({ scheduled: true }));
  } catch (error) {
    reportError(error, { code: 'QUEUE_TASK_FAILED', stage: 'worker' });
    await flushErrors();
    response.writeHead(503).end();
  }
}
