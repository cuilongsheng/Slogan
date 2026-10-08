import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module.js';
import { configureApiApp } from './bootstrap/create-api-app.js';
import type { Environment } from './config/environment.js';
import { RealtimeQueue } from './infrastructure/redis/realtime-queue.service.js';
import { StructuredLogger } from './infrastructure/observability/structured-logger.service.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  configureApiApp(app);
  const realtimeQueue = app.get(RealtimeQueue);
  await app.init();
  if (realtimeQueue.managed) {
    await realtimeQueue
      .ensureRecovery()
      .catch(() => app.get(StructuredLogger).warn('realtime_managed_recovery_seed_pending'));
  }
  const config = app.get<ConfigService<Environment, true>>(ConfigService);

  await app.listen(
    config.get('APP_PORT', { infer: true }),
    config.get('APP_HOST', { infer: true }),
  );
}

void bootstrap();
