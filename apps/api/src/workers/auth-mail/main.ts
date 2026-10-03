import { NestFactory } from '@nestjs/core';
import { AuthMailWorkerModule } from './auth-mail-worker.module.js';
async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AuthMailWorkerModule, {
    bufferLogs: true,
  });
  app.enableShutdownHooks();
}
void bootstrap();
