import { NestFactory } from '@nestjs/core';
import { OperationsWorkerModule } from './operations-worker.module.js';

async function bootstrap() {
  const context = await NestFactory.createApplicationContext(OperationsWorkerModule, { bufferLogs: true });
  context.enableShutdownHooks();
}
void bootstrap();
