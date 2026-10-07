import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module.js';
import { configureApiApp } from './bootstrap/create-api-app.js';
import type { Environment } from './config/environment.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  configureApiApp(app);
  const config = app.get<ConfigService<Environment, true>>(ConfigService);

  await app.listen(
    config.get('APP_PORT', { infer: true }),
    config.get('APP_HOST', { infer: true }),
  );
}

void bootstrap();
