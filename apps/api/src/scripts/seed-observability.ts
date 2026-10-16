import '../infrastructure/observability/instrument.js';
import { NestFactory } from '@nestjs/core';
import { MonitorWorkerModule } from '../workers/monitor/monitor-worker.module.js';
import { ObservabilityMonitorService } from '../modules/operations/index.js';
// CLI only. Reads explicitly supplied target configuration; no public reseed endpoint.
const app = await NestFactory.createApplicationContext(MonitorWorkerModule);
try {
  await app.get(ObservabilityMonitorService).seed();
} finally {
  await app.close();
}
