import '../src/infrastructure/observability/instrument-operations.js';
import { reportError, flushErrors } from '../src/infrastructure/observability/error-reporting.js';
import { timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module.js';
import { WorkerOwner } from '../src/infrastructure/managed/worker-owner.service.js';
let context: Promise<WorkerOwner> | undefined;
function consumer() {
  context ??= NestFactory.createApplicationContext(AppModule)
    .then((app) => app.get(WorkerOwner))
    .catch((error) => {
      context = undefined;
      throw error;
    });
  return context;
}
// Independent daily reseed restores the managed chain after a deployment or extended outage.
export function maintenanceSeed(ownerProvider = consumer) {
  return async function seed(request: IncomingMessage, response: ServerResponse) {
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
      const scheduled = await (
        await ownerProvider()
      ).send(
        'slogan-maintenance',
        { kind: 'fallback' },
        {
          retentionSeconds: 604800,
          idempotencyKey: `fallback-${Math.floor(Date.now() / 900_000)}`,
        },
        true,
      );
      if (!scheduled) {
        response
          .writeHead(200, { 'content-type': 'application/json' })
          .end(JSON.stringify({ scheduled: false }));
        return;
      }
      if (process.env.OBSERVABILITY_MONITOR_ENABLED === 'true') {
        const interval = Math.max(
          900,
          Number(process.env.OBSERVABILITY_MONITOR_INTERVAL_SECONDS ?? 900),
        );
        if (!Number.isInteger(interval) || interval < 60 || interval > 3600)
          throw new Error('INVALID_MONITOR_INTERVAL');
        const window = Math.floor(Date.now() / (interval * 1000));
        await (
          await ownerProvider()
        ).send(
          'slogan-observability',
          { kind: 'monitor', window },
          {
            retentionSeconds: 604800,
            idempotencyKey: `monitor-production-${interval}-${window}`,
          },
          true,
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
  };
}
export default maintenanceSeed();
