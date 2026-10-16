import '../../infrastructure/observability/instrument.js';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { MonitorWorkerModule } from './monitor-worker.module.js';
import { ObservabilityMonitorService } from '../../modules/operations/index.js';
import { reportError } from '../../infrastructure/observability/error-reporting.js';
import type { Environment } from '../../config/environment.js';
if (process.env.VERCEL === '1')
  throw new Error('Persistent monitor worker cannot run in managed mode');
const app = await NestFactory.createApplicationContext(MonitorWorkerModule);
app.enableShutdownHooks();
const monitor = app.get(ObservabilityMonitorService);
const config = app.get<ConfigService<Environment, true>>(ConfigService);
if (monitor.enabled()) {
  let active = false;
  const run = async () => {
    if (active) return;
    active = true;
    try {
      await monitor.runOnce();
    } catch (error) {
      reportError(error, { code: 'WORKER_FAILED', stage: 'worker' });
    } finally {
      active = false;
    }
  };
  await run();
  const timer = setInterval(
    () => void run(),
    config.get('OBSERVABILITY_MONITOR_INTERVAL_SECONDS', { infer: true }) * 1000,
  );
  process.once('SIGTERM', () => clearInterval(timer));
  process.once('SIGINT', () => clearInterval(timer));
} else await app.close();
