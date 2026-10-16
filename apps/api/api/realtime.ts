import '../src/infrastructure/observability/instrument-realtime.js';
import { NestFactory } from '@nestjs/core';
import { QueueClient } from '@vercel/queue';
import { AppModule } from '../src/app.module.js';
import { LiveUpdatesService } from '../src/modules/live-updates/index.js';
import {
  RealtimeQueue,
  type RealtimeJob,
} from '../src/infrastructure/redis/realtime-queue.service.js';

// A queue-triggered function is private on Vercel. Keep it separate from the public Nest API.
import {
  reportError,
  flushErrors,
  withErrorReportingScope,
} from '../src/infrastructure/observability/error-reporting.js';
let context: Promise<{ realtime: RealtimeQueue; live: LiveUpdatesService }> | undefined;
function consumer() {
  context ??= NestFactory.createApplicationContext(AppModule)
    .then((app) => ({ realtime: app.get(RealtimeQueue), live: app.get(LiveUpdatesService) }))
    .catch((error) => {
      context = undefined;
      throw error;
    });
  return context;
}
const queue = new QueueClient();
export default queue.handleNodeCallback<RealtimeJob>(
  (job) =>
    withErrorReportingScope(async () => {
      try {
        const services = await consumer();
        await services.realtime.process(job);
        await services.live.recover();
      } catch (error) {
        reportError(error, { code: 'QUEUE_TASK_FAILED', stage: 'worker' });
        throw error;
      } finally {
        await flushErrors();
      }
    }),
  {
    retry: (_error, metadata) => ({
      afterSeconds: Math.min(300, 2 ** Math.min(metadata.deliveryCount, 8)),
    }),
  },
);
