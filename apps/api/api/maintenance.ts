import '../src/infrastructure/observability/instrument-operations.js';
import { NestFactory } from '@nestjs/core';
import { QueueClient } from '@vercel/queue';
import { AppModule } from '../src/app.module.js';
import { MaintenanceService } from '../src/modules/maintenance/index.js';
import {
  reportError,
  flushErrors,
  withErrorReportingScope,
} from '../src/infrastructure/observability/error-reporting.js';
let context: Promise<MaintenanceService> | undefined;
function consumer() {
  context ??= NestFactory.createApplicationContext(AppModule)
    .then((app) => app.get(MaintenanceService))
    .catch((error) => {
      context = undefined;
      throw error;
    });
  return context;
}
export default new QueueClient().handleNodeCallback<{ kind: string }>(
  (job) =>
    withErrorReportingScope(async () => {
      try {
        await (await consumer()).process(job);
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
