import '../src/infrastructure/observability/instrument-monitor.js';
import {
  WorkerOwner,
  localDelivery,
  type FencedJob,
} from '../src/infrastructure/managed/worker-owner.service.js';
import { NestFactory } from '@nestjs/core';
import { QueueClient } from '@vercel/queue';
import { MonitorWorkerModule } from '../src/workers/monitor/monitor-worker.module.js';
import { ObservabilityMonitorService, type MonitorJob } from '../src/modules/operations/index.js';
import {
  reportError,
  flushErrors,
  withErrorReportingScope,
} from '../src/infrastructure/observability/error-reporting.js';
let context: Promise<{ monitor: ObservabilityMonitorService; owner: WorkerOwner }> | undefined;
function consumer() {
  context ??= NestFactory.createApplicationContext(MonitorWorkerModule)
    .then((app) => ({ monitor: app.get(ObservabilityMonitorService), owner: app.get(WorkerOwner) }))
    .catch((error) => {
      context = undefined;
      throw error;
    });
  return context;
}
const queue = new QueueClient();
export default queue.handleNodeCallback<MonitorJob & FencedJob>(
  (job) =>
    withErrorReportingScope(async () => {
      try {
        if (!localDelivery(job)) return;
        const { monitor, owner } = await consumer();
        await owner.run(job, () => monitor.process(job, true));
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
