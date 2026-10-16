import '../src/infrastructure/observability/instrument-monitor.js';
import { NestFactory } from '@nestjs/core';
import { QueueClient } from '@vercel/queue';
import { MonitorWorkerModule } from '../src/workers/monitor/monitor-worker.module.js';
import { ObservabilityMonitorService, type MonitorJob } from '../src/modules/operations/index.js';
import {
  reportError,
  flushErrors,
  withErrorReportingScope,
} from '../src/infrastructure/observability/error-reporting.js';
let context: Promise<ObservabilityMonitorService> | undefined;
function consumer() {
  context ??= NestFactory.createApplicationContext(MonitorWorkerModule)
    .then((app) => app.get(ObservabilityMonitorService))
    .catch((error) => {
      context = undefined;
      throw error;
    });
  return context;
}
const queue = new QueueClient();
export default queue.handleNodeCallback<MonitorJob>(
  (job) =>
    withErrorReportingScope(async () => {
      try {
        await (await consumer()).process(job, true);
      } catch (error) {
        reportError(error, { code: 'WORKER_FAILED', stage: 'worker' });
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
